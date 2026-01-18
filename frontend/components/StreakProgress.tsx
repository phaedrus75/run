/**
 * 🔥 STREAK PROGRESS COMPONENT (COMPACT)
 * =======================================
 * 
 * Shows weekly progress toward maintaining the streak.
 * Goal: 1 long run (10k+) + 2 short runs
 * Compact design with checkmarks instead of progress bars.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { WeeklyStreakProgress } from '../services/api';

interface StreakProgressProps {
  progress: WeeklyStreakProgress;
}

export function StreakProgress({ progress }: StreakProgressProps) {
  const {
    long_runs_completed,
    long_runs_needed,
    short_runs_completed,
    short_runs_needed,
    is_complete,
    current_streak,
    longest_streak,
  } = progress;

  const longComplete = long_runs_completed >= long_runs_needed;
  const shortComplete = short_runs_completed >= short_runs_needed;

  return (
    <View style={[styles.container, shadows.small, is_complete && styles.containerComplete]}>
      {/* Left: Streak Count */}
      <View style={styles.streakSection}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{current_streak}</Text>
          <Text style={styles.streakLabel}>week{current_streak !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Right: Requirements */}
      <View style={styles.requirementsSection}>
        <View style={styles.requirementRow}>
          <Text style={[styles.checkIcon, longComplete && styles.checkComplete]}>
            {longComplete ? '✓' : '○'}
          </Text>
          <Text style={[styles.requirementText, longComplete && styles.requirementComplete]}>
            Long run (10k+)
          </Text>
          <Text style={styles.requirementCount}>{long_runs_completed}/{long_runs_needed}</Text>
        </View>
        <View style={styles.requirementRow}>
          <Text style={[styles.checkIcon, shortComplete && styles.checkComplete]}>
            {shortComplete ? '✓' : '○'}
          </Text>
          <Text style={[styles.requirementText, shortComplete && styles.requirementComplete]}>
            Short runs
          </Text>
          <Text style={styles.requirementCount}>{short_runs_completed}/{short_runs_needed}</Text>
        </View>
      </View>

      {/* Best Streak Badge */}
      {longest_streak > current_streak && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>Best: {longest_streak}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerComplete: {
    borderWidth: 1.5,
    borderColor: colors.success,
    backgroundColor: colors.success + '08',
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fireEmoji: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  streakInfo: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    lineHeight: typography.sizes.xl,
  },
  streakLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: -2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  requirementsSection: {
    flex: 1,
    gap: 2,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 12,
    color: colors.textLight,
    width: 16,
    textAlign: 'center',
  },
  checkComplete: {
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  requirementText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  requirementComplete: {
    color: colors.text,
    textDecorationLine: 'line-through',
  },
  requirementCount: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    fontWeight: typography.weights.medium,
  },
  bestBadge: {
    position: 'absolute',
    top: -6,
    right: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  bestText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
