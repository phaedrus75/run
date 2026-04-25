/**
 * 🌍 PUBLIC WALK DETAIL SCREEN
 * ============================
 *
 * Preview screen for a single public/OSM walk. Shows the route on a map,
 * key stats (distance, duration, difficulty) and a primary CTA to start
 * tracking the walk.
 *
 * Data flow:
 * - The list screen passes the full ``PublicWalk`` object via route.params
 *   so we can render immediately without a network round-trip.
 * - We always re-fetch in the background to pick up cache updates.
 * - "Start this walk" hands the ``PublicWalk`` to the ActiveWalk screen via
 *   navigation params; ActiveWalk already knows how to render the
 *   reference polyline and tag the saved walk with ``public_walk_id``.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { publicWalkApi, PublicWalk } from '../services/api';
import { decodePolyline } from '../services/walkLocationTracker';
import { WalkMap } from '../components/WalkMap';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
  route: { params?: { walk?: PublicWalk; walkId?: number } };
}

export function PublicWalkDetailScreen({ navigation, route }: Props) {
  const params = route?.params || {};
  const walkParam = params.walk;
  const walkId = params.walkId;
  const [walk, setWalk] = useState<PublicWalk | null>(walkParam || null);
  const [loading, setLoading] = useState(!walkParam);

  useEffect(() => {
    let cancelled = false;
    const id = walkParam?.id ?? walkId;
    if (id == null) return;
    publicWalkApi
      .get(id)
      .then((fresh) => {
        if (!cancelled) setWalk(fresh);
      })
      .catch(() => {
        if (!cancelled && !walkParam) {
          Alert.alert('Could not load walk', 'Please try again.');
          navigation.goBack();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walkParam, walkId, navigation]);

  const routePoints = useMemo(
    () => (walk?.route_polyline ? decodePolyline(walk.route_polyline) : []),
    [walk?.route_polyline],
  );

  const startMarker = useMemo(
    () =>
      walk
        ? [
            {
              id: 'start',
              lat: walk.start_lat,
              lng: walk.start_lng,
              title: 'Start',
              tintColor: colors.primary,
            },
          ]
        : [],
    [walk],
  );

  if (loading || !walk) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = () => {
    navigation.navigate('ActiveWalk', { publicWalk: walk });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Map preview */}
        <View style={styles.mapWrapper}>
          <WalkMap
            style={styles.map}
            route={routePoints}
            markers={startMarker}
            centerOn={{ lat: walk.start_lat, lng: walk.start_lng }}
            zoom={14}
            showUserLocation={false}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{walk.name}</Text>
          {(walk.region || walk.country) && (
            <Text style={styles.subtitle}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              {'  '}
              {[walk.region, walk.country].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>

        {/* Stat tiles */}
        <View style={styles.statsRow}>
          <Stat icon="resize-outline" value={`${walk.distance_km.toFixed(1)} km`} label="Distance" />
          {walk.estimated_duration_min ? (
            <Stat
              icon="time-outline"
              value={`~${walk.estimated_duration_min} min`}
              label="Duration"
            />
          ) : null}
          {walk.difficulty ? (
            <Stat
              icon="trail-sign-outline"
              value={capitalize(walk.difficulty)}
              label="Difficulty"
            />
          ) : null}
        </View>

        {walk.description ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About this walk</Text>
            <Text style={styles.cardBody}>{walk.description}</Text>
          </View>
        ) : null}

        {walk.distance_from_user_km != null ? (
          <View style={styles.distanceCard}>
            <Ionicons name="navigate-outline" size={18} color={colors.secondary} />
            <Text style={styles.distanceText}>
              {walk.distance_from_user_km.toFixed(1)} km from you
            </Text>
          </View>
        ) : null}

        {walk.tags ? (
          <View style={styles.tagsRow}>
            {walk.tags
              .split(',')
              .filter(Boolean)
              .slice(0, 6)
              .map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag.trim()}</Text>
                </View>
              ))}
          </View>
        ) : null}

        {walk.source === 'osm' ? (
          <Text style={styles.attribution}>Route data © OpenStreetMap contributors</Text>
        ) : null}
      </ScrollView>

      {/* Primary CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [
            styles.startBtn,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="walk" size={20} color={colors.textOnPrimary} />
          <Text style={styles.startBtnText}>Start this walk</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Stat({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color={colors.secondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    paddingTop: spacing.md,
  },
  mapWrapper: {
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  map: { flex: 1 },
  header: { marginTop: spacing.md },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-start',
    ...shadows.small,
  },
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 6,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  distanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  distanceText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  tagPill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: typography.sizes.xs, color: colors.textSecondary },
  attribution: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    ...shadows.small,
  },
  startBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
