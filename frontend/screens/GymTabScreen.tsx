/**
 * 🏋️ GYM TAB SCREEN
 * ==================
 *
 * Gym workout history + stats.
 * Accessed from Labs tab.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { GymStatsSection } from '../components/GymStatsSection';
import { GymTracker } from '../components/GymTracker';
import { EditGymWorkoutModal } from '../components/EditGymWorkoutModal';
import { gymApi, type GymStats, type GymWorkout } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type InnerTab = 'history' | 'stats';

interface Props {
  navigation: any;
}

export function GymTabScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<InnerTab>('history');
  const [workouts, setWorkouts] = useState<GymWorkout[]>([]);
  const [stats, setStats] = useState<GymStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [editWorkout, setEditWorkout] = useState<GymWorkout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ws, st] = await Promise.all([
        gymApi.getAll(100),
        gymApi.getStats().catch(() => null),
      ]);
      setWorkouts(ws);
      setStats(st);
    } catch (e) {
      console.error('GymTab fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const renderWorkout = ({ item }: { item: GymWorkout }) => {
    const date = new Date(item.completed_at || item.created_at || Date.now());
    const dateLabel = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return (
      <Pressable
        onPress={() => setEditWorkout(item)}
        style={({ pressed }) => [styles.workoutRow, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <View style={styles.workoutIcon}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.workoutTitle}>{item.workout_type || 'Gym session'}</Text>
          <Text style={styles.workoutMeta}>{dateLabel}{item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gym</Text>
        <TouchableOpacity onPress={() => setShowTracker(true)} hitSlop={8}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.innerTabRow}>
        {(['history', 'stats'] as InnerTab[]).map(t => (
          <Pressable
            key={t}
            style={[styles.innerTab, tab === t && styles.innerTabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.innerTabText, tab === t && styles.innerTabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'history' ? (
        <FlatList
          data={workouts}
          keyExtractor={item => String(item.id)}
          renderItem={renderWorkout}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🏋️</Text>
                <Text style={styles.emptyTitle}>No workouts yet</Text>
                <Text style={styles.emptyText}>Tap + to log your first gym session.</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={<GymStatsSection stats={stats} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {showTracker && (
        <GymTracker
          onClose={() => { setShowTracker(false); fetchData(); }}
        />
      )}

      {editWorkout && (
        <EditGymWorkoutModal
          workout={editWorkout}
          onClose={() => setEditWorkout(null)}
          onUpdate={() => { setEditWorkout(null); fetchData(); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  innerTabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  innerTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  innerTabActive: { backgroundColor: colors.text },
  innerTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  innerTabTextActive: { color: colors.textOnPrimary, fontWeight: typography.weights.semibold },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  workoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  workoutMeta: { fontSize: typography.sizes.xs, color: colors.textLight, marginTop: 2 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
});
