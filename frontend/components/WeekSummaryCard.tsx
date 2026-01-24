/**
 * 📊 WEEK SUMMARY CARD
 * =====================
 * 
 * Combined card showing this week's stats + motivational message.
 * Clean, compact design at the top of the home screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

interface WeekSummaryCardProps {
  runsThisWeek: number;
  kmThisWeek: number;
}

export function WeekSummaryCard({ runsThisWeek, kmThisWeek }: WeekSummaryCardProps) {
  return (
    <View style={[styles.container, shadows.medium]}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{kmThisWeek.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km this week</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{runsThisWeek}</Text>
          <Text style={styles.statLabel}>{runsThisWeek === 1 ? 'run' : 'runs'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    lineHeight: 28 * 1.1,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});

