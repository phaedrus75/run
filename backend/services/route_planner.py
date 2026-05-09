"""
🗺 Route planner — turns Guide-suggested waypoints into a real path.

The Guide's `journey_suggestions` task names ordered waypoints (real
places in the user's home city) and short step-by-step directions. This
module:

1.  Geocodes any waypoint that doesn't already carry a (lat, lng), via
    Nominatim. We persist hits and misses in a dedicated DB cache
    (`waypoint_geocode_cache`) so repeat lookups are free, and we
    throttle live calls to ≥1.1s apart per Nominatim's usage policy.
    Without that throttle, generating a single 8-waypoint suggestion
    fires 8 sub-100ms requests, gets rate-limited by Nominatim, and
    most waypoints fail silently — leaving a stub map with two pins.
2.  Stitches a walkable polyline through the resolved waypoints. We try
    OSRM's public foot-routing demo server first (real walking paths,
    no API key required); on failure or timeout we fall back to a
    straight-line polyline densified to ~30 points per leg so the map
    still renders something cohesive.
3.  Returns the stitched polyline (encoded), the resolved waypoint
    coordinates, a rough distance estimate, and telemetry on how many
    waypoints we proposed vs. how many resolved — so the caller can
    decide whether to drop a particularly broken suggestion entirely.

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
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from .geocode import search_places
from .overpass import decode_polyline, encode_polyline, haversine_km, polyline_distance_km

logger = logging.getLogger(__name__)

# 🗺 Provider selection
# ─────────────────────
# Two layers of providers with the same response shape (LocationIQ is a
# hosted Nominatim/OSRM service):
#
#   - LocationIQ — paid, OSM-backed, 5k req/day on the free tier at
#     2 req/s. Used when LOCATIONIQ_API_KEY is set.
#   - Public OSM (Nominatim + OSRM demo) — free, 1 req/s, fragile under
#     burst load. Fallback when no LocationIQ key is set.
#
# Both responses are interchangeable, so the rest of the planner doesn't
# care which one served the request.

OSRM_PUBLIC_URL = "https://router.project-osrm.org/route/v1/foot"
NOMINATIM_PUBLIC_URL = "https://nominatim.openstreetmap.org/search"

LOCATIONIQ_API_KEY = os.environ.get("LOCATIONIQ_API_KEY", "").strip() or None
LOCATIONIQ_HOST = os.environ.get("LOCATIONIQ_HOST", "us1").strip().lower() or "us1"
LOCATIONIQ_GEOCODE_URL = f"https://{LOCATIONIQ_HOST}.locationiq.com/v1/search"
# LocationIQ Directions API speaks OSRM's response shape; the path
# segment after `/v1/directions/` selects the profile (driving | foot |
# bike). We always want walking paths.
LOCATIONIQ_FOOT_URL = f"https://{LOCATIONIQ_HOST}.locationiq.com/v1/directions/foot"

USING_LOCATIONIQ = bool(LOCATIONIQ_API_KEY)

GEOCODE_TIMEOUT_S = 8
ROUTE_TIMEOUT_S = 8
USER_AGENT = "ZenRun/1.0 (+https://zenrun.co)"

# Per-leg fallback densification — the straight line between two
# waypoints is split into this many evenly-spaced intermediate points so
# the rendered map line looks smooth instead of zig-zaggy.
FALLBACK_POINTS_PER_LEG = 30

# 🌐 Throttle interval per provider.
# Nominatim public: hard cap 1 req/s by usage policy. We pad to 1.1s.
# LocationIQ free:  2 req/s — we pad to 0.55s so a burst doesn't trip
#                   their rate limiter. Paid plans are higher; if you
#                   upgrade, override via LOCATIONIQ_MIN_INTERVAL_S.
_NOMINATIM_MIN_INTERVAL_S = 1.1
_LOCATIONIQ_MIN_INTERVAL_S = float(
    os.environ.get("LOCATIONIQ_MIN_INTERVAL_S", "0.55")
)
_GEOCODE_MIN_INTERVAL_S = (
    _LOCATIONIQ_MIN_INTERVAL_S if USING_LOCATIONIQ else _NOMINATIM_MIN_INTERVAL_S
)

# Process-global lock for the throttle. Uvicorn workers each hold their
# own copy, but per-worker is fine — the goal is to spread bursts, not
# to globally rate-limit across multiple machines.
_geocode_lock = threading.Lock()
_geocode_last_call = 0.0  # monotonic seconds

if USING_LOCATIONIQ:
    logger.info(
        "route_planner: using LocationIQ (host=%s, throttle=%.2fs)",
        LOCATIONIQ_HOST,
        _GEOCODE_MIN_INTERVAL_S,
    )
else:
    logger.info(
        "route_planner: using public Nominatim/OSRM (throttle=%.2fs). "
        "Set LOCATIONIQ_API_KEY for production traffic.",
        _GEOCODE_MIN_INTERVAL_S,
    )


def _throttle_geocode() -> None:
    """Sleep until at least the configured interval has passed since the
    previous live geocode/routing call from this process. Re-entrant
    safe; per-worker scope (good enough for spreading bursts)."""
    global _geocode_last_call
    with _geocode_lock:
        now = time.monotonic()
        elapsed = now - _geocode_last_call
        if elapsed < _GEOCODE_MIN_INTERVAL_S:
            time.sleep(_GEOCODE_MIN_INTERVAL_S - elapsed)
        _geocode_last_call = time.monotonic()


def _normalise_query(s: str) -> str:
    """Lower-case + whitespace-collapsed form for cache keys."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _cache_key(query: str, hint: Optional[str]) -> str:
    # Cache keys are provider-prefixed so a switch from Nominatim to
    # LocationIQ doesn't return stale lat/lng (LocationIQ uses the same
    # OSM data so collisions would be harmless, but we still want
    # provider-level observability and clean rollback).
    provider = "locationiq" if USING_LOCATIONIQ else "nominatim"
    base = f"{provider}|{_normalise_query(query)}"
    if hint:
        base += "||" + _normalise_query(hint)
    return base[:300]


# ----------------------------------------------------------------------
#  Public API
# ----------------------------------------------------------------------


def plan_route(
    waypoints: List[Dict[str, Any]],
    *,
    home_city_hint: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Resolve named waypoints into coordinates and stitch a route.

    Args:
        waypoints: ordered list of `{"name": str, "note": str?, "lat": float?, "lng": float?}`
            dicts. `lat`/`lng` are optional — when missing we forward-
            geocode the name via Nominatim, biasing the search by the
            user's home city when known.
        home_city_hint: e.g. "London". Folded into the search query so
            short / ambiguous names ("Wimbledon") resolve to the
            user's actual neighbourhood rather than the first global
            match.
        db: optional SQLAlchemy session. When provided, geocoded
            waypoint names are read from / written to the
            `waypoint_geocode_cache` table; this is the recommended
            path. When absent, every miss hits Nominatim live which
            saturates the rate limit on routes with many waypoints.

    Returns:
        {
            "waypoints": [
                {"name": ..., "note": ..., "lat": ..., "lng": ..., "resolved": True/False},
                ...
            ],
            "route_polyline": "<google encoded>",
            "estimated_distance_km": float,
            "stitch_method": "osrm" | "straight_line" | "mixed",
            "proposed_count": int,    # how many waypoints the LLM gave us
            "resolved_count": int,    # how many we got coordinates for
        }

    Returns an empty polyline when fewer than 2 waypoints could be
    resolved — the caller should treat that as "no route, fall back to
    plain blurb".
    """
    proposed_count = sum(
        1
        for wp in (waypoints or [])
        if isinstance(wp, dict) and (wp.get("name") or "").strip()
    )
    if not waypoints:
        return _empty_result(proposed_count=proposed_count)

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
        coords = _geocode_waypoint_with_cache(
            name, home_city_hint=home_city_hint, db=db
        )
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

    resolved_count = len(resolved)
    if resolved_count < 2:
        return _empty_result(
            waypoints_resolved=resolved,
            proposed_count=proposed_count,
            resolved_count=resolved_count,
        )

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

    # Summarise the leg-by-leg routing source. If every leg used the
    # same routing provider (osrm or locationiq), report that. If every
    # leg fell back to the straight-line stitcher, report that. Any
    # mix lands on "mixed" — useful telemetry for spotting flaky legs.
    methods = set(method_per_leg)
    if len(methods) == 1:
        stitch_method = next(iter(methods))
    else:
        stitch_method = "mixed"

    return {
        "waypoints": resolved,
        "route_polyline": poly,
        "estimated_distance_km": round(distance_km, 1),
        "stitch_method": stitch_method,
        "proposed_count": proposed_count,
        "resolved_count": resolved_count,
    }


# ----------------------------------------------------------------------
#  Internals
# ----------------------------------------------------------------------


def _empty_result(
    waypoints_resolved: Optional[List[Dict[str, Any]]] = None,
    *,
    proposed_count: int = 0,
    resolved_count: int = 0,
) -> Dict[str, Any]:
    return {
        "waypoints": waypoints_resolved or [],
        "route_polyline": "",
        "estimated_distance_km": 0.0,
        "stitch_method": "none",
        "proposed_count": proposed_count,
        "resolved_count": resolved_count,
    }


def _geocode_waypoint_with_cache(
    name: str,
    *,
    home_city_hint: Optional[str],
    db: Optional[Session],
) -> Optional[Tuple[float, float]]:
    """Forward-geocode a waypoint name with DB cache + Nominatim throttle.

    Order of operations:
      1. DB cache lookup keyed on (normalised query, normalised hint).
         Hits short-circuit; remembered misses also short-circuit so a
         genuinely unknown name never hits Nominatim more than once.
      2. Live Nominatim call, throttled to ≤1 req/s globally per worker.
         We try up to three query variants — full "name, city", bare
         name, and a softened name with punctuation stripped — to give
         landmark-style names a fighting chance.
      3. Persist the result (success or miss) back to the cache.

    Returns the resolved (lat, lng) or None.
    """
    # 1. Cache lookup.
    cached = _cache_lookup(db, name, home_city_hint)
    if cached is not None:
        if cached.resolved and cached.lat is not None and cached.lng is not None:
            return float(cached.lat), float(cached.lng)
        # Remembered miss — don't bother Nominatim again.
        return None

    # 2. Live Nominatim — try a few query forms before giving up.
    coords = _geocode_live_with_retries(name, home_city_hint=home_city_hint)

    # 3. Persist hit or miss for next time.
    _cache_persist(db, name, home_city_hint, coords)
    return coords


def _geocode_live_with_retries(
    name: str, *, home_city_hint: Optional[str]
) -> Optional[Tuple[float, float]]:
    """Hit Nominatim with up to three query variants, throttled."""
    seen: set = set()
    queries: List[str] = []

    # Variant 1: name + city hint (when the name doesn't already contain it).
    if home_city_hint and home_city_hint.lower() not in name.lower():
        queries.append(f"{name}, {home_city_hint}")
    # Variant 2: name as the LLM gave it.
    queries.append(name)
    # Variant 3: name with sloppy punctuation softened — drop apostrophes
    # and double spaces; sometimes Nominatim chokes on the LLM's exact
    # punctuation but accepts the bare phrase.
    softened = re.sub(r"[’'`]", "", name)
    softened = re.sub(r"\s+", " ", softened).strip()
    if softened and softened != name:
        queries.append(softened)

    for q in queries:
        norm = _normalise_query(q)
        if norm in seen or not norm:
            continue
        seen.add(norm)
        coords = _nominatim_search_one(q)
        if coords is not None:
            return coords
    return None


def _nominatim_search_one(query: str) -> Optional[Tuple[float, float]]:
    """Single throttled forward-geocode → (lat, lng) or None.

    Routes to LocationIQ when LOCATIONIQ_API_KEY is set, falling back to
    the public Nominatim instance otherwise. Both speak the same
    response shape, so the rest of the planner is provider-agnostic.

    The function name is kept for historical reasons and to avoid
    churning callers — "Nominatim" here really means "Nominatim or its
    drop-in compatible service".
    """
    _throttle_geocode()
    if USING_LOCATIONIQ:
        params = urllib.parse.urlencode(
            {
                "key": LOCATIONIQ_API_KEY,
                "q": query[:200],
                "format": "json",
                "limit": 1,
                # `normalizecity=1` keeps responses compact + drops the
                # huge `display_name` we don't need.
                "normalizecity": 1,
            }
        )
        url = f"{LOCATIONIQ_GEOCODE_URL}?{params}"
        provider_label = "locationiq"
    else:
        params = urllib.parse.urlencode(
            {
                "q": query[:200],
                "format": "jsonv2",
                "limit": 1,
            }
        )
        url = f"{NOMINATIM_PUBLIC_URL}?{params}"
        provider_label = "nominatim"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=GEOCODE_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        logger.info(
            "route_planner: %s lookup failed for %r: %s",
            provider_label,
            query,
            exc,
        )
        return None
    if not data:
        return None
    # LocationIQ returns the same flat list-of-dicts as Nominatim.
    item = data[0] if isinstance(data, list) else data
    try:
        return float(item["lat"]), float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None


# ---- Cache helpers ----------------------------------------------------
#
# We import `WaypointGeocodeCache` lazily so the planner module can be
# loaded in tooling that doesn't have the full SQLAlchemy stack
# initialised (e.g. ad-hoc scripts).


def _cache_lookup(
    db: Optional[Session], query: str, hint: Optional[str]
):
    if db is None:
        return None
    try:
        from models import WaypointGeocodeCache  # type: ignore

        key = _cache_key(query, hint)
        return (
            db.query(WaypointGeocodeCache)
            .filter(WaypointGeocodeCache.cache_key == key)
            .first()
        )
    except Exception as exc:  # pragma: no cover
        logger.info("route_planner: cache lookup failed: %s", exc)
        return None


def _cache_persist(
    db: Optional[Session],
    query: str,
    hint: Optional[str],
    coords: Optional[Tuple[float, float]],
) -> None:
    if db is None:
        return
    try:
        from models import WaypointGeocodeCache  # type: ignore

        key = _cache_key(query, hint)
        # Defensive: avoid races / unique-violation on parallel suggestion
        # generation by checking for an existing row first.
        existing = (
            db.query(WaypointGeocodeCache)
            .filter(WaypointGeocodeCache.cache_key == key)
            .first()
        )
        if existing is not None:
            return
        row = WaypointGeocodeCache(
            cache_key=key,
            query=query[:300],
            city_hint=(hint or None),
            lat=coords[0] if coords else None,
            lng=coords[1] if coords else None,
            resolved=coords is not None,
        )
        db.add(row)
        db.commit()
    except Exception as exc:  # pragma: no cover
        logger.info("route_planner: cache persist failed: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


def _route_one_leg(
    start: Tuple[float, float], end: Tuple[float, float]
) -> Dict[str, Any]:
    """Try walking routing between two waypoints.

    On success returns the decoded polyline points + the provider label
    ("osrm" or "locationiq"). On any failure (timeout, parse error,
    upstream 5xx) returns the straight-line densified fallback +
    "straight_line".
    """
    routed = _osrm_foot_polyline(start, end)
    if routed is not None and len(routed) >= 2:
        method = "locationiq" if USING_LOCATIONIQ else "osrm"
        return {"points": routed, "method": method}
    return {"points": _densify_straight_line(start, end), "method": "straight_line"}


def _osrm_foot_polyline(
    start: Tuple[float, float], end: Tuple[float, float]
) -> Optional[List[Tuple[float, float]]]:
    """Hit a foot-routing service. Returns decoded polyline or None.

    Routes to LocationIQ Directions when LOCATIONIQ_API_KEY is set,
    falling back to OSRM's public demo otherwise. Both speak OSRM's
    response shape so we parse the same way for either.

    Coordinate order: the URL takes `lng,lat;lng,lat` (note the swap
    vs. our internal `lat,lng`).
    """
    _throttle_geocode()  # share the same throttle as geocoding
    coord_str = f"{start[1]},{start[0]};{end[1]},{end[0]}"

    if USING_LOCATIONIQ:
        params = urllib.parse.urlencode(
            {
                "key": LOCATIONIQ_API_KEY,
                "overview": "full",
                "geometries": "polyline",
            }
        )
        url = f"{LOCATIONIQ_FOOT_URL}/{coord_str}?{params}"
        provider_label = "locationiq"
    else:
        url = (
            f"{OSRM_PUBLIC_URL}/{coord_str}"
            f"?overview=full&geometries=polyline"
        )
        provider_label = "osrm-public"

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=ROUTE_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        logger.info("route_planner: %s call failed: %s", provider_label, exc)
        return None

    if data.get("code") not in (None, "Ok"):
        # OSRM/LocationIQ both use code="Ok" on success. Any other
        # truthy code is an error condition.
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
