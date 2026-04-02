import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/colors';
import type { StepEntry } from '../services/api';

const STEP_OPTIONS = [
  { value: 15000, label: '15k', color: colors.runTypes['15k'] },
  { value: 20000, label: '20k', color: colors.runTypes['20k'] },
  { value: 25000, label: '25k', color: colors.success },
  { value: 30000, label: '30k', color: '#3D3D3D' },
];

interface EditStepModalProps {
  visible: boolean;
  entry: StepEntry | null;
  onClose: () => void;
  onSave: (id: number, data: { step_count: number; recorded_date: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function EditStepModal({ visible, entry, onClose, onSave, onDelete }: EditStepModalProps) {
  const [selectedSteps, setSelectedSteps] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setSelectedSteps(entry.step_count);
      setSelectedDate(new Date(entry.recorded_date));
    }
  }, [entry]);

  function onDateChange(_event: any, date?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  }

  async function handleSave() {
    if (!entry || !selectedSteps) return;
    setSaving(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await onSave(entry.id, {
        step_count: selectedSteps,
        recorded_date: `${dateStr}T12:00:00`,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!entry) return;
    Alert.alert('Delete Step Entry?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete(entry.id);
            onClose();
          } catch {
            Alert.alert('Error', 'Failed to delete entry');
          }
        },
      },
    ]);
  }

  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Step Day</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || !selectedSteps}>
            <Text style={[styles.saveButton, (saving || !selectedSteps) && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.emoji}>👟</Text>

          <Text style={styles.sectionLabel}>Date</Text>
          {Platform.OS === 'ios' ? (
            <View style={styles.datePickerRow}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="compact"
                onChange={onDateChange}
                maximumDate={new Date()}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <Text style={styles.dateButtonText}>
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                />
              )}
            </>
          )}

          <Text style={styles.sectionLabel}>Step Count</Text>
          <View style={styles.optionsRow}>
            {STEP_OPTIONS.map((option) => (
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

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Step Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cancelButton: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  saveButton: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
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
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
    gap: spacing.sm,
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
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
    justifyContent: 'center',
  },
  optionButton: {
    width: '45%',
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
  deleteButton: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.medium,
  },
});
