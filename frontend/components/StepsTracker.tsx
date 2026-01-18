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
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [selectedSteps, setSelectedSteps] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (!selectedSteps) {
      Alert.alert('Error', 'Please select a step count');
      return;
    }

    setIsLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(`${API_BASE_URL}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_count: selectedSteps,
          recorded_date: `${dateStr}T12:00:00`,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setSelectedSteps(null);
        setSelectedDate(new Date());
        onUpdate();
        Alert.alert('Success', `Logged ${(selectedSteps / 1000).toFixed(0)}k steps! 👟`);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save steps. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function onDateChange(event: any, date?: Date) {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Quick step options
  const stepOptions = [
    { value: 15000, label: '15k', color: colors.runTypes['15k'] },
    { value: 20000, label: '20k', color: colors.runTypes['20k'] },
    { value: 25000, label: '25k', color: colors.success },
  ];

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
        <View style={styles.allTimeSection}>
          <View style={styles.totalBadge}>
            <Text style={styles.totalNumber}>{allTime.total_entries}</Text>
            <Text style={styles.totalLabel}>total high step days</Text>
          </View>
          <View style={styles.allTimeRow}>
            <Text style={styles.allTimeValue}>
              {allTime.days_15k} × 15k+ • {allTime.days_20k} × 20k+ • {allTime.days_25k} × 25k+
            </Text>
          </View>
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
            <Text style={styles.modalTitle}>Log High Step Day</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.emoji}>👟</Text>
            
            {/* Date Picker */}
            <Text style={styles.sectionLabel}>Select Date</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <Text style={styles.dateButtonText}>{formatDate(selectedDate)}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}

            {/* Step Count Selection */}
            <Text style={styles.sectionLabel}>Step Count</Text>
            <View style={styles.optionsRow}>
              {stepOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    selectedSteps === option.value && { 
                      backgroundColor: option.color,
                      borderColor: option.color,
                    },
                  ]}
                  onPress={() => setSelectedSteps(option.value)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedSteps === option.value && styles.optionLabelActive,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.optionSubtext,
                    selectedSteps === option.value && styles.optionSubtextActive,
                  ]}>
                    steps
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton, 
                (!selectedSteps || isLoading) && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!selectedSteps || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {selectedSteps ? `Log ${(selectedSteps / 1000).toFixed(0)}k Steps` : 'Select Steps'}
                </Text>
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
  allTimeSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  totalNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.sizes.sm,
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
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  dateButtonText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
    justifyContent: 'center',
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  optionLabel: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  optionLabelActive: {
    color: colors.surface,
  },
  optionSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  optionSubtextActive: {
    color: colors.surface,
    opacity: 0.8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
});
