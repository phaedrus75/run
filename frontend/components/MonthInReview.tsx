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

          {/* Runs by Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏃 Runs by Distance</Text>
            <View style={styles.typeGrid}>
              {['3k', '5k', '10k', '15k', '18k', '21k'].map(type => {
                const count = data.runs_by_type[type] || 0;
                const totalForType = count * (
                  type === '3k' ? 3 : type === '5k' ? 5 : type === '10k' ? 10 : type === '15k' ? 15 : type === '18k' ? 18 : 21
                );
                return (
                  <View key={type} style={[styles.typeCard, shadows.small]}>
                    <View style={[styles.typeIcon, { backgroundColor: colors.runTypes[type] }]}>
                      <Text style={styles.typeIconText}>{type.toUpperCase()}</Text>
                    </View>
                    <View style={styles.typeCountRow}>
                      <Text style={styles.typeCount}>{count}</Text>
                      <Text style={styles.typeLabel}> runs</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            
            {/* Outdoor vs Treadmill */}
            <View style={styles.categoryRow}>
              <View style={styles.categoryItem}>
                <Text style={styles.categoryEmoji}>🌳</Text>
                <Text style={styles.categoryValue}>{data.outdoor_runs}</Text>
                <Text style={styles.categoryLabel}>Outdoor</Text>
              </View>
              <View style={styles.categoryDivider} />
              <View style={styles.categoryItem}>
                <Text style={styles.categoryEmoji}>🏋️</Text>
                <Text style={styles.categoryValue}>{data.treadmill_runs}</Text>
                <Text style={styles.categoryLabel}>Treadmill</Text>
              </View>
            </View>
          </View>

          {/* Steps Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👟 High Step Days</Text>
            <View style={styles.stepDaysRow}>
              <View style={styles.stepDayItem}>
                <Text style={styles.stepDayEmoji}>🚶</Text>
                <Text style={styles.stepDayValue}>{data.days_15k || 0}</Text>
                <Text style={styles.stepDayLabel}>15K+ days</Text>
              </View>
              <View style={styles.stepDayDivider} />
              <View style={styles.stepDayItem}>
                <Text style={styles.stepDayEmoji}>🏃</Text>
                <Text style={styles.stepDayValue}>{data.days_20k || 0}</Text>
                <Text style={styles.stepDayLabel}>20K+ days</Text>
              </View>
              <View style={styles.stepDayDivider} />
              <View style={styles.stepDayItem}>
                <Text style={styles.stepDayEmoji}>🔥</Text>
                <Text style={styles.stepDayValue}>{data.days_25k || 0}</Text>
                <Text style={styles.stepDayLabel}>25K+ days</Text>
              </View>
            </View>
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
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  headerEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  goalEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  goalText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
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
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Run type grid (like Stats screen)
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  typeCard: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.xs,
    alignItems: 'center',
    width: '31%',
    marginBottom: spacing.xs,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  typeIconText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  typeCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  typeCount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  typeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  categoryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  categoryLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  categoryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.background,
  },
  // High step days (15k+, 20k+, 25k+)
  stepDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stepDayItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDayEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  stepDayValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  stepDayLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  stepDayDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.background,
  },
  stepsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  stepsSummaryStat: {
    alignItems: 'center',
  },
  stepsSummaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  stepsSummaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  weightPoint: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  weightValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  weightArrow: {
    paddingHorizontal: spacing.md,
  },
  weightArrowText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  weightChange: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  weightChangeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  streakValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  streakLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  closeButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
