"""
Reverse geocoding for neighbourhood home city (Nominatim) with DB cache.
"""

from __future__ import annotations

import json
import logging
import math
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HTTP_TIMEOUT = 12
USER_AGENT = "ZenRun/1.0 (+https://zenrun.co)"


def round_key(lat: float, lng: float, decimals: int = 3) -> Tuple[float, float]:
    return (round(lat, decimals), round(lng, decimals))


def reverse_geocode(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Returns dict: city, country (ISO-2), centroid_lat, centroid_lng, raw (optional).
    Uses Nominatim; caller should cache in DB.
    """
    params = urllib.parse.urlencode(
        {
            "lat": lat,
            "lon": lng,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
        }
    )
    url = f"{NOMINATIM_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
        data = json.loads(body)
    except Exception as e:
        logger.warning("Nominatim reverse failed: %s", e)
        return None

    addr = data.get("address") or {}
    # Prefer city, town, village, hamlet, municipality
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("municipality")
        or addr.get("hamlet")
        or addr.get("suburb")
        or addr.get("county")
    )
    if not city:
        city = data.get("display_name", "").split(",")[0].strip() or None
    country = addr.get("country_code")
    if country:
        country = str(country).upper()[:2]

    try:
        clat = float(data.get("lat") or lat)
        clng = float(data.get("lon") or lng)
    except (TypeError, ValueError):
        clat, clng = lat, lng

    if not city:
        return None

    return {
        "city": city[:120],
        "country": country,
        "centroid_lat": clat,
        "centroid_lng": clng,
        "raw": body[:8000],
    }


def search_places(query: str, limit: int = 8) -> list:
    """Nominatim forward search; returns list of place dicts."""
    if not query or len(query.strip()) < 2:
        return []
    q = query.strip()[:200]
    params = urllib.parse.urlencode(
        {
            "q": q,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": min(limit, 10),
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("Nominatim search failed: %s", e)
        return []

    out = []
    for item in data:
        addr = item.get("address") or {}
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("municipality")
            or addr.get("hamlet")
        )
        if not city:
            continue
        country = addr.get("country_code")
        if country:
            country = str(country).upper()[:2]
        try:
            lat = float(item.get("lat"))
            lng = float(item.get("lon"))
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "city": city[:120],
                "country": country,
                "lat": lat,
                "lng": lng,
                "label": item.get("display_name", city)[:200],
            }
        )
        if len(out) >= limit:
            break
    return out
