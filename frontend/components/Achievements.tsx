import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { AchievementsData, Achievement } from '../services/api';

interface AchievementsProps {
  data: AchievementsData;
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  milestone: { label: 'First Steps', emoji: '🌱' },
  distance: { label: 'The Long Road', emoji: '🛤️' },
  distance_type: { label: 'New Ground', emoji: '🌿' },
  specialist: { label: 'Finding Your Rhythm', emoji: '🍃' },
  streak: { label: 'Practice', emoji: '🌳' },
  goals: { label: 'Horizons', emoji: '🌅' },
  category: { label: 'Outdoor & Indoor', emoji: '🏞️' },
  steps: { label: 'Daily Movement', emoji: '🚶' },
  scenic: { label: 'Trail Album', emoji: '📷' },
  levels: { label: 'Your Path', emoji: '🌊' },
  dedication: { label: 'Showing Up', emoji: '🌤️' },
  mood: { label: 'Reflection', emoji: '🪞' },
  walking: { label: 'Walking the Path', emoji: '🚶' },
};

const CATEGORY_ORDER = [
  'milestone', 'distance', 'distance_type', 'specialist',
  'streak', 'goals', 'category', 'steps',
  'scenic', 'walking', 'levels', 'dedication', 'mood',
];

function groupByCategory(achievements: Achievement[]): Record<string, Achievement[]> {
  const groups: Record<string, Achievement[]> = {};
  for (const a of achievements) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }
  return groups;
}

export function Achievements({ data }: AchievementsProps) {
  const [showLocked, setShowLocked] = useState(false);
  const { unlocked, locked, total, unlocked_count } = data;

  const allAchievements = [...unlocked, ...locked];
  const grouped = groupByCategory(allAchievements);

  const renderBadge = (achievement: Achievement) => (
    <View
      key={achievement.id}
      style={[
        styles.badge,
        !achievement.unlocked && styles.lockedBadge,
      ]}
    >
      <Text style={[styles.badgeEmoji, !achievement.unlocked && styles.lockedEmoji]}>
        {achievement.emoji}
      </Text>
      <Text
        style={[styles.badgeName, !achievement.unlocked && styles.lockedText]}
      >
        {achievement.name}
      </Text>
      <Text
        style={[styles.badgeDesc, !achievement.unlocked && styles.lockedText]}
      >
        {achievement.description}
      </Text>
      {achievement.unlocked && (
        <View style={styles.unlockedDot} />
      )}
    </View>
  );

  const visibleCategories = showLocked
    ? CATEGORY_ORDER.filter(c => grouped[c]?.length)
    : CATEGORY_ORDER.filter(c => grouped[c]?.some(a => a.unlocked));

  return (
    <View style={[styles.container, shadows.small]}>
      <View style={styles.header}>
        <Text style={styles.title}>Milestones</Text>
        {unlocked_count > 0 && (
          <Text style={styles.countSubtle}>{unlocked_count} earned</Text>
        )}
      </View>

      {visibleCategories.map(cat => {
        const items = grouped[cat] || [];
        const catInfo = CATEGORY_LABELS[cat] || { label: cat, emoji: '' };
        const visible = showLocked ? items : items.filter(a => a.unlocked);
        if (visible.length === 0) return null;

        return (
          <View key={cat} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {catInfo.emoji} {catInfo.label}
            </Text>
            <View style={styles.badgeGrid}>
              {visible.map(renderBadge)}
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowLocked(!showLocked)}
      >
        <Text style={styles.toggleText}>
          {showLocked ? 'Show earned' : 'See what\u2019s ahead'}
        </Text>
      </TouchableOpacity>
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
  countSubtle: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontWeight: typography.weights.medium,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  badge: {
    width: '30%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginHorizontal: '1.5%',
    marginBottom: spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  lockedBadge: {
    backgroundColor: colors.background,
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  lockedEmoji: {
    opacity: 0.5,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
  },
  lockedText: {
    color: colors.textLight,
  },
  unlockedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  toggleButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
