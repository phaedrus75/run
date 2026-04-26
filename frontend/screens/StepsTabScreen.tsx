/**
 * 👟 STEPS TAB SCREEN
 * ====================
 *
 * Steps history + stats.
 * Accessed from Labs tab.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { EditStepModal } from '../components/EditStepModal';
import { stepsApi, type StepEntry, type StepsSummary } from '../services/api';

type InnerTab = 'history' | 'stats';

const STEP_COLORS: Record<string, string> = {
  '15k': colors.accent,       // warm gold — baseline achievement
  '20k': colors.primary,      // coral — going further
  '25k': colors.secondary,    // teal — getting strong
  '30k': colors.success,      // green — elite tier
};

interface Props {
  navigation: any;
}

export function StepsTabScreen({ navigation }: Props) {
  const [tab, setTab] = useState<InnerTab>('history');
  const [entries, setEntries] = useState<StepEntry[]>([]);
  const [summary, setSummary] = useState<StepsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editEntry, setEditEntry] = useState<StepEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [es, sm] = await Promise.all([
        stepsApi.getAll(200),
        stepsApi.getSummary().catch(() => null),
      ]);
      setEntries(es);
      setSummary(sm);
    } catch (e) {
      console.error('StepsTab fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const renderEntry = ({ item }: { item: StepEntry }) => {
    const date = new Date(item.date || item.created_at || Date.now());
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const steps = item.step_count?.toLocaleString() ?? '—';
    return (
      <Pressable
        onPress={() => setEditEntry(item)}
        style={({ pressed }) => [styles.entryRow, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <View style={styles.entryIcon}>
          <Ionicons name="footsteps-outline" size={18} color={colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entrySteps}>{steps} steps</Text>
          <Text style={styles.entryDate}>{dateLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </Pressable>
    );
  };

  const renderStats = () => {
    if (!summary) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>👟</Text>
          <Text style={styles.emptyTitle}>No step data yet</Text>
          <Text style={styles.emptyText}>Start logging steps to see your stats here.</Text>
        </View>
      );
    }

    const history = summary.monthly_history || [];
    const maxDays = Math.max(1, ...history.map((m: any) => m.days_15k));

    return (
      <View>
        {summary.current_month && (
          <View style={[styles.statsCard, shadows.small]}>
            <Text style={styles.statsCardTitle}>{summary.current_month.month}</Text>
            <View style={styles.daysRow}>
              {[
                { emoji: '🚶', value: summary.current_month.days_15k, label: '15K+ days' },
                { emoji: '🏃', value: summary.current_month.days_20k, label: '20K+ days' },
                { emoji: '🌿', value: summary.current_month.days_25k, label: '25K+ days' },
                { emoji: '🏔️', value: summary.current_month.days_30k, label: '30K+ days' },
              ].map((item) => (
                <View key={item.label} style={styles.dayItem}>
                  <Text style={styles.dayEmoji}>{item.emoji}</Text>
                  <Text style={styles.dayValue}>{item.value}</Text>
                  <Text style={styles.dayLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            {summary.current_month.highest > 0 && (
              <View style={styles.bestRow}>
                <Text style={styles.bestLabel}>Best this month:</Text>
                <Text style={styles.bestValue}>{summary.current_month.highest.toLocaleString()} steps</Text>
              </View>
            )}
          </View>
        )}

        {summary.all_time && (
          <View style={[styles.statsCard, shadows.small, { marginTop: spacing.md }]}>
            <Text style={styles.statsCardTitle}>All Time</Text>
            <View style={styles.daysRow}>
              {[
                { emoji: '🚶', value: summary.all_time.days_15k, label: '15K+ days' },
                { emoji: '🏃', value: summary.all_time.days_20k, label: '20K+ days' },
                { emoji: '🌿', value: summary.all_time.days_25k, label: '25K+ days' },
                { emoji: '🏔️', value: summary.all_time.days_30k, label: '30K+ days' },
              ].map((item) => (
                <View key={item.label} style={styles.dayItem}>
                  <Text style={styles.dayEmoji}>{item.emoji}</Text>
                  <Text style={styles.dayValue}>{item.value}</Text>
                  <Text style={styles.dayLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.bestRow}>
              <Text style={styles.bestLabel}>Total entries:</Text>
              <Text style={styles.bestValue}>{summary.all_time.total_entries}</Text>
            </View>
          </View>
        )}

        {history.length > 0 && (
          <View style={[styles.statsCard, shadows.small, { marginTop: spacing.md }]}>
            <Text style={styles.statsCardTitle}>Monthly Breakdown</Text>
            {history.map((month: any) => {
              const only15k = month.days_15k - month.days_20k;
              const only20k = month.days_20k - month.days_25k;
              const only25k = month.days_25k - (month.days_30k || 0);
              const only30k = month.days_30k || 0;
              const total = month.days_15k;
              const pct = maxDays > 0 ? `${(total / maxDays) * 100}%` : '0%';
              return (
                <View key={month.month} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{month.month.slice(0, 3)}</Text>
                  <View style={styles.chartBarBg}>
                    {total > 0 && (
                      <View style={[styles.chartStackedBar, { width: pct }]}>
                        {only15k > 0 && <View style={[styles.seg, { flex: only15k, backgroundColor: STEP_COLORS['15k'] }]} />}
                        {only20k > 0 && <View style={[styles.seg, { flex: only20k, backgroundColor: STEP_COLORS['20k'] }]} />}
                        {only25k > 0 && <View style={[styles.seg, { flex: only25k, backgroundColor: STEP_COLORS['25k'] }]} />}
                        {only30k > 0 && <View style={[styles.seg, { flex: only30k, backgroundColor: STEP_COLORS['30k'] }]} />}
                      </View>
                    )}
                  </View>
                  <Text style={styles.chartCount}>{total}</Text>
                </View>
              );
            })}
            <View style={styles.chartLegend}>
              {[
                { label: '15K+', color: STEP_COLORS['15k'] },
                { label: '20K+', color: STEP_COLORS['20k'] },
                { label: '25K+', color: STEP_COLORS['25k'] },
                { label: '30K+', color: STEP_COLORS['30k'] },
              ].map(item => (
                <View key={item.label} style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.chartLegendText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Steps</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={8}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.innerTabRow}>
        {(['history', 'stats'] as InnerTab[]).map(t => (
          <Pressable
            key={t}
            style={[styles.innerTab, tab === t && styles.innerTabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.innerTabText, tab === t && styles.innerTabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'history' ? (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          renderItem={renderEntry}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>👟</Text>
                <Text style={styles.emptyTitle}>No steps logged yet</Text>
                <Text style={styles.emptyText}>Tap + to add your first step count.</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderStats()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {(editEntry || showAddModal) && (
        <EditStepModal
          entry={editEntry ?? undefined}
          onClose={() => { setEditEntry(null); setShowAddModal(false); }}
          onUpdate={() => { setEditEntry(null); setShowAddModal(false); fetchData(); }}
        />
      )}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  innerTabTextActive: { color: colors.textOnPrimary, fontWeight: typography.weights.semibold },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  entryRow: {
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
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entrySteps: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  entryDate: { fontSize: typography.sizes.xs, color: colors.textLight, marginTop: 2 },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statsCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dayItem: { alignItems: 'center', flex: 1 },
  dayEmoji: { fontSize: 22, marginBottom: spacing.xs },
  dayValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  dayLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  bestRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  bestLabel: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  bestValue: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.text },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  chartLabel: { width: 32, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.textSecondary },
  chartBarBg: {
    flex: 1,
    height: 24,
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  chartStackedBar: { height: '100%', borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  seg: { height: '100%' },
  chartCount: { width: 24, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.text, textAlign: 'right' },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendDot: { width: 10, height: 10, borderRadius: 2 },
  chartLegendText: { fontSize: 11, color: colors.textSecondary },
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
  emptyText: { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
});
