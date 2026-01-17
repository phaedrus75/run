/**
 * 🎖️ ACHIEVEMENTS COMPONENT
 * ==========================
 * 
 * Shows unlocked and locked achievements.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { AchievementsData, Achievement } from '../services/api';

interface AchievementsProps {
  data: AchievementsData;
}

export function Achievements({ data }: AchievementsProps) {
  const [showLocked, setShowLocked] = useState(false);
  const { unlocked, locked, total, unlocked_count } = data;

  const renderAchievement = (achievement: Achievement, index: number) => (
    <View 
      key={achievement.id} 
      style={[
        styles.achievementCard,
        !achievement.unlocked && styles.lockedCard,
      ]}
    >
      <Text style={styles.emoji}>{achievement.emoji}</Text>
      <View style={styles.achievementInfo}>
        <Text style={[styles.name, !achievement.unlocked && styles.lockedText]}>
          {achievement.name}
        </Text>
        <Text style={[styles.description, !achievement.unlocked && styles.lockedText]}>
          {achievement.description}
        </Text>
      </View>
      {achievement.unlocked && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, shadows.small]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎖️ Achievements</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{unlocked_count}/{total}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill,
            { width: `${(unlocked_count / total) * 100}%` }
          ]} 
        />
      </View>

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Unlocked</Text>
          {unlocked.map(renderAchievement)}
        </View>
      )}

      {/* Toggle Locked */}
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={() => setShowLocked(!showLocked)}
      >
        <Text style={styles.toggleText}>
          {showLocked ? '▼ Hide Locked' : '▶ Show Locked'} ({locked.length})
        </Text>
      </TouchableOpacity>

      {/* Locked Achievements */}
      {showLocked && locked.length > 0 && (
        <View style={styles.section}>
          {locked.map(renderAchievement)}
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  lockedCard: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  emoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  achievementInfo: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  lockedText: {
    color: colors.textLight,
  },
  checkmark: {
    fontSize: 20,
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  toggleButton: {
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
