import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { WeeklyStreakProgress, StreakPeriod } from '../services/api';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  progress: WeeklyStreakProgress | null;
  streakHistory?: StreakPeriod[];
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StreakModal({ visible, onClose, progress, streakHistory = [] }: StreakModalProps) {
  if (!progress) return null;

  const {
    runs_completed,
    runs_needed,
    is_complete,
    current_streak,
    longest_streak,
    message,
  } = progress;

  const runProgress = Math.min(100, (runs_completed / runs_needed) * 100);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, shadows.large]}>
          <View style={styles.header}>
            <Text style={styles.title}>🌳 Weekly Streak</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.streakCard, is_complete && styles.streakCardComplete]}>
              <Text style={styles.streakEmoji}>
                {current_streak >= 26 ? '🌲' : current_streak >= 12 ? '🌳' : current_streak >= 4 ? '🌴' : current_streak >= 2 ? '🌿' : '🌱'}
              </Text>
              <Text style={styles.streakNumber}>{current_streak}</Text>
              <Text style={styles.streakLabel}>
                week{current_streak !== 1 ? 's' : ''} streak
              </Text>
              {longest_streak > current_streak && (
                <Text style={styles.bestStreak}>Best: {longest_streak} weeks</Text>
              )}
              {longest_streak === current_streak && current_streak > 0 && (
                <Text style={styles.bestStreakCurrent}>🌟 Personal Best!</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>This Week's Progress</Text>

            <View style={styles.progressCard}>
              <View style={styles.progressItem}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.checkIcon, is_complete && styles.checkComplete]}>
                    {is_complete ? '✓' : '○'}
                  </Text>
                  <Text style={styles.progressLabel}>Runs</Text>
                  <Text style={styles.progressCount}>
                    {runs_completed}/{runs_needed}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${runProgress}%` },
                      is_complete && styles.progressBarComplete,
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.messageCard, is_complete && styles.messageCardComplete]}>
              <Text style={styles.messageText}>{message}</Text>
            </View>

            {streakHistory.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Streak History</Text>
                <View style={styles.timelineCard}>
                  {streakHistory.slice().reverse().map((streak, i) => {
                    const maxLen = Math.max(...streakHistory.map(s => s.length), 1);
                    const barWidth = Math.max(20, (streak.length / maxLen) * 100);
                    return (
                      <View key={i} style={styles.timelineRow}>
                        <View style={styles.timelineDates}>
                          <Text style={styles.timelineDateText}>
                            {formatWeekDate(streak.start_week)}
                          </Text>
                        </View>
                        <View style={styles.timelineBarContainer}>
                          <View
                            style={[
                              styles.timelineBar,
                              {
                                width: `${barWidth}%`,
                                backgroundColor: streak.is_current ? colors.primary : colors.primaryLight,
                              },
                            ]}
                          >
                            <Text style={styles.timelineBarText}>
                              {streak.length}w
                            </Text>
                          </View>
                        </View>
                        {streak.is_current && (
                          <Text style={styles.timelineCurrentBadge}>now</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>How Streaks Work</Text>
            <View style={styles.rulesCard}>
              <Text style={styles.ruleText}>
                ✅ Complete <Text style={styles.ruleBold}>2 runs of any distance</Text> each week
              </Text>
              <Text style={styles.ruleHint}>
                Week resets every Sunday at midnight
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  streakCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  streakCardComplete: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.success + '08',
  },
  streakEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    lineHeight: 60,
  },
  streakLabel: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bestStreak: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  bestStreakCurrent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  progressItem: {
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  checkIcon: {
    fontSize: 14,
    color: colors.textLight,
    width: 20,
  },
  checkComplete: {
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  progressLabel: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  progressCount: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: colors.success,
  },
  messageCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  messageCardComplete: {
    backgroundColor: colors.success + '15',
  },
  messageText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  rulesCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  ruleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  ruleBold: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  ruleHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDates: {
    width: 60,
  },
  timelineDateText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  timelineBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  timelineBar: {
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 10,
    minWidth: 36,
  },
  timelineBarText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
  timelineCurrentBadge: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    width: 24,
  },
});
