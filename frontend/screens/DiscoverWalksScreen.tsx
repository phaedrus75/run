/**
 * 🌍 DISCOVER WALKS SCREEN
 * ========================
 *
 * Browse public/recommended walks sourced from OpenStreetMap (Overpass API).
 *
 * Behaviour:
 * - On focus we read the device's current location and POST it to
 *   /public-walks/discover. The backend hits Overpass, caches what comes back
 *   and returns walks sorted by proximity.
 * - If location permission is denied (or fetching coords fails) we fall back
 *   to the cached /public-walks list so the user always sees something.
 * - Each row links into ``PublicWalkDetail`` which previews the route on a
 *   map and exposes the "Start this walk" CTA.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { publicWalkApi, PublicWalk } from '../services/api';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
}

const SEARCH_RADIUS_KM = 15;

export function DiscoverWalksScreen({ navigation }: Props) {
  const [walks, setWalks] = useState<PublicWalk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchNearMe = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setStatusMessage(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        const cached = await publicWalkApi.list({ limit: 50 });
        setWalks(cached);
        return;
      }
      setLocationDenied(false);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      const result = await publicWalkApi.discover({
        lat: latitude,
        lng: longitude,
        radius_km: SEARCH_RADIUS_KM,
        limit: 30,
      });
      setWalks(result.walks);
      if (result.refreshed > 0) {
        setStatusMessage(`Found ${result.refreshed} fresh walks nearby`);
      } else if (result.walks.length === 0) {
        setStatusMessage('No public walks within ' + SEARCH_RADIUS_KM + ' km. Try widening your search soon.');
      }
    } catch (err) {
      try {
        const cached = await publicWalkApi.list({ limit: 50 });
        setWalks(cached);
        setStatusMessage('Showing cached walks (network unavailable)');
      } catch {
        setWalks([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNearMe();
  }, [fetchNearMe]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchNearMe(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.intro}>
          <Ionicons name="map" size={28} color={colors.secondary} />
          <Text style={styles.introTitle}>Walks worth doing</Text>
          <Text style={styles.introText}>
            Curated and crowd-sourced walks pulled from OpenStreetMap. Pick one
            and we'll guide you along the route while ZenRun tracks your stats.
          </Text>
        </View>

        {locationDenied ? (
          <View style={styles.warningCard}>
            <Ionicons name="location-outline" size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              Enable location access to find walks near you. Showing cached
              suggestions for now.
            </Text>
          </View>
        ) : null}

        {statusMessage ? (
          <Text style={styles.statusText}>{statusMessage}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : walks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyTitle}>Nothing nearby yet</Text>
            <Text style={styles.emptyText}>
              We couldn't find any public walks within {SEARCH_RADIUS_KM} km. Pull
              to retry or just start your own walk.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('ActiveWalk')}
              style={styles.startBtn}
            >
              <Ionicons name="walk" size={18} color={colors.textOnPrimary} />
              <Text style={styles.startBtnText}>Start a walk now</Text>
            </Pressable>
          </View>
        ) : (
            walks.map((w) => <PublicWalkRow key={w.id} walk={w} navigation={navigation} />)
        )}

        <Text style={styles.attribution}>Route data © OpenStreetMap contributors</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PublicWalkRow({
  walk,
  navigation,
}: {
  walk: PublicWalk;
  navigation: any;
}) {
  return (
    <Pressable
      onPress={() => navigation.navigate('PublicWalkDetail', { walk })}
      style={({ pressed }) => [
        styles.row,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name="trail-sign-outline" size={20} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {walk.name}
        </Text>
        <Text style={styles.rowMeta}>
          {walk.distance_km.toFixed(1)} km
          {walk.estimated_duration_min ? ` · ~${walk.estimated_duration_min} min` : ''}
          {walk.difficulty ? ` · ${walk.difficulty}` : ''}
        </Text>
        {walk.distance_from_user_km != null ? (
          <Text style={styles.rowDistance}>
            {walk.distance_from_user_km.toFixed(1)} km away
            {walk.region ? ` · ${walk.region}` : ''}
          </Text>
        ) : walk.region ? (
          <Text style={styles.rowDistance}>
            {walk.region}
            {walk.country ? `, ${walk.country}` : ''}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  intro: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  introTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  introText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.small,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.xs },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  startBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginTop: spacing.md,
    ...shadows.small,
  },
  startBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  rowMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowDistance: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  attribution: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
