/**
 * 🎉 MOTIVATION BANNER
 * ====================
 * 
 * Displays encouraging messages and achievements!
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

interface MotivationBannerProps {
  message: string;
  emoji: string;
  achievement?: string;
}

export function MotivationBanner({ message, emoji, achievement }: MotivationBannerProps) {
  return (
    <View style={[styles.container, shadows.medium]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {achievement && (
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementText}>🏆 {achievement}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  emoji: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    lineHeight: 22,
  },
  achievementBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  achievementText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
