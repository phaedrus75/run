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

import { JourneyMapContext } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';
import { MapPoint, WalkMap } from './WalkMap';

interface Props {
  context: JourneyMapContext | null;
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

export function JourneyPreviewMap({ context, title, metaLabel }: Props) {
  const center: MapPoint | null = useMemo(() => {
    if (!context) return null;
    if (context.home_lat != null && context.home_lng != null) {
      return { lat: context.home_lat, lng: context.home_lng };
    }
    return null;
  }, [context]);

  const extraRoutes: MapPoint[][] = useMemo(() => {
    if (!context?.recent_routes?.length) return [];
    return context.recent_routes
      .filter((r) => r && r.length >= 2)
      .map((r) => r.map(([lat, lng]) => ({ lat, lng })));
  }, [context]);

  const markers = useMemo(() => {
    if (!center) return undefined;
    return [
      {
        id: 'journey-home',
        lat: center.lat,
        lng: center.lng,
        title: context?.home_city || 'Home',
        tintColor: colors.primary,
      },
    ];
  }, [center, context]);

  const zoom = zoomForRadius(context?.suggested_radius_km ?? null);

  // Empty state — no home, no recent routes. Keep the screen looking
  // intentional rather than rendering a blank rectangle.
  const isEmpty = !center && extraRoutes.length === 0;

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
          <Ionicons name="compass-outline" size={14} color={colors.textLight} />
          <Text style={styles.captionTitle}>{title || 'Your usual ground'}</Text>
        </View>
        {metaLabel ? <Text style={styles.captionMeta}>{metaLabel}</Text> : null}
      </View>
      {extraRoutes.length > 0 ? (
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
