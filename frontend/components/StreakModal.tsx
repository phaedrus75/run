/**
 * 🔥 STREAK MODAL
 * ================
 * 
 * Shows detailed streak information when clicking on the streak badge.
 * Displays current week progress and streak history.
 */

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
import type { WeeklyStreakProgress } from '../services/api';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  progress: WeeklyStreakProgress | null;
}

export function StreakModal({ visible, onClose, progress }: StreakModalProps) {
  if (!progress) return null;

  const {
    long_runs_completed,
    long_runs_needed,
    short_runs_completed,
    short_runs_needed,
    is_complete,
    current_streak,
    longest_streak,
    message,
  } = progress;

  const longComplete = long_runs_completed >= long_runs_needed;
  const shortComplete = short_runs_completed >= short_runs_needed;

  // Calculate progress percentages
  const longProgress = Math.min(100, (long_runs_completed / long_runs_needed) * 100);
  const shortProgress = Math.min(100, (short_runs_completed / short_runs_needed) * 100);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, shadows.large]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🔥 Weekly Streak</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Current Streak */}
            <View style={[styles.streakCard, is_complete && styles.streakCardComplete]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{current_streak}</Text>
              <Text style={styles.streakLabel}>
                week{current_streak !== 1 ? 's' : ''} streak
              </Text>
              {longest_streak > current_streak && (
                <Text style={styles.bestStreak}>Best: {longest_streak} weeks</Text>
              )}
              {longest_streak === current_streak && current_streak > 0 && (
                <Text style={styles.bestStreakCurrent}>🏆 Personal Best!</Text>
              )}
            </View>

            {/* This Week Progress */}
            <Text style={styles.sectionTitle}>This Week's Progress</Text>
            
            <View style={styles.progressCard}>
              {/* Long Run Progress */}
              <View style={styles.progressItem}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.checkIcon, longComplete && styles.checkComplete]}>
                    {longComplete ? '✓' : '○'}
                  </Text>
                  <Text style={styles.progressLabel}>Long Run (10k+)</Text>
                  <Text style={styles.progressCount}>
                    {long_runs_completed}/{long_runs_needed}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${longProgress}%` },
                      longComplete && styles.progressBarComplete
                    ]} 
                  />
                </View>
              </View>

              {/* Short Runs Progress */}
              <View style={styles.progressItem}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.checkIcon, shortComplete && styles.checkComplete]}>
                    {shortComplete ? '✓' : '○'}
                  </Text>
                  <Text style={styles.progressLabel}>Short Runs</Text>
                  <Text style={styles.progressCount}>
                    {short_runs_completed}/{short_runs_needed}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${shortProgress}%` },
                      shortComplete && styles.progressBarComplete
                    ]} 
                  />
                </View>
              </View>
            </View>

            {/* Status Message */}
            <View style={[styles.messageCard, is_complete && styles.messageCardComplete]}>
              <Text style={styles.messageText}>{message}</Text>
            </View>

            {/* Streak Rules */}
            <Text style={styles.sectionTitle}>How Streaks Work</Text>
            <View style={styles.rulesCard}>
              <Text style={styles.ruleText}>
                ✅ Complete <Text style={styles.ruleBold}>1 long run (10k+)</Text>
              </Text>
              <Text style={styles.ruleText}>
                ✅ Complete <Text style={styles.ruleBold}>2 short runs (any distance)</Text>
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
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
    padding: spacing.xs,
  },
  closeText: {
    fontSize: typography.sizes.xl,
    color: colors.textSecondary,
  },
  streakCard: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  streakCardComplete: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  streakEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    lineHeight: 72,
  },
  streakLabel: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  bestStreak: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  bestStreakCurrent: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  progressItem: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  checkIcon: {
    fontSize: 16,
    color: colors.textLight,
    width: 24,
    textAlign: 'center',
  },
  checkComplete: {
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  progressLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  progressCount: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginLeft: 28,
    overflow: 'hidden',
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
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  messageCardComplete: {
    backgroundColor: colors.success + '20',
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    textAlign: 'center',
  },
  rulesCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  ruleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  ruleBold: {
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
