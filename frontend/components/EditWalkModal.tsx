/**
 * ✏️ EDIT WALK MODAL
 * ==================
 *
 * Lets the user update mood / notes / category on a saved walk.
 * Distance, duration and route are immutable (they're computed from GPS).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { walkApi, type Walk } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

const MOODS = [
  { id: 'peaceful', emoji: '🌿', label: 'Peaceful' },
  { id: 'energising', emoji: '⚡', label: 'Energising' },
  { id: 'scenic', emoji: '🌄', label: 'Scenic' },
  { id: 'tough', emoji: '😤', label: 'Tough' },
];

const CATEGORIES = [
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'treadmill', label: 'Treadmill' },
  { id: 'indoor', label: 'Indoor' },
];

interface Props {
  visible: boolean;
  walk: Walk | null;
  onClose: () => void;
  onSaved: (updated: Walk) => void;
  onDeleted?: (id: number) => void;
}

export function EditWalkModal({ visible, walk, onClose, onSaved, onDeleted }: Props) {
  const [mood, setMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>('outdoor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (walk) {
      setMood(walk.mood);
      setNotes(walk.notes ?? '');
      setCategory(walk.category ?? 'outdoor');
    }
  }, [walk]);

  if (!walk) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await walkApi.update(walk.id, {
        mood: mood ?? '',
        notes: notes.trim(),
        category,
      });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete walk?',
      'This walk and its photos will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await walkApi.delete(walk.id);
              onDeleted?.(walk.id);
              onClose();
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message ?? 'Try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit walk</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.headerSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>Mood</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMood(mood === m.id ? null : m.id)}
                style={[
                  styles.moodChip,
                  mood === m.id && styles.moodChipActive,
                ]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    mood === m.id && styles.moodLabelActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.categoryChip,
                  category === c.id && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === c.id && styles.categoryTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="A line about how it felt…"
            placeholderTextColor={colors.textLight}
            style={styles.notesInput}
            multiline
            maxLength={500}
          />

          <Pressable onPress={handleDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>Delete this walk</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCancel: { color: colors.textSecondary, fontSize: typography.sizes.md },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerSave: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moodRow: { flexDirection: 'row', gap: spacing.sm },
  moodChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.small,
  },
  moodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  moodEmoji: { fontSize: 22, marginBottom: 2 },
  moodLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  moodLabelActive: { color: colors.primary, fontWeight: typography.weights.bold },
  categoryRow: { flexDirection: 'row', gap: spacing.sm },
  categoryChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.small,
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  categoryTextActive: { color: colors.primary, fontWeight: typography.weights.bold },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    color: colors.text,
    fontSize: typography.sizes.sm,
    textAlignVertical: 'top',
    ...shadows.small,
  },
  deleteBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  deleteText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
