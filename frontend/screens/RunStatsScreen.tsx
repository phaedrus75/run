/**
 * Run statistics (charts, pace, rhythm) — opened from the drawer.
 * Month / quarter wrapped summaries live on ReviewsScreen.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { StatsChart, PaceTrendChart, StreakProgress } from '../components';
import { runApi, statsApi, type Run, type WeeklyStreakProgress } from '../services/api';

type RunViewMode = 'week' | 'month' | 'all';
type CategoryFilter = 'all' | 'outdoor' | 'treadmill';
const MIN_YEAR = 2026;

export function RunStatsScreen({ navigation }: { navigation: any }) {
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [viewMode, setViewMode] = useState<RunViewMode>('week');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const runs = useMemo(() => {
    const base = allRuns.filter((r) => new Date(r.completed_at).getFullYear() >= MIN_YEAR);
    if (categoryFilter === 'all') return base;
    return base.filter((r) => (r.category || 'outdoor') === categoryFilter);
  }, [allRuns, categoryFilter]);

  const fetchData = useCallback(async () => {
    try {
      const [runsData, streakData] = await Promise.all([
        runApi.getAll({ limit: 1000 }),
        statsApi.getStreakProgress().catch(() => null),
      ]);
      setAllRuns(runsData);
      setStreakProgress(streakData);
    } catch (e) {
      console.error('RunStats fetch error', e);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getWeekBounds = (weeksAgo = 0) => {
    const now = new Date();
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay() - weeksAgo * 7);
    sun.setHours(0, 0, 0, 0);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    sat.setHours(23, 59, 59, 999);
    return { start: sun, end: sat };
  };

  const getMonthBounds = (monthsAgo = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    if (start.getFullYear() < MIN_YEAR) return null;
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const calcStats = (rs: Run[]) => {
    const totalKm = rs.reduce((s, r) => s + r.distance_km, 0);
    const totalSec = rs.reduce((s, r) => s + r.duration_seconds, 0);
    const avgPaceSec = totalKm > 0 ? totalSec / totalKm : 0;
    const avgPace =
      totalKm > 0
        ? `${Math.floor(avgPaceSec / 60)}:${Math.floor(avgPaceSec % 60).toString().padStart(2, '0')}`
        : '0:00';
    const byType: Record<string, number> = {};
    rs.forEach((r) => {
      byType[r.run_type] = (byType[r.run_type] || 0) + 1;
    });
    return { totalRuns: rs.length, totalKm, avgPace, avgPaceSec, byType };
  };

  const weeklyChartData = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const { start, end } = getWeekBounds(i);
      if (start.getFullYear() < MIN_YEAR) continue;
      const wr = runs.filter((r) => {
        const d = new Date(r.completed_at);
        return d >= start && d <= end;
      });
      const s = calcStats(wr);
      weeks.push({
        label: i === 0 ? 'This Week' : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        shortLabel: `${start.getMonth() + 1}/${start.getDate()}`,
        totalKm: s.totalKm,
        avgPace: s.avgPace,
        avgPaceSeconds: s.avgPaceSec,
        numRuns: s.totalRuns,
      });
    }
    return weeks;
  }, [runs]);

  const monthlyChartData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const bounds = getMonthBounds(i);
      if (!bounds) continue;
      const { start, end } = bounds;
      const mr = runs.filter((r) => {
        const d = new Date(r.completed_at);
        return d >= start && d <= end;
      });
      const s = calcStats(mr);
      months.push({
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortLabel: start.toLocaleDateString('en-US', { month: 'short' }),
        totalKm: s.totalKm,
        avgPace: s.avgPace,
        avgPaceSeconds: s.avgPaceSec,
        numRuns: s.totalRuns,
      });
    }
    return months;
  }, [runs]);

  const renderStats = () => (
    <ScrollView
      contentContainerStyle={styles.statsScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.tabRow}>
        {(['week', 'month', 'all'] as RunViewMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, viewMode === m && styles.modeBtnActive]}
            onPress={() => setViewMode(m)}
          >
            <Text style={[styles.modeBtnText, viewMode === m && styles.modeBtnTextActive]}>
              {m === 'week' ? 'Weekly' : m === 'month' ? 'Monthly' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.catRow}>
        {(['all', 'outdoor', 'treadmill'] as CategoryFilter[]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.catPill, categoryFilter === k && styles.catPillActive]}
            onPress={() => setCategoryFilter(k)}
          >
            <Text style={[styles.catPillText, categoryFilter === k && styles.catPillTextActive]}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'week' && (() => {
        const cur = weeklyChartData[weeklyChartData.length - 1];
        return (
          <View>
            <View style={[styles.summaryCard, shadows.small]}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{cur?.numRuns ?? 0}</Text>
                <Text style={styles.summaryLabel}>Runs this week</Text>
              </View>
              <View style={styles.summaryDiv} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{(cur?.totalKm ?? 0).toFixed(1)}</Text>
                <Text style={styles.summaryLabel}>KM this week</Text>
              </View>
            </View>
            <StatsChart data={weeklyChartData} title="Last 8 Weeks" />
            <PaceTrendChart
              data={weeklyChartData.map((d) => ({
                label: d.shortLabel,
                avgPaceSeconds: d.avgPaceSeconds,
                numRuns: d.numRuns,
              }))}
              title="Pace Over Time"
            />
            {streakProgress && (
              <>
                <Text style={styles.sectionTitle}>Your Rhythm</Text>
                <StreakProgress progress={streakProgress} />
                <View style={[styles.streakRow, shadows.small]}>
                  <View style={styles.streakItem}>
                    <Text style={styles.streakVal}>{streakProgress.current_streak}</Text>
                    <Text style={styles.streakLabel}>Current</Text>
                  </View>
                  <View style={styles.streakDiv} />
                  <View style={styles.streakItem}>
                    <Text style={styles.streakVal}>{streakProgress.longest_streak}</Text>
                    <Text style={styles.streakLabel}>Best Ever</Text>
                  </View>
                </View>
              </>
            )}
            <Text style={styles.sectionTitle}>Week Details</Text>
            {weeklyChartData
              .slice()
              .reverse()
              .slice(0, 4)
              .map((w, i) => (
                <View key={i} style={[styles.detailCard, shadows.small]}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{w.label}</Text>
                    <Text style={styles.detailBadge}>{w.numRuns} runs</Text>
                  </View>
                  <View style={styles.detailStats}>
                    <Text style={styles.detailStat}>
                      <Text style={styles.detailVal}>{w.totalKm.toFixed(1)}</Text> km
                    </Text>
                    <Text style={styles.detailStat}>
                      <Text style={styles.detailVal}>{w.avgPace}</Text> pace
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        );
      })()}

      {viewMode === 'month' && (() => {
        const totKm = monthlyChartData.reduce((s, d) => s + d.totalKm, 0);
        const totRuns = monthlyChartData.reduce((s, d) => s + d.numRuns, 0);
        return (
          <View>
            <View style={[styles.summaryCard, shadows.small]}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totRuns}</Text>
                <Text style={styles.summaryLabel}>Total Runs</Text>
              </View>
              <View style={styles.summaryDiv} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totKm.toFixed(1)}</Text>
                <Text style={styles.summaryLabel}>Total KM</Text>
              </View>
            </View>
            <StatsChart data={monthlyChartData} title="Monthly Overview (2026+)" />
            <Text style={styles.sectionTitle}>Month Details</Text>
            {monthlyChartData
              .slice()
              .reverse()
              .slice(0, 6)
              .map((m, i) => (
                <View key={i} style={[styles.detailCard, shadows.small]}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{m.label}</Text>
                    <Text style={styles.detailBadge}>{m.numRuns} runs</Text>
                  </View>
                  <View style={styles.detailStats}>
                    <Text style={styles.detailStat}>
                      <Text style={styles.detailVal}>{m.totalKm.toFixed(1)}</Text> km
                    </Text>
                    <Text style={styles.detailStat}>
                      <Text style={styles.detailVal}>{m.avgPace}</Text> pace
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        );
      })()}

      {viewMode === 'all' && (() => {
        const s = calcStats(runs);
        const distMap: Record<string, number> = {
          '1k': 1,
          '2k': 2,
          '3k': 3,
          '5k': 5,
          '8k': 8,
          '10k': 10,
          '15k': 15,
          '18k': 18,
          '21k': 21,
        };
        return (
          <View>
            <View style={[styles.summaryCard, shadows.small]}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{s.totalRuns}</Text>
                <Text style={styles.summaryLabel}>Total Runs</Text>
              </View>
              <View style={styles.summaryDiv} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{Math.round(s.totalKm)}</Text>
                <Text style={styles.summaryLabel}>Total KM</Text>
              </View>
              <View style={styles.summaryDiv} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{s.avgPace}</Text>
                <Text style={styles.summaryLabel}>Avg Pace</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>By Distance</Text>
            <View style={styles.typeGrid}>
              {['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'].map((type) => {
                const count = s.byType[type] || 0;
                if (!count) return null;
                return (
                  <View key={type} style={[styles.typeCard, shadows.small]}>
                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: (colors as any).runTypes?.[type] ?? colors.primary },
                      ]}
                    >
                      <Text style={styles.typeIconText}>{type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.typeCount}>{count}</Text>
                    <Text style={styles.typeKm}>{count * (distMap[type] || 0)} km</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })()}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Run statistics</Text>
        <View style={{ width: 32 }} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : renderStats()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { padding: spacing.xs },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statsScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  modeBtnTextActive: { color: '#fff' },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textLight,
  },
  catPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  catPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  catPillTextActive: { color: colors.textOnPrimary },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDiv: { width: 1, backgroundColor: colors.textLight, marginHorizontal: spacing.md },
  summaryValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  streakRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  streakItem: { flex: 1, alignItems: 'center' },
  streakVal: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  streakLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  streakDiv: { width: 1, height: 30, backgroundColor: colors.border },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  detailBadge: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  detailStats: { flexDirection: 'row', gap: spacing.lg },
  detailStat: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  detailVal: { fontWeight: typography.weights.bold, color: colors.text },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    width: '31%',
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeIconText: { fontSize: 10, fontWeight: typography.weights.bold, color: '#fff' },
  typeCount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  typeKm: { fontSize: 10, color: colors.textLight, marginTop: 2 },
});
