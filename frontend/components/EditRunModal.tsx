/**
 * ✏️ EDIT RUN MODAL
 * ==================
 * 
 * A modal for editing past runs.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { RunTypeButton } from './RunTypeButton';
import type { Run } from '../services/api';

const RUN_TYPES = ['3k', '5k', '10k', '15k', '18k', '21k'];

interface EditRunModalProps {
  visible: boolean;
  run: Run | null;
  onClose: () => void;
  onSave: (id: number, data: { run_type?: string; duration_seconds?: number; notes?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function EditRunModal({ visible, run, onClose, onSave, onDelete }: EditRunModalProps) {
  const [runType, setRunType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Update state when run changes
  useEffect(() => {
    if (run) {
      setRunType(run.run_type);
      const mins = Math.floor(run.duration_seconds / 60);
      const secs = run.duration_seconds % 60;
      setMinutes(mins.toString());
      setSeconds(secs.toString());
      setNotes(run.notes || '');
    }
  }, [run]);

  const handleSave = async () => {
    if (!run) return;
    
    setSaving(true);
    try {
      const durationSeconds = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
      await onSave(run.id, {
        run_type: runType,
        duration_seconds: durationSeconds,
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!run) return;
    
    Alert.alert(
      'Delete Run?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(run.id);
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete run');
            }
          },
        },
      ]
    );
  };

  if (!run) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Run</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Run Type Selection */}
        <Text style={styles.label}>Distance</Text>
        <View style={styles.typeRow}>
          {RUN_TYPES.map(type => (
            <RunTypeButton
              key={type}
              type={type}
              size="small"
              selected={runType === type}
              onPress={() => setRunType(type)}
            />
          ))}
        </View>

        {/* Duration */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationRow}>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.input}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={3}
            />
            <Text style={styles.durationLabel}>min</Text>
          </View>
          <Text style={styles.colon}>:</Text>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.input}
              value={seconds}
              onChangeText={setSeconds}
              keyboardType="number-pad"
              placeholder="00"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>sec</Text>
          </View>
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How did the run feel?"
          multiline
          numberOfLines={3}
        />

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️ Delete Run</Text>
        </TouchableOpacity>
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
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationInput: {
    alignItems: 'center',
  },
  colon: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.xl,
    color: colors.text,
    textAlign: 'center',
    minWidth: 80,
    ...shadows.small,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
    fontSize: typography.sizes.md,
    textAlign: 'left',
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
