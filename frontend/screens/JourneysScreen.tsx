/**
 * 🌅 JOURNEYS SCREEN
 * ===================
 *
 * The user's slow ultras: list of completed/abandoned journeys plus a
 * prominent block for the active one (or a CTA to start a new one).
 *
 * Phase 5 ships the 20k tier. Higher tiers (30k/50k/100k) plug into
 * the same screens via the `tier` field.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Journey, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
}

export function JourneysScreen({ navigation }: Props) {
  const [active, setActive] = useState<Journey | null>(null);
  const [history, setHistory] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [a, all] = await Promise.all([
        journeyApi.getActive().catch(() => null),
        journeyApi.list().catch(() => []),
      ]);
      setActive(a);
      // Filter out the active journey from history; keep completed + abandoned.
      setHistory(all.filter((j) => j.status !== 'active'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchAll();
    const unsub = navigation.addListener('focus', fetchAll);
    return unsub;
  }, [navigation, fetchAll]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchAll();
  };

  const startNew = () => {
    navigation.navigate('StartJourney');
  };

  const goToDetail = (journey: Journey) => {
    navigation.navigate('JourneyDetail', { journeyId: journey.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Journeys</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.tagline}>The slow ultra.</Text>
        <Text style={styles.intro}>
          A 20 km adventure stitched together from runs and walks across days or weeks. Every
          activity counts toward the line.
        </Text>

        {active ? (
          <ActiveBlock journey={active} onPress={() => goToDetail(active)} />
        ) : (
          <Pressable
            onPress={startNew}
            style={({ pressed }) => [
              styles.startCard,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={styles.startIcon}>
              <Ionicons name="play" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.startTitle}>Start a journey</Text>
              <Text style={styles.startSub}>20 km. As slow as you like.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textOnPrimary} />
          </Pressable>
        )}

        {history.length > 0 && (
          <>
            <Text style={styles.section}>Past journeys</Text>
            {history.map((j) => (
              <Pressable
                key={j.id}
                onPress={() => goToDetail(j)}
                style={({ pressed }) => [
                  styles.row,
                  { transform: [{ scale: pressed ? 0.99 : 1 }] },
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName}>{j.name}</Text>
                  <Text style={styles.rowMeta}>
                    {j.accumulated_km.toFixed(1)} / {j.target_distance_km.toFixed(0)} km
                    {' · '}
                    {j.status === 'completed' ? 'completed' : 'abandoned'}
                  </Text>
                </View>
                <Text style={styles.rowDate}>
                  {new Date(j.completed_at || j.started_at).toLocaleDateString()}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              </Pressable>
            ))}
          </>
        )}

        {!active && history.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              Your past journeys will live here once you finish your first one.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActiveBlock({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const pct = Math.max(0, Math.min(100, journey.progress_percent || 0));
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.activeCard,
        { transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={styles.activeHeader}>
        <Text style={styles.activeLabel}>Active</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{journey.tier}</Text>
        </View>
      </View>
      <Text style={styles.activeName}>{journey.name}</Text>
      {journey.plan_summary ? (
        <Text style={styles.activeSummary}>{journey.plan_summary}</Text>
      ) : null}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.activeMetaRow}>
        <Text style={styles.activeMeta}>
          {journey.accumulated_km.toFixed(1)} of {journey.target_distance_km.toFixed(0)} km
        </Text>
        <Text style={styles.activeMetaSecondary}>
          {journey.activity_count} activit{journey.activity_count === 1 ? 'y' : 'ies'}
          {' · '}
          {journey.days_active} day{journey.days_active === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  tagline: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  intro: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  startIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTitle: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  startSub: {
    color: colors.textOnPrimary,
    opacity: 0.85,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  activeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.small,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  activeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: typography.weights.bold,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  activeName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  activeSummary: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  activeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  activeMeta: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  activeMetaSecondary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  section: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  rowLeft: { flex: 1 },
  rowName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rowMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowDate: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginRight: spacing.sm,
  },
  emptyHint: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyHintText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
