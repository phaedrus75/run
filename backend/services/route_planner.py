"""
🗺 Route planner — turns Guide-suggested waypoints into a real path.

The Guide's `journey_suggestions` task names ordered waypoints (real
places in the user's home city) and short step-by-step directions. This
module:

1.  Geocodes any waypoint that doesn't already carry a (lat, lng), via
    Nominatim. We piggy-back on the existing Geocode cache shape used
    by the neighbourhood feature so repeat lookups are free.
2.  Stitches a walkable polyline through the resolved waypoints. We try
    OSRM's public foot-routing demo server first (real walking paths,
    no API key required); on failure or timeout we fall back to a
    straight-line polyline densified to ~30 points per leg so the map
    still renders something cohesive.
3.  Returns the stitched polyline (encoded), the resolved waypoint
    coordinates, and a rough distance estimate so the caller can
    sanity-check against the requested tier.

The polyline + steps are persisted on the Journey row (`route_polyline`,
`waypoints_json`, `directions_json`) when the user commits the journey,
so the same path shows up again on the planned-detail screen and stays
stable across reloads.

OSRM-public usage notes:
- Endpoint: https://router.project-osrm.org/route/v1/foot/...
- Free, no key, but rate-limited and not for production scale. Treat
  every call as best-effort. The caller should never fail user-facing
  flows on routing errors — the straight-line fallback is good enough
  to render the map.
"""

from __future__ import annotations

import json
import logging
import math
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from .geocode import search_places
from .overpass import decode_polyline, encode_polyline, haversine_km, polyline_distance_km

logger = logging.getLogger(__name__)

OSRM_FOOT_URL = "https://router.project-osrm.org/route/v1/foot"
OSRM_TIMEOUT_S = 8
USER_AGENT = "ZenRun/1.0 (+https://zenrun.co)"

# Per-leg fallback densification — the straight line between two
# waypoints is split into this many evenly-spaced intermediate points so
# the rendered map line looks smooth instead of zig-zaggy.
FALLBACK_POINTS_PER_LEG = 30


# ----------------------------------------------------------------------
#  Public API
# ----------------------------------------------------------------------


def plan_route(
    waypoints: List[Dict[str, Any]],
    *,
    home_city_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve named waypoints into coordinates and stitch a route.

    Args:
        waypoints: ordered list of `{"name": str, "note": str?, "lat": float?, "lng": float?}`
            dicts. `lat`/`lng` are optional — when missing we forward-
            geocode the name via Nominatim, biasing the search by the
            user's home city when known.
        home_city_hint: e.g. "London". Appended to the search query when
            the waypoint name is short or ambiguous, to prevent
            "Wimbledon" from resolving to a town in North Dakota.

    Returns:
        {
            "waypoints": [
                {"name": ..., "note": ..., "lat": ..., "lng": ..., "resolved": True/False},
                ...
            ],
            "route_polyline": "<google encoded>",
            "estimated_distance_km": float,
            "stitch_method": "osrm" | "straight_line" | "mixed",
        }

    Returns an empty polyline when fewer than 2 waypoints could be
    resolved — the caller should treat that as "no route, fall back to
    plain blurb".
    """
    if not waypoints:
        return _empty_result()

    resolved: List[Dict[str, Any]] = []
    for wp in waypoints:
        name = (wp.get("name") or "").strip()
        if not name:
            continue
        lat = wp.get("lat")
        lng = wp.get("lng")
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            resolved.append(
                {
                    "name": name,
                    "note": (wp.get("note") or "").strip() or None,
                    "lat": float(lat),
                    "lng": float(lng),
                    "resolved": True,
                }
            )
            continue
        coords = _geocode_waypoint(name, home_city_hint=home_city_hint)
        if coords is None:
            # Skip un-geocodable waypoints rather than erroring out — a
            # 7-waypoint route survives losing one.
            logger.info("route_planner: could not geocode waypoint %r", name)
            continue
        resolved.append(
            {
                "name": name,
                "note": (wp.get("note") or "").strip() or None,
                "lat": coords[0],
                "lng": coords[1],
                "resolved": True,
            }
        )

    if len(resolved) < 2:
        return _empty_result(waypoints_resolved=resolved)

    # Stitch.
    legs_points: List[List[Tuple[float, float]]] = []
    method_per_leg: List[str] = []
    for a, b in zip(resolved[:-1], resolved[1:]):
        leg = _route_one_leg(
            (a["lat"], a["lng"]),
            (b["lat"], b["lng"]),
        )
        legs_points.append(leg["points"])
        method_per_leg.append(leg["method"])

    full_points: List[Tuple[float, float]] = []
    for idx, leg_pts in enumerate(legs_points):
        if not leg_pts:
            continue
        if idx == 0:
            full_points.extend(leg_pts)
        else:
            # Avoid duplicating the shared waypoint between legs.
            full_points.extend(leg_pts[1:])

    if len(full_points) < 2:
        return _empty_result(waypoints_resolved=resolved)

    poly = encode_polyline(full_points)
    distance_km = polyline_distance_km(full_points)

    methods = set(method_per_leg)
    stitch_method = (
        "osrm"
        if methods == {"osrm"}
        else "straight_line"
        if methods == {"straight_line"}
        else "mixed"
    )

    return {
        "waypoints": resolved,
        "route_polyline": poly,
        "estimated_distance_km": round(distance_km, 1),
        "stitch_method": stitch_method,
    }


# ----------------------------------------------------------------------
#  Internals
# ----------------------------------------------------------------------


def _empty_result(waypoints_resolved: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    return {
        "waypoints": waypoints_resolved or [],
        "route_polyline": "",
        "estimated_distance_km": 0.0,
        "stitch_method": "none",
    }


def _geocode_waypoint(
    name: str, *, home_city_hint: Optional[str]
) -> Optional[Tuple[float, float]]:
    """Forward-geocode a waypoint name → (lat, lng).

    We use the existing Nominatim wrapper (`services.geocode.search_places`)
    which currently filters out hits without a `city` address component.
    For our purpose we want the *coordinates* even when the name is a
    landmark inside a city — so we duplicate the bare HTTP call here
    with looser filtering and the city hint folded into the query.
    """
    query = name
    if home_city_hint and home_city_hint.lower() not in name.lower():
        # Append city as a soft bias. Nominatim respects free-text hints
        # in the query string better than its `viewbox` parameter for
        # one-shot lookups.
        query = f"{name}, {home_city_hint}"

    params = urllib.parse.urlencode(
        {
            "q": query[:200],
            "format": "jsonv2",
            "limit": 1,
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        logger.info("route_planner: nominatim lookup failed for %r: %s", name, exc)
        return None

    if not data:
        # Try one more time without the city hint — sometimes the LLM
        # already includes the country and the appended hint duplicates
        # it (causes Nominatim to miss).
        if home_city_hint and home_city_hint.lower() in query.lower():
            return _geocode_waypoint_no_hint(name)
        return None

    item = data[0]
    try:
        return float(item["lat"]), float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None


def _geocode_waypoint_no_hint(name: str) -> Optional[Tuple[float, float]]:
    items = search_places(name, limit=1)
    if not items:
        return None
    item = items[0]
    return float(item["lat"]), float(item["lng"])


def _route_one_leg(
    start: Tuple[float, float], end: Tuple[float, float]
) -> Dict[str, Any]:
    """Try OSRM walking routing between two waypoints.

    On success returns the decoded polyline points + "osrm".
    On any failure (timeout, parse error, OSRM 5xx) returns the
    straight-line densified fallback + "straight_line".
    """
    osrm = _osrm_foot_polyline(start, end)
    if osrm is not None and len(osrm) >= 2:
        return {"points": osrm, "method": "osrm"}
    return {"points": _densify_straight_line(start, end), "method": "straight_line"}


def _osrm_foot_polyline(
    start: Tuple[float, float], end: Tuple[float, float]
) -> Optional[List[Tuple[float, float]]]:
    """Hit OSRM's public foot router. Returns decoded polyline or None.

    OSRM expects `lng,lat` — note the order vs. our internal `lat,lng`.
    """
    coord_str = f"{start[1]},{start[0]};{end[1]},{end[0]}"
    url = f"{OSRM_FOOT_URL}/{coord_str}?overview=full&geometries=polyline"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=OSRM_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        logger.info("route_planner: OSRM call failed: %s", exc)
        return None

    if data.get("code") != "Ok":
        return None
    routes = data.get("routes") or []
    if not routes:
        return None
    geom = routes[0].get("geometry")
    if not geom:
        return None
    try:
        return decode_polyline(geom)
    except Exception:
        return None


def _densify_straight_line(
    start: Tuple[float, float],
    end: Tuple[float, float],
    n_intermediate: int = FALLBACK_POINTS_PER_LEG,
) -> List[Tuple[float, float]]:
    """Linear interpolation between two points, with `n_intermediate`
    points strung between (inclusive of both endpoints).

    Good enough for previewing a sketch — the line still cuts through
    buildings, but it gives the runner a sense of the shape and lets
    the map zoom in around the right region. The directions list is
    the source of truth for "where".
    """
    if n_intermediate < 1:
        return [start, end]
    pts: List[Tuple[float, float]] = []
    for i in range(n_intermediate + 1):
        t = i / n_intermediate
        lat = start[0] + (end[0] - start[0]) * t
        lng = start[1] + (end[1] - start[1]) * t
        pts.append((lat, lng))
    return pts
