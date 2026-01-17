/**
 * 📊 STAT CARD COMPONENT
 * ======================
 * 
 * A beautiful card for displaying statistics.
 * 
 * 🎓 LEARNING NOTES:
 * - Components should be small and focused (Single Responsibility)
 * - We use TypeScript interfaces for type safety
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  style?: ViewStyle;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  color = colors.primary,
  style,
}: StatCardProps) {
  return (
    <View style={[styles.card, shadows.small, style]}>
      {icon && (
        <Text style={styles.icon}>{icon}</Text>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    minWidth: 100,
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
