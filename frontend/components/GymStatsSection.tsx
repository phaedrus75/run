import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect, Polyline, Circle, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { GymStats, ExerciseHistoryEntry } from '../services/api';

interface GymStatsSectionProps {
  stats: GymStats;
}

export function GymStatsSection({ stats }: GymStatsSectionProps) {
  const exerciseNames = useMemo(
    () => Object.keys(stats.exercise_history || {}).sort(),
    [stats.exercise_history],
  );
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const activeExercise = selectedExercise ?? exerciseNames[0] ?? null;

  if (stats.total_workouts === 0) {
    return (
      <Text style={s.emptyText}>
        No gym workouts logged yet. Log your first session from the Activities tab.
      </Text>
    );
  }

  return (
    <View>
      <SummaryRow stats={stats} />
      <FrequencyChart frequency={stats.frequency || []} />
      <PersonalRecords records={stats.personal_records || {}} progression={stats.progression} />

      {exerciseNames.length > 0 && (
        <View style={[s.card, shadows.small]}>
          <Text style={s.cardTitle}>Exercise Progress</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.exerciseTabs}
            contentContainerStyle={s.exerciseTabsContent}
          >
            {exerciseNames.map(name => (
              <TouchableOpacity
                key={name}
                style={[s.exerciseTab, activeExercise === name && s.exerciseTabActive]}
                onPress={() => setSelectedExercise(name)}
              >
                <Text
                  style={[s.exerciseTabText, activeExercise === name && s.exerciseTabTextActive]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeExercise && (
            <ExerciseDetail
              name={activeExercise}
              history={stats.exercise_history[activeExercise] || []}
              progression={stats.progression[activeExercise]}
              pr={stats.personal_records?.[activeExercise]}
            />
          )}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Row                                                        */
/* ------------------------------------------------------------------ */

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function SummaryRow({ stats }: { stats: GymStats }) {
  return (
    <View>
      <View style={s.summaryRow}>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{stats.total_workouts}</Text>
          <Text style={s.summaryLabel}>Sessions</Text>
        </View>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{stats.this_week}/3</Text>
          <Text style={s.summaryLabel}>This Week</Text>
        </View>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{stats.streak_weeks}</Text>
          <Text style={s.summaryLabel}>Week Streak</Text>
        </View>
      </View>
      <View style={s.summaryRow}>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{stats.total_sets ?? 0}</Text>
          <Text style={s.summaryLabel}>Total Sets</Text>
        </View>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{formatVolume(stats.total_volume ?? 0)}</Text>
          <Text style={s.summaryLabel}>Volume (kg)</Text>
        </View>
        <View style={s.summaryBox}>
          <Text style={s.summaryValue}>{stats.unique_exercises ?? 0}</Text>
          <Text style={s.summaryLabel}>Exercises</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Frequency Bar Chart                                                */
/* ------------------------------------------------------------------ */

function FrequencyChart({ frequency }: { frequency: { week_start: string; count: number }[] }) {
  const [chartWidth, setChartWidth] = useState(0);
  if (frequency.length === 0) return null;

  const maxCount = Math.max(...frequency.map(f => f.count), 1);
  const chartHeight = 120;
  const barMaxHeight = chartHeight - 24;

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const formatWeekLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <View style={[s.card, shadows.small]}>
      <Text style={s.cardTitle}>Workout Frequency</Text>
      <Text style={s.cardSubtitle}>Sessions per week (last 12 weeks)</Text>

      <View style={{ height: chartHeight }} onLayout={onLayout}>
        {chartWidth > 0 && (
          <Svg width={chartWidth} height={chartHeight}>
            {frequency.map((week, i) => {
              const colWidth = chartWidth / frequency.length;
              const barW = Math.max(colWidth * 0.5, 8);
              const barH = maxCount > 0 ? (week.count / maxCount) * barMaxHeight : 0;
              const x = colWidth * i + (colWidth - barW) / 2;
              const y = chartHeight - 18 - barH;

              return (
                <React.Fragment key={i}>
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barH, 2)}
                    rx={4}
                    fill={week.count > 0 ? colors.primary : colors.surfaceAlt}
                    opacity={week.count > 0 ? 1 : 0.5}
                  />
                  {week.count > 0 && (
                    <SvgText
                      x={colWidth * i + colWidth / 2}
                      y={y - 4}
                      value={String(week.count)}
                      fontSize={10}
                      color={colors.text}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
        )}
      </View>

      <View style={s.freqLabels}>
        {frequency.map((week, i) => (
          <Text key={i} style={s.freqLabel}>{formatWeekLabel(week.week_start)}</Text>
        ))}
      </View>
    </View>
  );
}

function SvgText({ x, y, value, fontSize: fs, color: fill }: {
  x: number; y: number; value: string; fontSize: number; color: string;
}) {
  const SvgTextEl = require('react-native-svg').Text;
  return (
    <SvgTextEl
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={fs}
      fontWeight="600"
      fill={fill}
    >
      {value}
    </SvgTextEl>
  );
}

/* ------------------------------------------------------------------ */
/*  Personal Records                                                   */
/* ------------------------------------------------------------------ */

function PersonalRecords({
  records,
  progression,
}: {
  records: Record<string, { weight: number; date: string }>;
  progression: Record<string, { first: number; current: number }>;
}) {
  const entries = Object.entries(records).sort((a, b) => b[1].weight - a[1].weight);
  if (entries.length === 0) return null;

  return (
    <View style={[s.card, shadows.small]}>
      <View style={s.cardTitleRow}>
        <Ionicons name="trophy-outline" size={18} color={colors.accent} />
        <Text style={[s.cardTitle, { marginLeft: 6, marginBottom: 0 }]}>Personal Records</Text>
      </View>
      {entries.map(([name, pr]) => {
        const prog = progression[name];
        const diff = prog ? pr.weight - prog.first : 0;
        return (
          <View key={name} style={s.prRow}>
            <Text style={s.prName}>{name}</Text>
            <Text style={s.prWeight}>{pr.weight} kg</Text>
            {diff > 0 && (
              <Text style={s.prDelta}>+{diff} kg</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-Exercise Detail with Charts                                    */
/* ------------------------------------------------------------------ */

function ExerciseDetail({
  name,
  history,
  progression,
  pr,
}: {
  name: string;
  history: ExerciseHistoryEntry[];
  progression?: { first: number; current: number };
  pr?: { weight: number; date: string };
}) {
  if (history.length === 0) {
    return <Text style={s.emptyText}>No data yet for {name}</Text>;
  }

  const firstWeight = progression?.first ?? history[0].weight;
  const currentWeight = progression?.current ?? history[history.length - 1].weight;
  const weightDiff = currentWeight - firstWeight;
  const weightPct = firstWeight > 0 ? Math.round((weightDiff / firstWeight) * 100) : 0;

  const firstVol = history[0].volume;
  const currentVol = history[history.length - 1].volume;
  const volDiff = currentVol - firstVol;
  const volPct = firstVol > 0 ? Math.round((volDiff / firstVol) * 100) : 0;

  const bestSet = pr
    ? `${pr.weight}kg`
    : `${currentWeight}kg`;

  const totalSets = history.reduce((sum, h) => sum + (h.sets ?? 0), 0);
  const totalReps = history.reduce((sum, h) => sum + (h.reps ?? 0), 0);
  const totalVol = history.reduce((sum, h) => sum + h.volume, 0);

  return (
    <View style={s.detailContainer}>
      <View style={s.detailStatsRow}>
        <View style={s.detailStat}>
          <Text style={s.detailStatLabel}>Sessions</Text>
          <Text style={s.detailStatValue}>{history.length}</Text>
        </View>
        <View style={s.detailStat}>
          <Text style={s.detailStatLabel}>Best</Text>
          <Text style={s.detailStatValue}>{bestSet}</Text>
        </View>
        <View style={s.detailStat}>
          <Text style={s.detailStatLabel}>Sets</Text>
          <Text style={s.detailStatValue}>{totalSets}</Text>
        </View>
        <View style={s.detailStat}>
          <Text style={s.detailStatLabel}>Reps</Text>
          <Text style={s.detailStatValue}>{totalReps}</Text>
        </View>
        <View style={s.detailStat}>
          <Text style={s.detailStatLabel}>Volume</Text>
          <Text style={s.detailStatValue}>{formatVolume(totalVol)}</Text>
        </View>
      </View>

      <MiniLineChart
        title="Weight"
        data={history.map(h => h.weight)}
        labels={history.map(h => h.date)}
        suffix="kg"
        summaryLeft={`${firstWeight} \u2192 ${currentWeight} kg`}
        summaryRight={weightPct !== 0 ? `${weightPct > 0 ? '+' : ''}${weightPct}%` : undefined}
        summaryRightColor={weightDiff > 0 ? colors.success : weightDiff < 0 ? colors.error : colors.text}
        lineColor={colors.primary}
      />

      <MiniLineChart
        title="Volume"
        data={history.map(h => h.volume)}
        labels={history.map(h => h.date)}
        suffix="kg"
        summaryLeft={`${firstVol.toLocaleString()} \u2192 ${currentVol.toLocaleString()} kg`}
        summaryRight={volPct !== 0 ? `${volPct > 0 ? '+' : ''}${volPct}%` : undefined}
        summaryRightColor={volDiff > 0 ? colors.success : volDiff < 0 ? colors.error : colors.text}
        lineColor={colors.secondary}
      />

      {history.some(h => (h.sets ?? 0) > 0) && (
        <MiniLineChart
          title="Sets per Session"
          data={history.map(h => h.sets ?? 0)}
          labels={history.map(h => h.date)}
          suffix=""
          summaryLeft={`${history[0].sets ?? 0} \u2192 ${history[history.length - 1].sets ?? 0}`}
          lineColor={colors.accent}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini Line Chart                                                    */
/* ------------------------------------------------------------------ */

function MiniLineChart({
  title,
  data,
  labels,
  suffix,
  summaryLeft,
  summaryRight,
  summaryRightColor,
  lineColor,
}: {
  title: string;
  data: number[];
  labels: string[];
  suffix: string;
  summaryLeft: string;
  summaryRight?: string;
  summaryRightColor?: string;
  lineColor: string;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 100;
  const padX = 8;
  const padY = 12;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const points = useMemo(() => {
    if (chartWidth === 0 || data.length === 0) return [];
    const usableW = chartWidth - padX * 2;
    const usableH = chartHeight - padY * 2;
    return data.map((val, i) => ({
      x: padX + (data.length > 1 ? (i / (data.length - 1)) * usableW : usableW / 2),
      y: padY + usableH - ((val - minVal) / range) * usableH,
    }));
  }, [chartWidth, data, minVal, range]);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  if (data.length < 2) return null;

  return (
    <View style={s.miniChartContainer}>
      <View style={s.miniChartHeader}>
        <Text style={s.miniChartTitle}>{title}</Text>
        <View style={s.miniChartSummary}>
          <Text style={s.miniChartSummaryText}>{summaryLeft}</Text>
          {summaryRight && (
            <Text style={[s.miniChartDelta, { color: summaryRightColor }]}>{summaryRight}</Text>
          )}
        </View>
      </View>

      <View style={{ height: chartHeight }} onLayout={onLayout}>
        {chartWidth > 0 && points.length > 1 && (
          <Svg width={chartWidth} height={chartHeight}>
            <Line
              x1={padX} y1={chartHeight - padY}
              x2={chartWidth - padX} y2={chartHeight - padY}
              stroke={colors.surfaceAlt} strokeWidth={1}
            />
            <Line
              x1={padX} y1={padY}
              x2={chartWidth - padX} y2={padY}
              stroke={colors.surfaceAlt} strokeWidth={1}
            />
            <Polyline
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={lineColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={lineColor}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
      </View>

      <View style={s.miniChartLabels}>
        <Text style={s.miniChartLabel}>{minVal}{suffix}</Text>
        <Text style={s.miniChartLabel}>{maxVal}{suffix}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.lg,
    fontSize: typography.sizes.sm,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  summaryValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // Frequency
  freqLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 2,
  },
  freqLabel: {
    fontSize: 9,
    color: colors.textLight,
    flex: 1,
    textAlign: 'center',
  },

  // Personal Records
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceAlt,
  },
  prName: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  prWeight: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  prDelta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    marginLeft: 6,
    minWidth: 50,
    textAlign: 'right',
  },

  // Exercise Tabs
  exerciseTabs: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  exerciseTabsContent: {
    gap: spacing.xs,
  },
  exerciseTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  exerciseTabActive: {
    backgroundColor: colors.primary,
  },
  exerciseTabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  exerciseTabTextActive: {
    color: '#fff',
  },

  // Exercise Detail
  detailContainer: {
    marginTop: spacing.xs,
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  detailStat: {
    alignItems: 'center',
  },
  detailStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailStatValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },

  // Mini Line Chart
  miniChartContainer: {
    marginBottom: spacing.md,
  },
  miniChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  miniChartTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  miniChartSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniChartSummaryText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  miniChartDelta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  miniChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  miniChartLabel: {
    fontSize: 10,
    color: colors.textLight,
  },
});
