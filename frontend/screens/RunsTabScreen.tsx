/**
 * Runs hub inside Activity — history list + quick actions (stats live in drawer).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { runApi, statsApi, type Run, type Stats } from '../services/api';
import { RunHistoryCard } from '../components/RunHistoryCard';
import { EditRunModal } from '../components/EditRunModal';
import { navigationRef } from '../navigationRef';

const MIN_YEAR = 2026;

interface Props {
  navigation: any;
  route?: any;
  embedded?: boolean;
}

function openNeighbourhood() {
  if (!navigationRef.isReady()) return;
  (navigationRef as { navigate: (name: string, params?: object) => void }).navigate('Community', {
    screen: 'Neighbourhood',
  });
}

export function RunsTabScreen({ navigation, route, embedded }: Props) {
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [dashStats, setDashStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editRun, setEditRun] = useState<Run | null>(null);

  const runs = useMemo(
    () => allRuns.filter((r) => new Date(r.completed_at).getFullYear() >= MIN_YEAR),
    [allRuns],
  );

  const fetchData = useCallback(async () => {
    try {
      const [runsData, statsData] = await Promise.all([
        runApi.getAll({ limit: 1000 }),
        statsApi.get().catch(() => null),
      ]);
      setAllRuns(runsData);
      setDashStats(statsData);
    } catch (e) {
      console.error('RunsTab fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  React.useEffect(() => {
    const id = route?.params?.focusRunId as number | undefined;
    if (id == null || !allRuns.length) return;
    const r = allRuns.find((x) => x.id === id);
    if (r) {
      setEditRun(r);
      try {
        navigation.setParams({ focusRunId: undefined });
      } catch {}
    }
  }, [route?.params?.focusRunId, allRuns, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const startRun = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate('ActiveRun');
  };

  const hubHeader = (
    <View style={styles.hub}>
      <Pressable
        onPress={startRun}
        style={({ pressed }) => [styles.startCard, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <View style={styles.startIconWrap}>
          <Ionicons name="navigate" size={32} color={colors.textOnPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.startTitle}>Start a run</Text>
          <Text style={styles.startSub}>GPS track, distance and pace live</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textOnPrimary} />
      </Pressable>

      <Pressable onPress={openNeighbourhood} style={styles.discoverRow}>
        <Ionicons name="people-outline" size={20} color={colors.primary} />
        <Text style={styles.discoverText}>Discover runs near you</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </Pressable>

      <Pressable onPress={() => navigation.navigate('AddRun')} style={styles.secondaryRow}>
        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.secondaryText}>Add a past run</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </Pressable>

      {dashStats && dashStats.total_runs > 0 && (
        <View style={styles.statsRow}>
          <StatCell label="Runs" value={String(dashStats.total_runs)} />
          <StatCell label="Total km" value={dashStats.total_km.toFixed(0)} />
          <StatCell
            label="This week"
            value={`${dashStats.runs_this_week}`}
            hint={`${dashStats.km_this_week.toFixed(1)} km`}
          />
        </View>
      )}
    </View>
  );

  const Shell = embedded ? View : SafeAreaView;
  const shellProps = embedded
    ? { style: styles.container }
    : { style: styles.container, edges: ['top' as const] };

  return (
    <Shell {...shellProps}>
      <View style={[styles.header, embedded && styles.headerEmbedded]}>
        {!embedded && <Text style={styles.title}>Runs</Text>}
        {embedded && <View style={{ flex: 1 }} />}
      </View>

      <SectionList
        sections={[{ title: '', data: runs }]}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.historyContent}
        renderSectionHeader={() => null}
        ListHeaderComponent={hubHeader}
        renderItem={({ item }) => <RunHistoryCard run={item} onPress={() => setEditRun(item)} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🏃</Text>
              <Text style={styles.emptyTitle}>No runs yet</Text>
              <Text style={styles.emptyText}>Start a GPS run above, or add a past run.</Text>
            </View>
          )
        }
      />

      <EditRunModal
        visible={!!editRun}
        run={editRun}
        onClose={() => setEditRun(null)}
        onSave={async (id, data) => {
          await runApi.update(id, data);
          setEditRun(null);
          fetchData();
        }}
        onDelete={async (id) => {
          await runApi.delete(id);
          setEditRun(null);
          fetchData();
        }}
      />
    </Shell>
  );
}

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerEmbedded: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  hub: { marginBottom: spacing.md },
  historyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  startCard: {
    backgroundColor: colors.primary,
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
    backgroundColor: 'rgba(0,0,0,0.12)',
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
    opacity: 0.9,
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
  secondaryRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    ...shadows.small,
  },
  secondaryText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadows.small,
  },
  statCell: { flex: 1, alignItems: 'center' },
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
  statHint: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.sm },
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
