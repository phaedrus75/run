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
  motivation?: {
    message: string;
    emoji: string;
    achievement?: string;
  };
}

export function WeekSummaryCard({ runsThisWeek, kmThisWeek, motivation }: WeekSummaryCardProps) {
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

      {/* Motivation Message */}
      {motivation && (
        <View style={styles.motivationRow}>
          <Text style={styles.emoji}>{motivation.emoji}</Text>
          <View style={styles.motivationContent}>
            <Text style={styles.motivationText}>{motivation.message}</Text>
            {motivation.achievement && (
              <View style={styles.achievementBadge}>
                <Text style={styles.achievementText}>🏆 {motivation.achievement}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.hero,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    lineHeight: typography.sizes.hero * 1.1,
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
  motivationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  motivationContent: {
    flex: 1,
  },
  motivationText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  achievementBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  achievementText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
