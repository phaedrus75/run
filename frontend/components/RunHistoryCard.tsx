/**
 * 🏃 RUN HISTORY CARD
 * ===================
 * 
 * Displays a single run in the history list.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { Run } from '../services/api';

interface RunHistoryCardProps {
  run: Run;
  onPress?: () => void;
}

export function RunHistoryCard({ run, onPress }: RunHistoryCardProps) {
  const typeColor = colors.runTypes[run.run_type] || colors.primary;
  
  // Format the date nicely
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };
  
  return (
    <TouchableOpacity 
      style={[styles.card, shadows.small]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left: Run Type Badge */}
      <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
        <Text style={styles.typeText}>{run.run_type.toUpperCase()}</Text>
      </View>
      
      {/* Middle: Details */}
      <View style={styles.details}>
        <Text style={styles.duration}>{run.formatted_duration}</Text>
        <Text style={styles.date}>
          {formatDate(run.completed_at)}
          {run.category === 'treadmill' && ' 🏃'}
          {run.category === 'outdoor' && ' 🌳'}
        </Text>
      </View>
      
      {/* Right: Pace */}
      <View style={styles.paceContainer}>
        <Text style={styles.paceValue}>{run.pace_per_km}</Text>
        <Text style={styles.paceLabel}>min/km</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  details: {
    flex: 1,
    marginLeft: spacing.md,
  },
  duration: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  date: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  paceContainer: {
    alignItems: 'flex-end',
  },
  paceValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.secondary,
  },
  paceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
