/**
 * 🏃 RUNS TAB SCREEN
 * ==================
 *
 * The Runs tab home. Two inner tabs:
 *   • History  — list of all logged runs (GPS + manual)
 *   • Stats    — charts, pace trend, streak (moved from StatsScreen)
 *
 * Starting runs is done via the centre Go button, not here.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { StatsChart, PaceTrendChart, StreakProgress } from '../components';
import { runApi, statsApi, type Run, type WeeklyStreakProgress, type MonthInReview as MonthInReviewType } from '../services/api';
import { RunHistoryCard } from '../components/RunHistoryCard';
import { EditRunModal } from '../components/EditRunModal';
import { MonthInReview } from '../components/MonthInReview';
import { QuarterInReview } from '../components/QuarterInReview';

type InnerTab = 'history' | 'stats';
type RunViewMode = 'week' | 'month' | 'all';
type CategoryFilter = 'all' | 'outdoor' | 'treadmill';

const MIN_YEAR = 2026;

interface Props {
  navigation: any;
  route?: any;
  /** When true, used inside Activity tab: no outer safe-area top, compact header. */
  embedded?: boolean;
}

const getAvailableMonths = () => {
  const months: { month: number; year: number; label: string }[] = [];
  const now = new Date();
  for (let year = 2026; year <= now.getFullYear(); year++) {
    const endMonth = year === now.getFullYear() ? now.getMonth() : 12;
    const start = year === 2026 ? 1 : 1;
    if (endMonth < start) continue;
    for (let month = start; month <= endMonth; month++) {
      months.push({
        month,
        year,
        label: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }
  }
  return months.reverse();
};

const getAvailableQuarters = () => {
  const now = new Date();
  const quarters: { q: number; year: number; label: string }[] = [];
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  for (let year = 2026; year <= now.getFullYear(); year++) {
    const maxQ = year === now.getFullYear() ? currentQ - 1 : 4;
    for (let q = 1; q <= maxQ; q++) {
      quarters.push({ q, year, label: `Q${q} ${year}` });
    }
  }
  return quarters.reverse();
};

export function RunsTabScreen({ navigation, route, embedded }: Props) {
  const [tab, setTab] = useState<InnerTab>('history');
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [viewMode, setViewMode] = useState<RunViewMode>('week');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [editRun, setEditRun] = useState<Run | null>(null);

  // Month / Quarter in Review
  const [monthReviewData, setMonthReviewData] = useState<MonthInReviewType | null>(null);
  const [showMonthReview, setShowMonthReview] = useState(false);
  const [showQuarterReview, setShowQuarterReview] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(2026);
  const availableMonths = getAvailableMonths();
  const availableQuarters = getAvailableQuarters();

  const fetchMonthReview = async (month: number, year: number) => {
    try {
      const data = await statsApi.getMonthReview(month, year);
      if (data) {
        setMonthReviewData({ ...data, should_show: true });
        setShowMonthReview(true);
      }
    } catch (e) {
      console.error('Month review fetch error', e);
    }
  };

  const runs = useMemo(() => {
    const base = allRuns.filter(r => new Date(r.completed_at).getFullYear() >= MIN_YEAR);
    if (categoryFilter === 'all') return base;
    return base.filter(r => (r.category || 'outdoor') === categoryFilter);
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
      console.error('RunsTab fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  // Open run from Album / deep link: Activity stack passes `focusRunId`.
  React.useEffect(() => {
    const id = route?.params?.focusRunId as number | undefined;
    if (id == null || !allRuns.length) return;
    const r = allRuns.find((x) => x.id === id);
    if (r) {
      setEditRun(r);
      setTab('history');
      try {
        navigation.setParams({ focusRunId: undefined });
      } catch {}
    }
  }, [route?.params?.focusRunId, allRuns, navigation]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ---- Stats helpers (from StatsScreen) ----

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
    const avgPace = totalKm > 0
      ? `${Math.floor(avgPaceSec / 60)}:${Math.floor(avgPaceSec % 60).toString().padStart(2, '0')}`
      : '0:00';
    const byType: Record<string, number> = {};
    rs.forEach(r => { byType[r.run_type] = (byType[r.run_type] || 0) + 1; });
    return { totalRuns: rs.length, totalKm, avgPace, avgPaceSec, byType };
  };

  const weeklyChartData = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const { start, end } = getWeekBounds(i);
      if (start.getFullYear() < MIN_YEAR) continue;
      const wr = runs.filter(r => { const d = new Date(r.completed_at); return d >= start && d <= end; });
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
      const mr = runs.filter(r => { const d = new Date(r.completed_at); return d >= start && d <= end; });
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

  // ---- Render: Stats section ----

  const reviewChips = (
    <View>
      <View style={styles.reviewSection}>
        <Text style={styles.reviewTitle}>📅 Month in Review</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {availableMonths.map(({ month, year, label }) => (
            <TouchableOpacity
              key={`${year}-${month}`}
              style={[styles.chip, shadows.small]}
              onPress={() => fetchMonthReview(month, year)}
            >
              <Text style={styles.chipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {availableQuarters.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>📊 Quarter in Review</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {availableQuarters.map(({ q, year, label }) => (
              <TouchableOpacity
                key={`${year}-Q${q}`}
                style={[styles.chip, shadows.small]}
                onPress={() => { setSelectedQuarter(q); setSelectedQuarterYear(year); setShowQuarterReview(true); }}
              >
                <Text style={styles.chipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderStats = () => (
    <ScrollView contentContainerStyle={styles.statsScroll} showsVerticalScrollIndicator={false}>
      {/* View mode picker */}
      <View style={styles.tabRow}>
        {(['week', 'month', 'all'] as RunViewMode[]).map(m => (
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

      {/* Category filter */}
      <View style={styles.catRow}>
        {(['all', 'outdoor', 'treadmill'] as CategoryFilter[]).map(k => (
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
              data={weeklyChartData.map(d => ({ label: d.shortLabel, avgPaceSeconds: d.avgPaceSeconds, numRuns: d.numRuns }))}
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
            {weeklyChartData.slice().reverse().slice(0, 4).map((w, i) => (
              <View key={i} style={[styles.detailCard, shadows.small]}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{w.label}</Text>
                  <Text style={styles.detailBadge}>{w.numRuns} runs</Text>
                </View>
                <View style={styles.detailStats}>
                  <Text style={styles.detailStat}><Text style={styles.detailVal}>{w.totalKm.toFixed(1)}</Text> km</Text>
                  <Text style={styles.detailStat}><Text style={styles.detailVal}>{w.avgPace}</Text> pace</Text>
                </View>
              </View>
            ))}
            {reviewChips}
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
            {monthlyChartData.slice().reverse().slice(0, 6).map((m, i) => (
              <View key={i} style={[styles.detailCard, shadows.small]}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{m.label}</Text>
                  <Text style={styles.detailBadge}>{m.numRuns} runs</Text>
                </View>
                <View style={styles.detailStats}>
                  <Text style={styles.detailStat}><Text style={styles.detailVal}>{m.totalKm.toFixed(1)}</Text> km</Text>
                  <Text style={styles.detailStat}><Text style={styles.detailVal}>{m.avgPace}</Text> pace</Text>
                </View>
              </View>
            ))}
            {reviewChips}
          </View>
        );
      })()}

      {viewMode === 'all' && (() => {
        const s = calcStats(runs);
        const distMap: Record<string, number> = { '1k': 1, '2k': 2, '3k': 3, '5k': 5, '8k': 8, '10k': 10, '15k': 15, '18k': 18, '21k': 21 };
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
              {['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'].map(type => {
                const count = s.byType[type] || 0;
                if (!count) return null;
                return (
                  <View key={type} style={[styles.typeCard, shadows.small]}>
                    <View style={[styles.typeIcon, { backgroundColor: (colors as any).runTypes?.[type] ?? colors.primary }]}>
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

  // ---- Render: History section ----

  const historyHeader = (
    <View>
      {reviewChips}
    </View>
  );

  const renderHistory = () => (
    <SectionList
      sections={[{ title: '', data: runs }]}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.historyContent}
      renderSectionHeader={() => null}
      ListHeaderComponent={historyHeader}
      renderItem={({ item }) => (
        <RunHistoryCard run={item} onPress={() => setEditRun(item)} />
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏃</Text>
            <Text style={styles.emptyTitle}>No runs yet</Text>
            <Text style={styles.emptyText}>
              Tap the  button below to start a GPS run or log one manually.
            </Text>
          </View>
        )
      }
    />
  );

  const Shell = embedded ? View : SafeAreaView;
  const shellProps = embedded
    ? { style: styles.container }
    : { style: styles.container, edges: ['top' as const] };

  return (
    <Shell {...shellProps}>
      {/* Header — compact when embedded inside Activity tab */}
      <View style={[styles.header, embedded && styles.headerEmbedded]}>
        {!embedded && <Text style={styles.title}>Runs</Text>}
        {embedded && <View style={{ flex: 1 }} />}
        <TouchableOpacity
          onPress={() => navigation.navigate('AddRun')}
          style={styles.addBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Inner tab switcher */}
      <View style={styles.innerTabRow}>
        {(['history', 'stats'] as InnerTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.innerTab, tab === t && styles.innerTabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.innerTabText, tab === t && styles.innerTabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' ? renderStats() : renderHistory()}

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

      {monthReviewData && showMonthReview && (
        <MonthInReview
          data={monthReviewData}
          onDismiss={() => setShowMonthReview(false)}
        />
      )}

      <QuarterInReview
        visible={showQuarterReview}
        quarter={selectedQuarter}
        year={selectedQuarterYear}
        onClose={() => setShowQuarterReview(false)}
      />
    </Shell>
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
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  innerTabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  innerTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  innerTabActive: { backgroundColor: colors.text },
  innerTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  innerTabTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.semibold,
  },
  // History
  historyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  reviewSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  reviewTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
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
  // Stats
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
