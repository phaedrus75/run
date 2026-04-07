import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { gymApi, exerciseApi, GymProgramExercise, GymExerciseLog, GymStats, ExerciseCatalogEntry } from '../services/api';

const MACHINE_URLS: Record<string, string> = {
  'Technogym Selection Leg Press': 'https://www.technogym.com/en-GB/product/selection-900-leg-press_MNFP.html',
  'Technogym Selection Chest Press': 'https://www.technogym.com/en-GB/product/selection-700-chest-press_MNHP.html',
  'Technogym Selection Lat Machine': 'https://www.technogym.com/en-GB/product/selection-700-lat-machine_MNHL.html',
  'Technogym Selection Shoulder Press': 'https://www.technogym.com/en-GB/product/selection-900-shoulder-press_MNEP.html',
  'Technogym Selection Low Row': 'https://www.technogym.com/en-GB/product/selection-700-low-row_MNHC.html',
  'Technogym Selection Prone Leg Curl': 'https://www.technogym.com/en-GB/product/selection-900-leg-curl_MNIP.html',
};

interface GymTrackerProps {
  onUpdate?: () => void;
}

interface WorkoutState {
  [exerciseName: string]: {
    weight_kg: number;
    sets: { reps: number; completed: boolean }[];
  };
}

export function GymTracker({ onUpdate }: GymTrackerProps) {
  const [catalog, setCatalog] = useState<ExerciseCatalogEntry[]>([]);
  const [program, setProgram] = useState<GymProgramExercise[]>([]);
  const [activeExercises, setActiveExercises] = useState<GymProgramExercise[]>([]);
  const [stats, setStats] = useState<GymStats | null>(null);
  const [workout, setWorkout] = useState<WorkoutState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [customName, setCustomName] = useState('');

  const catalogToProgram = (entries: ExerciseCatalogEntry[]): GymProgramExercise[] =>
    entries.map(e => ({
      name: e.name,
      sets: e.default_sets,
      reps: e.default_reps,
      weight_kg: e.weight_kg,
      machine: e.equipment || '',
      increment_kg: e.increment_kg,
      is_timed: e.is_timed,
    }));

  const loadData = useCallback(async () => {
    try {
      let programExercises: GymProgramExercise[];
      let statsData: GymStats;

      try {
        const [catalogData, stats] = await Promise.all([
          exerciseApi.getAll(),
          gymApi.getStats(),
        ]);
        setCatalog(catalogData);
        programExercises = catalogToProgram(catalogData);
        statsData = stats;
      } catch {
        const [programData, stats] = await Promise.all([
          gymApi.getProgram(),
          gymApi.getStats(),
        ]);
        programExercises = programData.exercises;
        statsData = stats;
      }

      setProgram(programExercises);
      setActiveExercises(programExercises);
      setStats(statsData);

      const initial: WorkoutState = {};
      for (const ex of programExercises) {
        initial[ex.name] = {
          weight_kg: ex.weight_kg,
          sets: Array.from({ length: ex.sets }, () => ({
            reps: ex.reps,
            completed: false,
          })),
        };
      }
      setWorkout(initial);
    } catch (e) {
      console.error('Failed to load gym data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const adjustWeight = (name: string, delta: number) => {
    setWorkout(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        weight_kg: Math.max(0, (prev[name]?.weight_kg || 0) + delta),
      },
    }));
  };

  const toggleSet = (name: string, setIdx: number) => {
    setWorkout(prev => {
      const ex = prev[name];
      if (!ex) return prev;
      const newSets = [...ex.sets];
      newSets[setIdx] = { ...newSets[setIdx], completed: !newSets[setIdx].completed };
      return { ...prev, [name]: { ...ex, sets: newSets } };
    });
  };

  const updateReps = (name: string, setIdx: number, reps: number) => {
    setWorkout(prev => {
      const ex = prev[name];
      if (!ex) return prev;
      const newSets = [...ex.sets];
      newSets[setIdx] = { ...newSets[setIdx], reps };
      return { ...prev, [name]: { ...ex, sets: newSets } };
    });
  };

  const removeExercise = (name: string) => {
    setActiveExercises(prev => prev.filter(ex => ex.name !== name));
    setWorkout(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const addExercise = (ex: GymProgramExercise) => {
    if (activeExercises.find(a => a.name === ex.name)) return;
    setActiveExercises(prev => [...prev, ex]);
    setWorkout(prev => ({
      ...prev,
      [ex.name]: {
        weight_kg: ex.weight_kg,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: ex.reps,
          completed: false,
        })),
      },
    }));
    setShowAddExercise(false);
  };

  const addCustomExercise = async () => {
    const name = customName.trim();
    if (!name) return;
    if (activeExercises.find(a => a.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate', `${name} is already in this workout.`);
      return;
    }
    try {
      await exerciseApi.create({ name });
    } catch {}
    const customProgramEx: GymProgramExercise = {
      name,
      sets: 3,
      reps: 10,
      weight_kg: 0,
      machine: '',
      increment_kg: 2.5,
      is_timed: false,
    };
    setActiveExercises(prev => [...prev, customProgramEx]);
    setWorkout(prev => ({
      ...prev,
      [name]: {
        weight_kg: 0,
        sets: [{ reps: 10, completed: false }, { reps: 10, completed: false }, { reps: 10, completed: false }],
      },
    }));
    setCustomName('');
    setShowAddExercise(false);
  };

  const removedExercises = program.filter(
    ex => !activeExercises.find(a => a.name === ex.name)
  );

  const hasAnyCompleted = Object.values(workout).some(ex =>
    ex.sets.some(s => s.completed)
  );

  const handleComplete = async () => {
    if (!hasAnyCompleted) return;

    Alert.alert('Complete Workout', 'Log this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log It',
        onPress: async () => {
          setSaving(true);
          try {
            const exercises: GymExerciseLog[] = activeExercises.map(ex => ({
              name: ex.name,
              weight_kg: workout[ex.name]?.weight_kg ?? ex.weight_kg,
              sets: workout[ex.name]?.sets ?? [],
            }));

            await gymApi.create({ exercises });
            Alert.alert('Workout Logged', 'Great session!');
            await loadData();
            onUpdate?.();
          } catch (e) {
            Alert.alert('Error', 'Failed to save workout');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Strength Training</Text>
        <TouchableOpacity onPress={() => setShowProgress(!showProgress)}>
          <Ionicons
            name={showProgress ? 'barbell' : 'stats-chart'}
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {showProgress ? (
        <ProgressView stats={stats} />
      ) : (
        <>
          {activeExercises.map(ex => (
            <ExerciseCard
              key={ex.name}
              exercise={ex}
              state={workout[ex.name]}
              onAdjustWeight={(d) => adjustWeight(ex.name, d)}
              onToggleSet={(i) => toggleSet(ex.name, i)}
              onUpdateReps={(i, r) => updateReps(ex.name, i, r)}
              onRemove={() => removeExercise(ex.name)}
            />
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

              {removedExercises.length > 0 && (
                <View style={styles.addExerciseList}>
                  <Text style={styles.addExerciseSectionLabel}>Your Exercises</Text>
                  {removedExercises.map(ex => (
                    <TouchableOpacity
                      key={ex.name}
                      style={styles.addExerciseItem}
                      onPress={() => addExercise(ex)}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.success} />
                      <Text style={styles.addExerciseText}>{ex.name}</Text>
                      {ex.machine ? <Text style={styles.addExerciseMachine}>{ex.machine}</Text> : null}
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

          <TouchableOpacity
            style={[styles.completeBtn, !hasAnyCompleted && styles.completeBtnDisabled]}
            onPress={handleComplete}
            disabled={!hasAnyCompleted || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeBtnText}>Complete Workout</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ExerciseCard({
  exercise,
  state,
  onAdjustWeight,
  onToggleSet,
  onUpdateReps,
  onRemove,
}: {
  exercise: GymProgramExercise;
  state: { weight_kg: number; sets: { reps: number; completed: boolean }[] } | undefined;
  onAdjustWeight: (delta: number) => void;
  onToggleSet: (idx: number) => void;
  onUpdateReps: (idx: number, reps: number) => void;
  onRemove: () => void;
}) {
  const isTimed = exercise.is_timed;
  const weight = state?.weight_kg ?? exercise.weight_kg;
  const sets = state?.sets ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {!isTimed && (
          <Text style={styles.weightLabel}>{weight} kg</Text>
        )}
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={20} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      {!isTimed && (
        <View style={styles.weightRow}>
          <TouchableOpacity
            style={styles.weightBtn}
            onPress={() => onAdjustWeight(-exercise.increment_kg)}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.weightBar}>
            <View
              style={[
                styles.weightFill,
                { width: `${Math.min(100, (weight / (exercise.weight_kg * 2 || 1)) * 100)}%` },
              ]}
            />
          </View>
          <TouchableOpacity
            style={styles.weightBtn}
            onPress={() => onAdjustWeight(exercise.increment_kg)}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {exercise.machine ? (
        <TouchableOpacity
          style={styles.machineRow}
          onPress={() => {
            const url = MACHINE_URLS[exercise.machine];
            if (url) Linking.openURL(url);
          }}
          disabled={!MACHINE_URLS[exercise.machine]}
        >
          <Text style={styles.machineLabel}>{exercise.machine}</Text>
          {MACHINE_URLS[exercise.machine] && (
            <Ionicons name="open-outline" size={12} color={colors.textLight} />
          )}
        </TouchableOpacity>
      ) : null}

      {sets.map((set, idx) => (
        <SetRow
          key={idx}
          idx={idx}
          reps={set.reps}
          completed={set.completed}
          isTimed={isTimed}
          onToggle={() => onToggleSet(idx)}
          onUpdateReps={(r) => onUpdateReps(idx, r)}
        />
      ))}
    </View>
  );
}

function SetRow({
  idx,
  reps,
  completed,
  isTimed,
  onToggle,
  onUpdateReps,
}: {
  idx: number;
  reps: number;
  completed: boolean;
  isTimed: boolean;
  onToggle: () => void;
  onUpdateReps: (r: number) => void;
}) {
  const [text, setText] = useState(String(reps));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(reps));
  }, [reps, editing]);

  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>Set {idx + 1}:</Text>
      {isTimed ? (
        <Text style={styles.repsText}>{reps}s</Text>
      ) : (
        <TextInput
          style={styles.repsInput}
          keyboardType="number-pad"
          value={text}
          onFocus={() => { setEditing(true); setText(''); }}
          onChangeText={setText}
          onBlur={() => {
            setEditing(false);
            const n = parseInt(text, 10);
            if (!isNaN(n) && n >= 0) {
              onUpdateReps(n);
            } else {
              setText(String(reps));
            }
          }}
        />
      )}
      <TouchableOpacity
        style={[styles.checkCircle, completed && styles.checkCircleComplete]}
        onPress={onToggle}
      >
        {completed && (
          <Ionicons name="checkmark" size={16} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

function ProgressView({ stats }: { stats: GymStats | null }) {
  if (!stats) {
    return <Text style={styles.emptyText}>No workouts logged yet</Text>;
  }

  const progressionEntries = Object.entries(stats.progression);
  const volumeEntries = Object.entries(stats.volume || {});

  return (
    <View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total_workouts}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.this_week}/3</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.streak_weeks}</Text>
          <Text style={styles.statLabel}>Week Streak</Text>
        </View>
      </View>

      {progressionEntries.length > 0 && (
        <View style={styles.progressionSection}>
          <Text style={styles.progressionTitle}>Weight Progression</Text>
          {progressionEntries.map(([name, data]) => {
            const diff = data.current - data.first;
            return (
              <View key={name} style={styles.progressionRow}>
                <Text style={styles.progressionName}>{name}</Text>
                <Text style={[styles.progressionWeight, diff < 0 && { color: colors.error }]}>
                  {data.first}kg {'\u2192'} {data.current}kg
                  {diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {volumeEntries.length > 0 && (
        <View style={[styles.progressionSection, { marginTop: spacing.sm }]}>
          <Text style={styles.progressionTitle}>Volume Trend</Text>
          {volumeEntries.map(([name, entries]) => {
            if (entries.length < 2) return null;
            const firstVol = entries[0].volume;
            const lastVol = entries[entries.length - 1].volume;
            const pct = firstVol > 0 ? Math.round(((lastVol - firstVol) / firstVol) * 100) : 0;
            return (
              <View key={name} style={styles.progressionRow}>
                <Text style={styles.progressionName}>{name}</Text>
                <Text style={[styles.progressionWeight, pct < 0 && { color: colors.error }]}>
                  {firstVol.toLocaleString()} {'\u2192'} {lastVol.toLocaleString()} kg
                  {pct !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  exerciseName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flex: 1,
  },
  weightLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  weightBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  weightFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  machineLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  setLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    width: 50,
  },
  repsText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    flex: 1,
  },
  repsInput: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 2,
    paddingHorizontal: 4,
    width: 40,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  checkCircleComplete: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  removeBtn: {
    marginLeft: spacing.sm,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  addExerciseBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  addExercisePanel: {
    marginBottom: spacing.sm,
  },
  customExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  customExerciseInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customExerciseAdd: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  customExerciseAddText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  addExerciseSectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  addExerciseList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  addExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceAlt,
  },
  addExerciseText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    flex: 1,
  },
  addExerciseMachine: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  completeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  completeBtnDisabled: {
    opacity: 0.4,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flex: 1,
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
  progressionSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.small,
  },
  progressionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  progressionName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  progressionWeight: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.success,
  },
});
