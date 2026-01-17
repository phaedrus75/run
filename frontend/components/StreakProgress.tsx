/**
 * 🔥 STREAK PROGRESS COMPONENT
 * =============================
 * 
 * Shows weekly progress toward maintaining the streak.
 * Goal: 1 long run (10k+) + 2 short runs
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
    message,
  } = progress;

  return (
    <View style={[styles.container, shadows.medium, is_complete && styles.containerComplete]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔥 Weekly Streak</Text>
        <View style={styles.streakBadge}>
          <Text style={styles.streakNumber}>{current_streak}</Text>
          <Text style={styles.streakLabel}>weeks</Text>
        </View>
      </View>

      {/* Progress Bars */}
      <View style={styles.progressSection}>
        {/* Long Run */}
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Long Run (10k+)</Text>
            <Text style={styles.progressCount}>
              {long_runs_completed}/{long_runs_needed}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${Math.min(100, (long_runs_completed / long_runs_needed) * 100)}%`,
                  backgroundColor: long_runs_completed >= long_runs_needed ? colors.success : colors.primary,
                }
              ]} 
            />
          </View>
          {long_runs_completed >= long_runs_needed && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>

        {/* Short Runs */}
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Short Runs</Text>
            <Text style={styles.progressCount}>
              {short_runs_completed}/{short_runs_needed}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${Math.min(100, (short_runs_completed / short_runs_needed) * 100)}%`,
                  backgroundColor: short_runs_completed >= short_runs_needed ? colors.success : colors.secondary,
                }
              ]} 
            />
          </View>
          {short_runs_completed >= short_runs_needed && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
      </View>

      {/* Message */}
      <View style={[styles.messageContainer, is_complete && styles.messageComplete]}>
        <Text style={[styles.message, is_complete && styles.messageTextComplete]}>
          {message}
        </Text>
      </View>

      {/* Best Streak */}
      {longest_streak > 0 && (
        <Text style={styles.bestStreak}>
          🏆 Best: {longest_streak} week{longest_streak !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  containerComplete: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  streakNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  streakLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textOnPrimary,
    opacity: 0.8,
  },
  progressSection: {
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressInfo: {
    width: 110,
  },
  progressLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  progressCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  checkmark: {
    fontSize: 16,
    color: colors.success,
    marginLeft: spacing.sm,
    fontWeight: typography.weights.bold,
  },
  messageContainer: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  messageComplete: {
    backgroundColor: colors.success + '20',
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  messageTextComplete: {
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },
  bestStreak: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
});
