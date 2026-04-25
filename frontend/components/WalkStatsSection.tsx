/**
 * 🚶 Walk Stats Section
 * =====================
 *
 * Renders the walk-stats card on the Stats screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WalkStats } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  stats: WalkStats | null;
  recentCount?: number;
}

export function WalkStatsSection({ stats, recentCount }: Props) {
  if (!stats || stats.total_walks === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🚶</Text>
        <Text style={styles.emptyTitle}>No walks yet</Text>
        <Text style={styles.emptyText}>
          Start a walk from the Walk tab — distance, route and time are tracked
          automatically.
        </Text>
      </View>
    );
  }

  const avgPace = stats.avg_pace_seconds_per_km;
  const avgPaceLabel = avgPace
    ? `${Math.floor(avgPace / 60)}:${Math.floor(avgPace % 60)
        .toString()
        .padStart(2, '0')} /km`
    : '--';

  return (
    <View>
      {/* Headline */}
      <View style={styles.heroCard}>
        <Text style={styles.heroValue}>{stats.total_walks}</Text>
        <Text style={styles.heroLabel}>walks logged</Text>
        <Text style={styles.heroSub}>
          {stats.total_km.toFixed(1)} km total · {Math.round(stats.total_minutes)}{' '}
          min total
        </Text>
      </View>

      {/* Quick stats grid */}
      <View style={styles.grid}>
        <Tile
          icon="calendar-outline"
          value={String(stats.walks_this_week)}
          label="This week"
          hint={`${stats.km_this_week.toFixed(1)} km`}
        />
        <Tile
          icon="trending-up-outline"
          value={String(stats.walks_this_month)}
          label="This month"
          hint={`${stats.km_this_month.toFixed(1)} km`}
        />
        <Tile
          icon="trophy-outline"
          value={`${stats.longest_walk_km.toFixed(1)} km`}
          label="Longest walk"
          hint={`${Math.round(stats.longest_walk_minutes)} min`}
        />
        <Tile
          icon="speedometer-outline"
          value={avgPaceLabel}
          label="Avg pace"
          hint="across all walks"
        />
      </View>

      {recentCount != null && (
        <Text style={styles.footer}>
          Showing {recentCount} most recent walks
        </Text>
      )}
    </View>
  );
}

function Tile({
  icon,
  value,
  label,
  hint,
}: {
  icon: any;
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={20} color={colors.secondary} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.small,
  },
  heroValue: {
    fontSize: 48,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  heroLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroSub: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-start',
    ...shadows.small,
  },
  tileValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 6,
  },
  tileLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tileHint: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.small,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 6 },
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
  footer: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
