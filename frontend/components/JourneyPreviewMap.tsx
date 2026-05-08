/**
 * 🗺 JourneyPreviewMap
 * =====================
 *
 * The map block shown above the readiness note on `JourneyPreviewScreen`,
 * and on `JourneyDetailScreen` while the journey is in `planned` state.
 *
 * A journey doesn't have a fixed route — the runner accumulates distance
 * across whatever GPS runs and walks they do inside the window. So this
 * map isn't "the route", it's *the runner's usual ground*: their home
 * pin, plus a handful of recent activity polylines drawn faintly as
 * background context. It anchors the preview in a real place instead of
 * floating abstract numbers.
 *
 * If the runner has no home set and no GPS history, we render a soft
 * placeholder so the screen never looks broken.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { JourneyMapContext, JourneyWaypoint } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';
import { MapMarker, MapPoint, WalkMap } from './WalkMap';

// Decode a Google encoded polyline string into [{lat, lng}] points.
// Lifted here so the map can render Guide-stitched routes without
// pulling in a separate dependency. Identical algorithm to the
// backend `services.overpass.decode_polyline` and to the standard
// Google polyline format used everywhere in the app.
function decodePolyline(encoded: string): MapPoint[] {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points: MapPoint[] = [];
  const len = encoded.length;
  while (index < len) {
    let result = 0;
    let shift = 0;
    let b = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

interface Props {
  context: JourneyMapContext | null;
  /** Guide-recommended route polyline (Google encoded). When present,
   *  this is the *primary* line drawn on the map (bold, in the primary
   *  colour). When absent, the map renders the "your usual ground"
   *  context (home pin + faint recent activity routes). */
  routePolyline?: string;
  /** Numbered waypoint pins to drop on top of the recommended route.
   *  Only entries with valid lat/lng are shown. */
  waypoints?: JourneyWaypoint[];
  /** Optional override for the caption headline ("Your usual ground"). */
  title?: string;
  /** Optional human-readable distance label, e.g. "20 km · 1 day". */
  metaLabel?: string;
}

// Convert a soft km radius into a roughly equivalent expo-maps zoom level.
// expo-maps zoom is the standard web-tiles 0–20 scale; these numbers are
// rule-of-thumb anchors that look right on a phone for the slow-ultra
// tiers (6 km → 20 → 25 km radius).
function zoomForRadius(radiusKm: number | null | undefined): number {
  if (!radiusKm || radiusKm <= 0) return 12;
  if (radiusKm <= 6) return 12.5;
  if (radiusKm <= 9) return 12;
  if (radiusKm <= 14) return 11.3;
  if (radiusKm <= 17) return 11;
  if (radiusKm <= 20) return 10.7;
  return 10;
}

export function JourneyPreviewMap({
  context,
  routePolyline,
  waypoints,
  title,
  metaLabel,
}: Props) {
  // Decode the recommended path once per render. Empty array if none.
  const primaryRoute: MapPoint[] = useMemo(() => {
    if (!routePolyline) return [];
    try {
      return decodePolyline(routePolyline);
    } catch {
      return [];
    }
  }, [routePolyline]);

  const hasRoute = primaryRoute.length >= 2;

  // Numbered waypoint markers (only those with resolved lat/lng).
  const waypointMarkers: MapMarker[] = useMemo(() => {
    if (!waypoints?.length) return [];
    let n = 0;
    const out: MapMarker[] = [];
    for (const wp of waypoints) {
      if (wp.lat == null || wp.lng == null) continue;
      n += 1;
      out.push({
        id: `wp-${n}`,
        lat: wp.lat,
        lng: wp.lng,
        title: `${n}. ${wp.name}`,
        tintColor: colors.primary,
      });
    }
    return out;
  }, [waypoints]);

  const homePoint: MapPoint | null = useMemo(() => {
    if (!context) return null;
    if (context.home_lat != null && context.home_lng != null) {
      return { lat: context.home_lat, lng: context.home_lng };
    }
    return null;
  }, [context]);

  // Map centre: when there's a recommended path we centre on its first
  // point; otherwise we fall back to home (or the centroid of recent
  // routes the backend pre-baked into the context).
  const center: MapPoint | null = useMemo(() => {
    if (hasRoute) return primaryRoute[0];
    return homePoint;
  }, [hasRoute, primaryRoute, homePoint]);

  // Background polylines — recent activity routes from the user's
  // history. We hide these when a recommended route is present so the
  // primary line stays visually clean and unambiguous.
  const extraRoutes: MapPoint[][] = useMemo(() => {
    if (hasRoute) return [];
    if (!context?.recent_routes?.length) return [];
    return context.recent_routes
      .filter((r) => r && r.length >= 2)
      .map((r) => r.map(([lat, lng]) => ({ lat, lng })));
  }, [hasRoute, context]);

  // Markers: numbered waypoints when there's a route, otherwise the
  // home pin (only if known).
  const markers: MapMarker[] | undefined = useMemo(() => {
    if (hasRoute) return waypointMarkers.length ? waypointMarkers : undefined;
    if (homePoint) {
      return [
        {
          id: 'journey-home',
          lat: homePoint.lat,
          lng: homePoint.lng,
          title: context?.home_city || 'Home',
          tintColor: colors.primary,
        },
      ];
    }
    return undefined;
  }, [hasRoute, waypointMarkers, homePoint, context]);

  // Zoom: recommended routes auto-zoom from the polyline (we let
  // WalkMap centre and the user can pan). For the usual-ground fallback
  // we use the per-tier soft radius.
  const zoom = hasRoute
    ? zoomForRoute(primaryRoute)
    : zoomForRadius(context?.suggested_radius_km ?? null);

  const isEmpty = !hasRoute && !center && extraRoutes.length === 0;
  const captionTitle = title || (hasRoute ? 'Recommended path' : 'Your usual ground');

  return (
    <View style={styles.wrap}>
      <View style={styles.mapBox}>
        {isEmpty ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={28} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Your map will fill in</Text>
            <Text style={styles.emptyHint}>
              Once you've saved a couple of GPS runs or walks, the journey
              preview will show where you usually move.
            </Text>
          </View>
        ) : (
          <WalkMap
            style={styles.map}
            centerOn={center || undefined}
            zoom={zoom}
            route={hasRoute ? primaryRoute : undefined}
            routeColor={colors.primary}
            routeWidth={5}
            markers={markers}
            extraRoutes={extraRoutes}
            extraRouteColor={colors.primary}
            extraRouteWidth={3}
            showUserLocation={false}
          />
        )}
      </View>
      <View style={styles.captionRow}>
        <View style={styles.captionLeft}>
          <Ionicons
            name={hasRoute ? 'navigate-outline' : 'compass-outline'}
            size={14}
            color={colors.textLight}
          />
          <Text style={styles.captionTitle}>{captionTitle}</Text>
        </View>
        {metaLabel ? <Text style={styles.captionMeta}>{metaLabel}</Text> : null}
      </View>
      {hasRoute ? (
        <Text style={styles.subCaption}>
          A walkable line stitched through the waypoints below. Treat the
          directions as the source of truth — the line is a sketch.
        </Text>
      ) : extraRoutes.length > 0 ? (
        <Text style={styles.subCaption}>
          The faint lines are your last few runs and walks — the journey
          adds up across whatever you do from here.
        </Text>
      ) : center ? (
        <Text style={styles.subCaption}>
          Centered on{' '}
          {context?.home_city ? `${context.home_city}.` : 'your home.'} The
          journey adds up across whatever runs and walks you do.
        </Text>
      ) : null}
    </View>
  );
}

// Pick a zoom level that comfortably frames a polyline of `pts` points.
// We compute the bounding-box span and bucket it into the same scale
// `zoomForRadius` uses; this keeps the feel consistent across both
// fallback and recommended-route renders.
function zoomForRoute(pts: MapPoint[]): number {
  if (!pts.length) return 12;
  let minLat = pts[0].lat;
  let maxLat = pts[0].lat;
  let minLng = pts[0].lng;
  let maxLng = pts[0].lng;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  // Approximate km span — 111km per degree of latitude, scaled by
  // cosine for longitude. We just need a rough number for bucketing.
  const latKm = (maxLat - minLat) * 111;
  const midLat = (maxLat + minLat) / 2;
  const lngKm = (maxLng - minLng) * 111 * Math.cos((midLat * Math.PI) / 180);
  const span = Math.max(latKm, lngKm);
  // Half-span is a reasonable proxy for the radius bucket.
  return zoomForRadius(span / 2);
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  mapBox: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    ...shadows.small,
  },
  map: {
    flex: 1,
    borderRadius: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  emptyTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  emptyHint: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  captionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captionTitle: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
  },
  captionMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  subCaption: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
});
