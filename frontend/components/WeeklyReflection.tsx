import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { reflectionsApi } from '../services/api';

const MOOD_EMOJIS = ['😌', '😊', '💪', '🌿', '🌧️'];

interface WeeklyReflectionProps {
  weekComplete: boolean;
  existingReflection: { has_reflection: boolean; reflection?: string; mood?: string } | null;
  onSaved: () => void;
}

export function WeeklyReflection({ weekComplete, existingReflection, onSaved }: WeeklyReflectionProps) {
  const [selectedMood, setSelectedMood] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  if (!weekComplete) return null;

  if (existingReflection?.has_reflection) {
    return (
      <View style={[styles.card, styles.reflectedCard, shadows.small]}>
        <View style={styles.reflectedHeader}>
          <Text style={styles.reflectedMood}>{existingReflection.mood}</Text>
          <Text style={styles.reflectedLabel}>This week's reflection</Text>
        </View>
        {existingReflection.reflection ? (
          <Text style={styles.reflectedText}>{existingReflection.reflection}</Text>
        ) : null}
      </View>
    );
  }

  const handleSave = async () => {
    if (!selectedMood) return;
    setSaving(true);
    try {
      await reflectionsApi.save(text.trim(), selectedMood);
      onSaved();
    } catch (e) {
      console.error('Failed to save reflection:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, shadows.small]}>
      <Text style={styles.prompt}>How did this week feel?</Text>

      <View style={styles.moodRow}>
        {MOOD_EMOJIS.map(emoji => (
          <TouchableOpacity
            key={emoji}
            style={[styles.moodButton, selectedMood === emoji && styles.moodButtonActive]}
            onPress={() => setSelectedMood(emoji)}
          >
            <Text style={styles.moodEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.textInput}
        placeholder="A thought about your week (optional)"
        placeholderTextColor={colors.textLight}
        value={text}
        onChangeText={setText}
        maxLength={200}
        multiline
      />

      <TouchableOpacity
        style={[styles.saveButton, !selectedMood && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!selectedMood || saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Reflect'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reflectedCard: {
    backgroundColor: colors.success + '08',
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  prompt: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  moodButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodButtonActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 22,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
    minHeight: 40,
    maxHeight: 80,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textOnPrimary,
  },
  reflectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reflectedMood: {
    fontSize: 20,
  },
  reflectedLabel: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  reflectedText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
