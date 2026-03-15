import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { RhythmPlant } from './RhythmPlant';

interface StreakProgressProps {
  progress: {
    runs_completed: number;
    runs_needed: number;
    is_complete: boolean;
    current_streak: number;
    longest_streak: number;
    message: string;
  };
}

export function StreakProgress({ progress }: StreakProgressProps) {
  const {
    runs_completed,
    runs_needed,
    is_complete,
    current_streak,
    longest_streak,
  } = progress;

  return (
    <View style={[styles.container, shadows.small, is_complete && styles.containerComplete]}>
      <View style={styles.streakSection}>
        <RhythmPlant weeks={current_streak} size="small" />
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{current_streak}</Text>
          <Text style={styles.streakLabel}>week{current_streak !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.requirementsSection}>
        <View style={styles.requirementRow}>
          <Text style={[styles.checkIcon, is_complete && styles.checkComplete]}>
            {is_complete ? '✓' : '○'}
          </Text>
          <Text style={[styles.requirementText, is_complete && styles.requirementComplete]}>
            2 runs this week
          </Text>
          <Text style={styles.requirementCount}>{runs_completed}/{runs_needed}</Text>
        </View>
        {runs_completed === 1 && !is_complete && (
          <Text style={styles.nudge}>One more and you've shown up this week</Text>
        )}
      </View>

      {longest_streak > current_streak && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>Longest: {longest_streak}</Text>
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
    backgroundColor: colors.textLight + '40',
    marginHorizontal: spacing.md,
  },
  requirementsSection: {
    flex: 1,
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
  nudge: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
    marginLeft: 20,
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
