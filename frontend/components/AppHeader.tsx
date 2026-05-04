/**
 * Persistent top bar: hamburger (drawer), brand wordmark, streak badge.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { statsApi, type WeeklyStreakProgress, type StreakPeriod } from '../services/api';
import { RhythmPlant } from './RhythmPlant';
import { StreakModal } from './StreakModal';
import { useDrawer } from '../contexts/DrawerContext';
import { colors, spacing, typography } from '../theme/colors';

export function AppHeader() {
  const { open } = useDrawer();
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [streakHistory, setStreakHistory] = useState<StreakPeriod[]>([]);
  const [showStreak, setShowStreak] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([
        statsApi.getStreakProgress().catch(() => null),
        statsApi.getStreakHistory().catch(() => []),
      ]);
      setStreakProgress(p);
      setStreakHistory(h || []);
    } catch {
      setStreakProgress(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <View style={styles.bar}>
        <Pressable onPress={open} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.brand}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>ZenRun</Text>
        </View>

        <View style={styles.right}>
          {streakProgress != null && (
            <Pressable
              style={styles.streakBadge}
              onPress={() => setShowStreak(true)}
              hitSlop={8}
            >
              <RhythmPlant weeks={streakProgress.current_streak} size="small" />
              <Text style={styles.streakCount}>{streakProgress.current_streak}w</Text>
            </Pressable>
          )}
        </View>
      </View>

      <StreakModal
        visible={showStreak}
        onClose={() => setShowStreak(false)}
        progress={streakProgress}
        streakHistory={streakHistory}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  iconBtn: { padding: 4, width: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 6 },
  brandText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  right: { minWidth: 40, alignItems: 'flex-end' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
