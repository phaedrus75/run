import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { gymApi, exerciseApi, type GymWorkout, type GymExerciseLog, type ExerciseCatalogEntry } from '../services/api';

interface EditGymWorkoutModalProps {
  visible: boolean;
  workout: GymWorkout | null;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export function EditGymWorkoutModal({ visible, workout, onClose, onSave, onDelete }: EditGymWorkoutModalProps) {
  const [exercises, setExercises] = useState<GymExerciseLog[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<ExerciseCatalogEntry[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (workout) {
      setExercises(workout.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({ ...s })),
      })));
      setNotes(workout.notes || '');
      setShowAddExercise(false);
      setCustomName('');
    }
  }, [workout]);

  useEffect(() => {
    if (visible) {
      exerciseApi.getAll().then(setCatalog).catch(() => {});
    }
  }, [visible]);

  if (!workout) return null;

  const updateWeight = (exIdx: number, delta: number) => {
    setExercises(prev => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], weight_kg: Math.max(0, next[exIdx].weight_kg + delta) };
      return next;
    });
  };

  const updateReps = (exIdx: number, setIdx: number, reps: number) => {
    setExercises(prev => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], reps };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  };

  const toggleSet = (exIdx: number, setIdx: number) => {
    setExercises(prev => {
      const next = [...prev];
      const sets = [...next[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], completed: !sets[setIdx].completed };
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  };

  const removeExercise = (exIdx: number) => {
    const name = exercises[exIdx].name;
    Alert.alert('Remove Exercise', `Remove ${name} from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setExercises(prev => prev.filter((_, i) => i !== exIdx));
        },
      },
    ]);
  };

  const addExercise = (catEx: ExerciseCatalogEntry) => {
    const newExercise: GymExerciseLog = {
      name: catEx.name,
      weight_kg: catEx.weight_kg,
      sets: Array.from({ length: catEx.default_sets }, () => ({
        reps: catEx.default_reps,
        completed: false,
      })),
    };
    setExercises(prev => [...prev, newExercise]);
    setShowAddExercise(false);
  };

  const addCustomExercise = async () => {
    const name = customName.trim();
    if (!name) return;
    if (exercises.find(e => e.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate', `${name} is already in this workout.`);
      return;
    }
    try {
      await exerciseApi.create({ name });
    } catch {}
    const newExercise: GymExerciseLog = {
      name,
      weight_kg: 0,
      sets: [{ reps: 10, completed: false }, { reps: 10, completed: false }, { reps: 10, completed: false }],
    };
    setExercises(prev => [...prev, newExercise]);
    setCustomName('');
    setShowAddExercise(false);
  };

  const addSet = (exIdx: number) => {
    setExercises(prev => {
      const next = [...prev];
      const lastSet = next[exIdx].sets[next[exIdx].sets.length - 1];
      const newSet = lastSet
        ? { reps: lastSet.reps, completed: false }
        : { reps: 10, completed: false };
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets, newSet] };
      return next;
    });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(prev => {
      const next = [...prev];
      if (next[exIdx].sets.length <= 1) return prev;
      const sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
      next[exIdx] = { ...next[exIdx], sets };
      return next;
    });
  };

  const availableExercises = catalog.filter(
    p => !exercises.find(e => e.name === p.name)
  );

  const handleSave = async () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise or delete the workout.');
      return;
    }
    setSaving(true);
    try {
      await gymApi.update(workout.id, {
        exercises,
        notes: notes || undefined,
      });
      onSave();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Workout', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await gymApi.delete(workout.id);
            onDelete();
            onClose();
          } catch {
            Alert.alert('Error', 'Failed to delete workout');
          }
        },
      },
    ]);
  };

  const completedDate = workout.completed_at
    ? new Date(workout.completed_at).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'Unknown date';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Workout</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.dateLabel}>{completedDate}</Text>

          {exercises.map((ex, exIdx) => (
            <View key={`${ex.name}-${exIdx}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <TouchableOpacity
                  onPress={() => removeExercise(exIdx)}
                  style={styles.removeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.weightRow}>
                <TouchableOpacity style={styles.weightBtn} onPress={() => updateWeight(exIdx, -2.5)}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.weightValue}>{ex.weight_kg} kg</Text>
                <TouchableOpacity style={styles.weightBtn} onPress={() => updateWeight(exIdx, 2.5)}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {ex.sets.map((set, setIdx) => (
                <EditSetRow
                  key={setIdx}
                  idx={setIdx}
                  reps={set.reps}
                  completed={set.completed}
                  canRemove={ex.sets.length > 1}
                  onToggle={() => toggleSet(exIdx, setIdx)}
                  onUpdateReps={(r) => updateReps(exIdx, setIdx, r)}
                  onRemove={() => removeSet(exIdx, setIdx)}
                />
              ))}

              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          {showAddExercise && (
            <View style={styles.addExercisePanel}>
              <View style={styles.customExerciseRow}>
                <TextInput
                  style={styles.customExerciseInput}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Custom exercise name..."
                  placeholderTextColor={colors.textLight}
                  returnKeyType="done"
                  onSubmitEditing={addCustomExercise}
                />
                <TouchableOpacity
                  style={[styles.customExerciseAdd, !customName.trim() && { opacity: 0.4 }]}
                  onPress={addCustomExercise}
                  disabled={!customName.trim()}
                >
                  <Text style={styles.customExerciseAddText}>Add</Text>
                </TouchableOpacity>
              </View>

              {availableExercises.length > 0 && (
                <View style={styles.addExerciseList}>
                  <Text style={styles.addExerciseSectionLabel}>Your Exercises</Text>
                  {availableExercises.map(ex => (
                    <TouchableOpacity
                      key={ex.name}
                      style={styles.addExerciseItem}
                      onPress={() => addExercise(ex)}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.success} />
                      <Text style={styles.addExerciseText}>{ex.name}</Text>
                      {ex.equipment ? <Text style={styles.addExerciseMachine}>{ex.equipment}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={() => { setShowAddExercise(!showAddExercise); setCustomName(''); }}
          >
            <Ionicons name={showAddExercise ? 'close' : 'add'} size={18} color={colors.primary} />
            <Text style={styles.addExerciseBtnText}>
              {showAddExercise ? 'Cancel' : 'Add Exercise'}
            </Text>
          </TouchableOpacity>

          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes..."
              placeholderTextColor={colors.textLight}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>Delete Workout</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function EditSetRow({
  idx, reps, completed, canRemove, onToggle, onUpdateReps, onRemove,
}: {
  idx: number;
  reps: number;
  completed: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onUpdateReps: (r: number) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(String(reps));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(reps));
  }, [reps, editing]);

  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>Set {idx + 1}</Text>
      <TextInput
        style={styles.repsInput}
        keyboardType="number-pad"
        value={text}
        onFocus={() => { setEditing(true); setText(''); }}
        onChangeText={setText}
        onBlur={() => {
          setEditing(false);
          const n = parseInt(text, 10);
          if (!isNaN(n) && n >= 0) onUpdateReps(n);
          else setText(String(reps));
        }}
      />
      <Text style={styles.repsUnit}>reps</Text>
      <TouchableOpacity
        style={[styles.checkCircle, completed && styles.checkCircleComplete]}
        onPress={onToggle}
      >
        {completed && <Ionicons name="checkmark" size={14} color="#fff" />}
      </TouchableOpacity>
      {canRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeSetBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, paddingTop: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.surface,
  },
  cancelText: { fontSize: typography.sizes.md, color: colors.textSecondary },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
  saveText: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.primary },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  dateLabel: {
    fontSize: typography.sizes.sm, color: colors.textSecondary,
    marginBottom: spacing.md, textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
  },
  exerciseName: {
    fontSize: typography.sizes.md, fontWeight: typography.weights.semibold,
    color: colors.text, flex: 1,
  },
  removeBtn: {
    marginLeft: spacing.sm,
  },
  weightRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, marginBottom: spacing.sm,
  },
  weightBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },
  weightValue: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.bold,
    color: colors.primary, minWidth: 70, textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs,
  },
  setLabel: {
    fontSize: typography.sizes.sm, color: colors.textSecondary, width: 45,
  },
  repsInput: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 2, paddingHorizontal: 4, width: 40, textAlign: 'center',
  },
  repsUnit: {
    fontSize: typography.sizes.sm, color: colors.textLight, marginLeft: 4, flex: 1,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginLeft: spacing.sm,
  },
  checkCircleComplete: {
    backgroundColor: colors.success, borderColor: colors.success,
  },
  removeSetBtn: {
    marginLeft: spacing.sm,
  },
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceAlt,
    marginTop: spacing.xs,
  },
  addSetText: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  addExerciseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  addExerciseBtnText: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  addExercisePanel: {
    marginBottom: spacing.sm,
  },
  customExerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  customExerciseInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  customExerciseAdd: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  customExerciseAddText: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  addExerciseSectionLabel: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    paddingBottom: spacing.xs, textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  addExerciseList: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    ...shadows.small,
  },
  addExerciseItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceAlt,
  },
  addExerciseText: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium,
    color: colors.text, flex: 1,
  },
  addExerciseMachine: {
    fontSize: typography.sizes.xs, color: colors.textLight,
  },
  notesSection: { marginTop: spacing.md },
  notesLabel: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
    color: colors.text, marginBottom: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, fontSize: typography.sizes.sm, color: colors.text,
    minHeight: 60, textAlignVertical: 'top',
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.md,
  },
  deleteText: {
    fontSize: typography.sizes.md, color: colors.error, fontWeight: typography.weights.medium,
  },
});
