"""
🌍 Overpass / OpenStreetMap integration
=======================================

Fetches public walking routes from OpenStreetMap via the Overpass API and
turns them into ``PublicWalk`` rows. Stays dependency-free by using
``urllib`` so we don't have to ship ``requests`` to the prod image.

Key concepts:
- A bounding box around a (lat, lng) center is queried for OSM relations
  tagged ``route=hiking`` or ``route=foot``.
- For every relation we collect the GPS positions of its member ``ways``,
  estimate the total distance via the Haversine formula and encode the
  resulting polyline using Google's Encoded Polyline Algorithm.
- Each result is upserted via ``crud.upsert_public_walk`` so subsequent
  requests are served straight from the cache.

The Overpass endpoint is rate-limited and occasionally slow; callers
should treat ``discover_public_walks`` as best-effort and fall back to the
DB cache on failure.
"""

from __future__ import annotations

import json
import logging
import math
import urllib.parse
import urllib.request
from typing import Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# A short timeout keeps API requests snappy; if Overpass is having a bad
# day we fall back to the cache.
HTTP_TIMEOUT = 25  # seconds
USER_AGENT = "ZenRun/1.0 (+https://zenrun.app)"


# ----------------------------------------------------------------------
#  Geometry helpers
# ----------------------------------------------------------------------

EARTH_RADIUS_KM = 6371.0


def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lng) points in km."""
    lat1, lng1 = a
    lat2, lng2 = b
    rlat1 = math.radians(lat1)
    rlat2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def polyline_distance_km(points: List[Tuple[float, float]]) -> float:
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(points)):
        total += haversine_km(points[i - 1], points[i])
    return total


def encode_polyline(points: List[Tuple[float, float]]) -> str:
    """Google Encoded Polyline Algorithm Format (precision 5)."""

    def encode_signed(value: int) -> str:
        value = ~(value << 1) if value < 0 else (value << 1)
        chunks = []
        while value >= 0x20:
            chunks.append(chr((0x20 | (value & 0x1F)) + 63))
            value >>= 5
        chunks.append(chr(value + 63))
        return "".join(chunks)

    out: List[str] = []
    prev_lat = 0
    prev_lng = 0
    for lat, lng in points:
        lat_e5 = int(round(lat * 1e5))
        lng_e5 = int(round(lng * 1e5))
        out.append(encode_signed(lat_e5 - prev_lat))
        out.append(encode_signed(lng_e5 - prev_lng))
        prev_lat, prev_lng = lat_e5, lng_e5
    return "".join(out)


def decode_polyline(encoded: str) -> List[Tuple[float, float]]:
    """Decode Google Encoded Polyline (precision 5) to [(lat, lng), ...]."""
    if not encoded or not isinstance(encoded, str):
        return []
    index = 0
    lat = 0
    lng = 0
    points: List[Tuple[float, float]] = []
    length = len(encoded)

    def read_varint() -> int:
        nonlocal index
        result = 0
        shift = 0
        while index < length:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        return ~(result >> 1) if (result & 1) else (result >> 1)

    while index < length:
        lat += read_varint()
        lng += read_varint()
        points.append((lat / 1e5, lng / 1e5))
    return points


def bbox_around(lat: float, lng: float, radius_km: float) -> Tuple[float, float, float, float]:
    """Return (south, west, north, east) approx bbox around a point."""
    deg_per_km_lat = 1.0 / 111.0
    deg_per_km_lng = 1.0 / (111.0 * max(0.01, math.cos(math.radians(lat))))
    south = lat - radius_km * deg_per_km_lat
    north = lat + radius_km * deg_per_km_lat
    west = lng - radius_km * deg_per_km_lng
    east = lng + radius_km * deg_per_km_lng
    return south, west, north, east


# ----------------------------------------------------------------------
#  Overpass client
# ----------------------------------------------------------------------

def _build_query(bbox: Tuple[float, float, float, float], limit: int) -> str:
    south, west, north, east = bbox
    # We ask Overpass to return relation members with their geometry inline
    # so that we don't have to fire a second request per route.
    # ``out geom;`` includes the way nodes' lat/lng directly.
    return (
        f"[out:json][timeout:25];\n"
        f"(\n"
        f"  relation[\"route\"~\"hiking|foot|walking\"]({south},{west},{north},{east});\n"
        f");\n"
        f"out geom {min(limit, 50)};"
    )


def _fetch_overpass(query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        body = resp.read()
    return json.loads(body.decode("utf-8"))


def _flatten_relation_geometry(element: dict) -> List[Tuple[float, float]]:
    """Stitch a relation's ``way`` members into a single ordered point list.

    Overpass returns members in route order, but each individual way can be
    forwards or reversed. We greedily flip ways so consecutive endpoints
    match — good enough for cached preview polylines.
    """
    points: List[Tuple[float, float]] = []
    for member in element.get("members", []):
        if member.get("type") != "way":
            continue
        geom = member.get("geometry") or []
        coords = [(g["lat"], g["lon"]) for g in geom if "lat" in g and "lon" in g]
        if not coords:
            continue
        if not points:
            points.extend(coords)
            continue
        # Reverse this segment if its first point is farther from the running
        # endpoint than its last point — keeps the line continuous.
        last = points[-1]
        if haversine_km(last, coords[-1]) < haversine_km(last, coords[0]):
            coords = list(reversed(coords))
        # Skip the duplicated joining point if very close.
        if haversine_km(last, coords[0]) < 0.01:
            coords = coords[1:]
        points.extend(coords)
    return points


def _difficulty_from_tags(tags: dict) -> Optional[str]:
    sac = (tags.get("sac_scale") or "").lower()
    if sac:
        if "alpine" in sac or "difficult" in sac:
            return "hard"
        if "demanding" in sac or "mountain" in sac:
            return "moderate"
        return "easy"
    osmc = (tags.get("osmc:symbol") or "").lower()
    if "red" in osmc:
        return "moderate"
    if "black" in osmc:
        return "hard"
    return "easy"


def _country_from_tags(tags: dict) -> Optional[str]:
    return tags.get("addr:country") or tags.get("country") or None


def _region_from_tags(tags: dict) -> Optional[str]:
    return (
        tags.get("addr:state")
        or tags.get("addr:region")
        or tags.get("region")
        or tags.get("operator")
    )


def parse_overpass_payload(payload: dict, *, max_results: int = 50) -> List[dict]:
    """Convert raw Overpass JSON into ready-to-upsert PublicWalk dicts."""
    results: List[dict] = []
    for element in payload.get("elements", []):
        if element.get("type") != "relation":
            continue
        tags = element.get("tags") or {}
        name = tags.get("name") or tags.get("ref")
        if not name:
            continue
        coords = _flatten_relation_geometry(element)
        if len(coords) < 4:
            continue
        distance_km = polyline_distance_km(coords)
        if distance_km < 0.5 or distance_km > 100:
            # Filter degenerate / massive routes (long-distance trails)
            continue
        polyline = encode_polyline(coords)
        results.append(
            {
                "osm_id": f"relation/{element.get('id')}",
                "name": name,
                "description": tags.get("description") or tags.get("note"),
                "distance_km": round(distance_km, 2),
                # Walking pace ~ 12 min/km
                "estimated_duration_min": int(round(distance_km * 12)),
                "difficulty": _difficulty_from_tags(tags),
                "route_polyline": polyline,
                "start_lat": coords[0][0],
                "start_lng": coords[0][1],
                "region": _region_from_tags(tags),
                "country": _country_from_tags(tags),
                "tags": ",".join(
                    [v for k, v in tags.items() if k in ("route", "network", "sac_scale") and v]
                )
                or None,
                "source": "osm",
            }
        )
        if len(results) >= max_results:
            break
    return results


def discover_public_walks(
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    limit: int = 25,
) -> List[dict]:
    """Query Overpass around (lat,lng) and return parsed walk dicts.

    Returns an empty list on any network/parse failure so callers can fall
    back to the cached DB rows without raising.
    """
    bbox = bbox_around(lat, lng, radius_km)
    query = _build_query(bbox, limit)
    try:
        payload = _fetch_overpass(query)
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.warning("Overpass request failed: %s", exc)
        return []
    try:
        return parse_overpass_payload(payload, max_results=limit)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Overpass parse failed: %s", exc)
        return []


def filter_by_distance(
    walks: Iterable[dict],
    lat: float,
    lng: float,
    radius_km: float,
) -> List[dict]:
    """Drop walks whose start point is farther than ``radius_km`` away."""
    out: List[dict] = []
    for w in walks:
        if haversine_km((lat, lng), (w["start_lat"], w["start_lng"])) <= radius_km:
            out.append(w)
    return out
