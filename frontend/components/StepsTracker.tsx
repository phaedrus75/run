/**
 * 👟 STEPS TRACKER
 * =================
 * 
 * Track high step days (15k+, 20k+, 25k+).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface StepsSummary {
  current_month: {
    month: string;
    days_15k: number;
    days_20k: number;
    days_25k: number;
    highest: number;
    total_entries: number;
  };
  all_time: {
    days_15k: number;
    days_20k: number;
    days_25k: number;
    total_entries: number;
  };
}

interface StepsTrackerProps {
  summary: StepsSummary | null;
  onUpdate: () => void;
}

export function StepsTracker({ summary, onUpdate }: StepsTrackerProps) {
  const [showModal, setShowModal] = useState(false);
  const [stepCount, setStepCount] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    const steps = parseInt(stepCount);
    if (!steps || steps <= 0) {
      Alert.alert('Error', 'Please enter a valid step count');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_count: steps,
          recorded_date: `${selectedDate}T12:00:00`,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setStepCount('');
        onUpdate();
        Alert.alert('Success', `Logged ${steps.toLocaleString()} steps! 👟`);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save steps. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Quick step buttons
  const quickSteps = [15000, 20000, 25000];

  const currentMonth = summary?.current_month || {
    month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    days_15k: 0,
    days_20k: 0,
    days_25k: 0,
    highest: 0,
    total_entries: 0,
  };

  const allTime = summary?.all_time || {
    days_15k: 0,
    days_20k: 0,
    days_25k: 0,
    total_entries: 0,
  };

  return (
    <View style={[styles.container, shadows.small]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>👟 High Step Days</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Current Month Stats */}
      <Text style={styles.monthLabel}>{currentMonth.month}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.badge, styles.badge15k]}>
            <Text style={styles.badgeText}>{currentMonth.days_15k}</Text>
          </View>
          <Text style={styles.statLabel}>15k+ days</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.badge, styles.badge20k]}>
            <Text style={styles.badgeText}>{currentMonth.days_20k}</Text>
          </View>
          <Text style={styles.statLabel}>20k+ days</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.badge, styles.badge25k]}>
            <Text style={styles.badgeText}>{currentMonth.days_25k}</Text>
          </View>
          <Text style={styles.statLabel}>25k+ days</Text>
        </View>
      </View>

      {/* All Time */}
      {allTime.total_entries > 0 && (
        <View style={styles.allTimeRow}>
          <Text style={styles.allTimeLabel}>All Time:</Text>
          <Text style={styles.allTimeValue}>
            {allTime.days_15k} × 15k+ • {allTime.days_20k} × 20k+ • {allTime.days_25k} × 25k+
          </Text>
        </View>
      )}

      {/* Add Steps Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log Steps</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.emoji}>👟</Text>
            
            {/* Date Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textLight}
              />
            </View>

            {/* Step Count Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Step Count</Text>
              <TextInput
                style={[styles.input, styles.bigInput]}
                value={stepCount}
                onChangeText={setStepCount}
                keyboardType="numeric"
                placeholder="e.g., 18500"
                placeholderTextColor={colors.textLight}
              />
            </View>

            {/* Quick Select */}
            <Text style={styles.quickLabel}>Quick Select:</Text>
            <View style={styles.quickRow}>
              {quickSteps.map((steps) => (
                <TouchableOpacity
                  key={steps}
                  style={[
                    styles.quickButton,
                    stepCount === steps.toString() && styles.quickButtonActive,
                  ]}
                  onPress={() => setStepCount(steps.toString())}
                >
                  <Text style={[
                    styles.quickButtonText,
                    stepCount === steps.toString() && styles.quickButtonTextActive,
                  ]}>
                    {(steps / 1000).toFixed(0)}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>Log Steps</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badge15k: {
    backgroundColor: colors.runTypes['15k'] + '30',
  },
  badge20k: {
    backgroundColor: colors.runTypes['20k'] + '30',
  },
  badge25k: {
    backgroundColor: colors.success + '30',
  },
  badgeText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  allTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  allTimeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  allTimeValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    textAlign: 'center',
  },
  bigInput: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  quickLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  quickButtonActive: {
    backgroundColor: colors.primary,
  },
  quickButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  quickButtonTextActive: {
    color: colors.surface,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
});
