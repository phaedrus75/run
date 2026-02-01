/**
 * 📅 MONTH IN REVIEW
 * ==================
 * 
 * A comprehensive monthly summary shown at the end of each month
 * and during the first week of the next month.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { MonthInReview as MonthInReviewType } from '../services/api';

interface Props {
  data: MonthInReviewType;
  onDismiss?: () => void;
}

const { width } = Dimensions.get('window');

export function MonthInReview({ data, onDismiss }: Props) {
  const [showModal, setShowModal] = useState(true);

  // Safety check - ensure data exists and should_show is true
  if (!data || !data.should_show) {
    return null;
  }

  // Format duration as hours and minutes
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get change indicator
  const getChangeIndicator = (value: number) => {
    if (value > 0) return { text: `+${value}`, color: colors.success, emoji: '📈' };
    if (value < 0) return { text: `${value}`, color: colors.error, emoji: '📉' };
    return { text: '0', color: colors.textSecondary, emoji: '➡️' };
  };

  const kmChange = getChangeIndicator(data.km_vs_last_month || 0);
  const runsChange = getChangeIndicator(data.runs_vs_last_month || 0);

  const handleClose = () => {
    setShowModal(false);
    onDismiss?.();
  };

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>📅</Text>
            <Text style={styles.headerTitle}>{data.month_name}</Text>
            <Text style={styles.headerSubtitle}>Month in Review</Text>
          </View>

          {/* Goal Status Banner */}
          <View style={[
            styles.goalBanner,
            { backgroundColor: data.goal_met ? colors.success + '20' : colors.warning + '20' }
          ]}>
            <Text style={styles.goalEmoji}>{data.goal_met ? '🎉' : '💪'}</Text>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalTitle, { color: data.goal_met ? colors.success : colors.warning }]}>
                {data.goal_met ? 'Goal Achieved!' : 'Keep Pushing!'}
              </Text>
              <Text style={styles.goalText}>
                {data.monthly_km_achieved || 0} / {data.monthly_km_goal || 0} km ({(data.goal_percent || 0).toFixed(0)}%)
              </Text>
            </View>
          </View>

          {/* Key Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.total_runs}</Text>
              <Text style={styles.statLabel}>Runs</Text>
              <View style={styles.changeIndicator}>
                <Text style={[styles.changeText, { color: runsChange.color }]}>
                  {runsChange.emoji} {runsChange.text} vs last month
                </Text>
              </View>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(data.total_km || 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Kilometers</Text>
              <View style={styles.changeIndicator}>
                <Text style={[styles.changeText, { color: kmChange.color }]}>
                  {kmChange.emoji} {kmChange.text} km
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDuration(data.total_duration_seconds)}</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.avg_pace}</Text>
              <Text style={styles.statLabel}>Avg Pace</Text>
            </View>
          </View>

          {/* Run Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏃 Run Breakdown</Text>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{data.outdoor_runs}</Text>
                <Text style={styles.breakdownLabel}>Outdoor</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{data.treadmill_runs}</Text>
                <Text style={styles.breakdownLabel}>Treadmill</Text>
              </View>
            </View>
            
            {/* Runs by type */}
            {Object.keys(data.runs_by_type).length > 0 && (
              <View style={styles.typeBreakdown}>
                {Object.entries(data.runs_by_type)
                  .sort(([a], [b]) => {
                    const numA = parseInt(a);
                    const numB = parseInt(b);
                    return numA - numB;
                  })
                  .map(([type, count]) => (
                    <View key={type} style={styles.typeChip}>
                      <Text style={styles.typeText}>{type}: {count}</Text>
                    </View>
                  ))
                }
              </View>
            )}
          </View>

          {/* Steps Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👟 Steps</Text>
            <View style={styles.stepsGrid}>
              <View style={styles.stepsStat}>
                <Text style={styles.stepsValue}>{data.total_step_days}</Text>
                <Text style={styles.stepsLabel}>Days Logged</Text>
              </View>
              <View style={styles.stepsStat}>
                <Text style={styles.stepsValue}>{data.high_step_days}</Text>
                <Text style={styles.stepsLabel}>10K+ Days</Text>
              </View>
              <View style={styles.stepsStat}>
                <Text style={styles.stepsValue}>
                  {(data.avg_daily_steps || 0) >= 1000 
                    ? `${((data.avg_daily_steps || 0) / 1000).toFixed(1)}k`
                    : data.avg_daily_steps || 0}
                </Text>
                <Text style={styles.stepsLabel}>Avg/Day</Text>
              </View>
            </View>
            <Text style={styles.totalSteps}>
              Total: {(data.total_steps || 0).toLocaleString()} steps
            </Text>
          </View>

          {/* Weight Progress */}
          {data.start_weight && data.end_weight && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚖️ Weight</Text>
              <View style={styles.weightRow}>
                <View style={styles.weightPoint}>
                  <Text style={styles.weightLabel}>Start</Text>
                  <Text style={styles.weightValue}>{data.start_weight?.toFixed(1)} lbs</Text>
                </View>
                <View style={styles.weightArrow}>
                  <Text style={styles.weightArrowText}>→</Text>
                </View>
                <View style={styles.weightPoint}>
                  <Text style={styles.weightLabel}>End</Text>
                  <Text style={styles.weightValue}>{data.end_weight?.toFixed(1)} lbs</Text>
                </View>
              </View>
              {data.weight_change !== null && (
                <View style={[
                  styles.weightChange,
                  { backgroundColor: data.weight_change <= 0 ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Text style={[
                    styles.weightChangeText,
                    { color: data.weight_change <= 0 ? colors.success : colors.warning }
                  ]}>
                    {(data.weight_change || 0) <= 0 ? '📉' : '📈'} {(data.weight_change || 0) > 0 ? '+' : ''}{(data.weight_change || 0).toFixed(1)} lbs
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Streak */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Best Streak</Text>
            <View style={styles.streakRow}>
              <Text style={styles.streakValue}>{data.best_streak_in_month}</Text>
              <Text style={styles.streakLabel}>consecutive run days</Text>
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Got it! 👍</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  goalEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  goalText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  statValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeIndicator: {
    marginTop: spacing.xs,
  },
  changeText: {
    fontSize: typography.sizes.xs,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.background,
  },
  breakdownValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  breakdownLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typeBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  typeChip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  typeText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  stepsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  stepsStat: {
    alignItems: 'center',
  },
  stepsValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  stepsLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalSteps: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  weightPoint: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  weightValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  weightArrow: {
    paddingHorizontal: spacing.lg,
  },
  weightArrowText: {
    fontSize: typography.sizes.xl,
    color: colors.textSecondary,
  },
  weightChange: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  weightChangeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  streakValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  streakLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  closeButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
});
