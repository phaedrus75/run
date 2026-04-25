/**
 * 🚶 WALK SCREEN - Hub
 * ====================
 *
 * Entry point for the Walk feature:
 * - Big "Start a Walk" CTA that opens ActiveWalkScreen
 * - Recent walks list (tap to open detail)
 * - Quick stats summary
 * - "Discover walks" link (Phase 3 - DiscoverWalksScreen)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  walkApi,
  Walk,
  WalkStats,
} from '../services/api';
import { formatDistanceKm, formatDurationHms } from '../services/walkLocationTracker';
import {
  getBackgroundTrackingEnabled,
  requestAlwaysLocationPermission,
  setBackgroundTrackingEnabled,
} from '../services/walkBackgroundTask';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

// Background location tasks are not supported in Expo Go — they require a
// standalone build with the UIBackgroundModes entitlement baked in.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

interface Props {
  navigation: any;
}

export function WalkScreen({ navigation }: Props) {
  const [walks, setWalks] = useState<Walk[]>([]);
  const [stats, setStats] = useState<WalkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgUpdating, setBgUpdating] = useState(false);

  useEffect(() => {
    void getBackgroundTrackingEnabled().then(setBgEnabled);
  }, []);

  const toggleBackground = async (next: boolean) => {
    setBgUpdating(true);
    try {
      if (!next) {
        await setBackgroundTrackingEnabled(false);
        setBgEnabled(false);
        return;
      }
      const result = await requestAlwaysLocationPermission();
      if (result.granted) {
        await setBackgroundTrackingEnabled(true);
        setBgEnabled(true);
        return;
      }
      setBgEnabled(false);
      await setBackgroundTrackingEnabled(false);

      let title = 'Background tracking unavailable';
      let message = 'Location access is required to track walks.';
      const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [
        { text: 'OK', style: 'cancel' },
      ];

      if (result.reason === 'foreground-denied') {
        title = 'Location access needed';
        message =
          'Open Settings → ZenRun → Location and choose "While Using the App" or "Always" so we can record your walk.';
        buttons.push({ text: 'Open Settings', onPress: () => Linking.openSettings() });
      } else if (result.reason === 'background-denied') {
        title = 'Switch to "Always" in Settings';
        message =
          'iOS only allowed location "While Using the App". To keep recording when the screen is locked, open Settings → ZenRun → Location and choose "Always".\n\nForeground tracking still works — just keep ZenRun on screen.';
        buttons.push({ text: 'Open Settings', onPress: () => Linking.openSettings() });
      } else if (result.reason === 'background-unavailable') {
        title = 'Background tracking not in this build';
        message =
          'This installed build of ZenRun was made before background-location was enabled. Foreground tracking (with the app open) still works.\n\nTo unlock locked-screen tracking, install a fresh build from EAS / TestFlight.';
      }

      Alert.alert(title, message, buttons);
    } finally {
      setBgUpdating(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [w, s] = await Promise.all([
        walkApi.list(20, 0).catch(() => []),
        walkApi.getStats().catch(() => null),
      ]);
      setWalks(w);
      setStats(s);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const startWalk = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate('ActiveWalk');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Walks</Text>
          <Text style={styles.subtitle}>
            Slow down. Track the route. Find your stride.
          </Text>
        </View>

        <Pressable
          onPress={startWalk}
          style={({ pressed }) => [
            styles.startCard,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View style={styles.startIconWrap}>
            <Ionicons name="walk" size={36} color={colors.textOnPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.startTitle}>Start a Walk</Text>
            <Text style={styles.startSub}>
              Track the map, distance and time live
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textOnPrimary} />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('DiscoverWalks')}
          style={styles.discoverRow}
        >
          <Ionicons name="map-outline" size={20} color={colors.secondary} />
          <Text style={styles.discoverText}>Discover walks near you</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </Pressable>

        {!IS_EXPO_GO && (
          <View style={styles.bgRow}>
            <Ionicons name="moon-outline" size={20} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bgTitle}>Track when locked</Text>
              <Text style={styles.bgSub}>
                Keep recording when the screen is off. Uses more battery.
              </Text>
            </View>
            <Switch
              value={bgEnabled}
              onValueChange={toggleBackground}
              disabled={bgUpdating}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.surface}
            />
          </View>
        )}

        {stats && stats.total_walks > 0 && (
          <View style={styles.statsRow}>
            <StatCell label="Walks" value={String(stats.total_walks)} />
            <StatCell
              label="Total km"
              value={stats.total_km.toFixed(1)}
            />
            <StatCell
              label="This week"
              value={`${stats.walks_this_week}`}
              hint={`${stats.km_this_week.toFixed(1)} km`}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent walks</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : walks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🚶</Text>
              <Text style={styles.emptyTitle}>No walks yet</Text>
              <Text style={styles.emptyText}>
                Tap "Start a Walk" to record your first one. Your route, distance
                and time are tracked from your phone.
              </Text>
            </View>
          ) : (
            walks.map((w) => (
              <WalkRow
                key={w.id}
                walk={w}
                onPress={() =>
                  navigation.navigate('WalkDetail', { walkId: w.id })
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function WalkRow({ walk, onPress }: { walk: Walk; onPress: () => void }) {
  const date = walk.started_at ? new Date(walk.started_at) : null;
  const dateLabel = date
    ? date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const timeLabel = date
    ? date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.walkRow,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.walkIcon}>
        <Ionicons name="walk-outline" size={20} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.walkRowTitle}>
          {formatDistanceKm(walk.distance_km)}
          <Text style={styles.walkRowSub}>
            {' '}
            · {formatDurationHms(walk.duration_seconds)}
          </Text>
        </Text>
        <Text style={styles.walkRowMeta}>
          {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ''}
          {walk.photo_count ? ` · 📸 ${walk.photo_count}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  startCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.medium,
  },
  startIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  startSub: {
    fontSize: typography.sizes.xs,
    color: colors.textOnPrimary,
    opacity: 0.85,
    marginTop: 2,
  },
  discoverRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
    ...shadows.small,
  },
  discoverText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  bgRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...shadows.small,
  },
  bgTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  bgSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.small,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statHint: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  walkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkRowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  walkRowSub: {
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  walkRowMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
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
});
