/**
 * 🎯 GOALS PROGRESS COMPONENT
 * ============================
 * 
 * Shows progress toward yearly (1000km) and monthly (100km) goals.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { GoalsProgress as GoalsProgressType } from '../services/api';

interface GoalsProgressProps {
  goals: GoalsProgressType;
}

export function GoalsProgress({ goals }: GoalsProgressProps) {
  const { yearly, monthly } = goals;

  return (
    <View style={styles.container}>
      {/* Yearly Goal */}
      <View style={[styles.goalCard, shadows.small]}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>🎯 2026 Goal</Text>
          <Text style={[styles.statusBadge, yearly.on_track ? styles.onTrack : styles.behindTrack]}>
            {yearly.on_track ? '✓ On Track' : 'Push harder!'}
          </Text>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${yearly.percent}%`,
                  backgroundColor: yearly.percent >= 100 ? colors.success : colors.primary,
                }
              ]} 
            />
          </View>
          <Text style={styles.progressPercent}>{yearly.percent}%</Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{yearly.current_km}</Text>
            <Text style={styles.statLabel}>km done</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{yearly.remaining_km}</Text>
            <Text style={styles.statLabel}>km to go</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{yearly.days_remaining}</Text>
            <Text style={styles.statLabel}>days left</Text>
          </View>
        </View>
      </View>

      {/* Monthly Goal */}
      <View style={[styles.goalCard, shadows.small, monthly.is_complete && styles.goalComplete]}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>📅 {monthly.month_name}</Text>
          {monthly.is_complete && (
            <Text style={styles.completeBadge}>🎉 Complete!</Text>
          )}
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${monthly.percent}%`,
                  backgroundColor: monthly.is_complete ? colors.success : colors.secondary,
                }
              ]} 
            />
          </View>
          <Text style={styles.progressPercent}>{monthly.percent}%</Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthly.current_km}</Text>
            <Text style={styles.statLabel}>of {monthly.goal_km}km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthly.remaining_km}</Text>
            <Text style={styles.statLabel}>km to go</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthly.days_remaining}</Text>
            <Text style={styles.statLabel}>days left</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  goalComplete: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  goalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statusBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
  },
  onTrack: {
    backgroundColor: colors.success + '20',
    color: colors.success,
  },
  behindTrack: {
    backgroundColor: colors.warning + '20',
    color: colors.warning,
  },
  completeBadge: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressPercent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    width: 45,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
