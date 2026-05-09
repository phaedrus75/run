/**
 * 🗺 JourneyRouteScreen
 * =====================
 *
 * Full-screen view of a Guide-recommended journey route. The user lands
 * here by tapping the preview map block on either `JourneyPreviewScreen`
 * or `JourneyDetailScreen` (planned state). The map fills the whole
 * viewport, supports pinch / pan / zoom, and the directions list slides
 * up from the bottom as a draggable sheet so the user can read the
 * steps without losing the map.
 *
 * Pure read-only — no actions, no plan / start CTAs. We're just giving
 * the runner space to read the route.
 */

import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { JourneyWaypoint } from '../services/api';
import { MapMarker, MapPoint, WalkMap } from '../components/WalkMap';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
  route: {
    params?: {
      title?: string;
      tier?: string;
      target_distance_km?: number;
      max_days?: number;
      route_polyline?: string;
      waypoints?: JourneyWaypoint[];
      directions?: string[];
    };
  };
}

// Same decoder as JourneyPreviewMap; kept inline so this screen has zero
// dependency on the preview component.
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
  const latKm = (maxLat - minLat) * 111;
  const midLat = (maxLat + minLat) / 2;
  const lngKm = (maxLng - minLng) * 111 * Math.cos((midLat * Math.PI) / 180);
  const span = Math.max(latKm, lngKm);
  if (span <= 0) return 14;
  // Slightly looser zoom than the preview thumbnail so the route has
  // breathing room on a full-screen canvas.
  if (span <= 2) return 14;
  if (span <= 5) return 13;
  if (span <= 10) return 12;
  if (span <= 20) return 11;
  if (span <= 40) return 10.3;
  return 9.5;
}

export function JourneyRouteScreen({ navigation, route }: Props) {
  const params = route?.params || {};
  const polyline = params.route_polyline || '';
  const waypoints = params.waypoints || [];
  const directions = params.directions || [];

  const points: MapPoint[] = useMemo(() => decodePolyline(polyline), [polyline]);
  const center: MapPoint | undefined = points[0];
  const zoom = zoomForRoute(points);

  const markers: MapMarker[] = useMemo(() => {
    if (!waypoints.length) return [];
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

  const meta =
    params.target_distance_km != null
      ? `${params.target_distance_km.toFixed(0)} km · ${
          (params.max_days ?? 1) <= 1 ? '1 day' : `up to ${params.max_days} days`
        }`
      : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title || 'Route'}
          </Text>
          {meta ? <Text style={styles.headerMeta}>{meta}</Text> : null}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.mapWrap}>
        {points.length >= 2 ? (
          <WalkMap
            style={styles.map}
            centerOn={center}
            zoom={zoom}
            route={points}
            routeColor={colors.primary}
            routeWidth={5}
            markers={markers.length ? markers : undefined}
            interactive
            showUserLocation={false}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={32} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No route to draw</Text>
            <Text style={styles.emptyHint}>
              The Guide didn't ship a path with this journey. Read the
              directions below — they're the source of truth.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>Step by step</Text>
          {directions.length > 0 ? (
            directions.map((step, idx) => (
              <View key={`step-${idx}`} style={styles.row}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{idx + 1}</Text>
                </View>
                <Text style={styles.rowText}>{step}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyHint}>
              No directions for this journey yet.
            </Text>
          )}

          {waypoints.length > 0 ? (
            <>
              <Text style={[styles.sheetTitle, styles.sheetTitleSpaced]}>
                Waypoints
              </Text>
              {waypoints.map((wp, idx) => (
                <View key={`wp-${idx}`} style={styles.row}>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.wpName}>{wp.name}</Text>
                    {wp.note ? (
                      <Text style={styles.wpNote}>{wp.note}</Text>
                    ) : null}
                    {wp.lat == null || wp.lng == null ? (
                      <Text style={styles.wpUnresolved}>
                        Couldn't pin this one — read the step instead.
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  map: { flex: 1, borderRadius: 0 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  emptyHint: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '45%',
    ...Platform.select({
      ios: shadows.medium,
      android: { elevation: 8 },
      default: {},
    }),
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  sheetTitleSpaced: { marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  rowText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  wpName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
    lineHeight: 20,
  },
  wpNote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  wpUnresolved: {
    fontSize: typography.sizes.xs,
    color: colors.warning ?? colors.textLight,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
