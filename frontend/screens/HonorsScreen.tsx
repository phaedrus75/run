/**
 * Personal records + achievements (also on Home; this screen is a focused view from the drawer).
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { PersonalRecords } from '../components/PersonalRecords';
import { Achievements } from '../components/Achievements';
import { AchievementDetailModal } from '../components/AchievementDetailModal';
import { Vo2MaxCard } from '../components/Vo2MaxCard';
import {
  statsApi,
  vo2maxApi,
  type PersonalRecords as PRType,
  type AchievementsData,
  type Achievement,
  type Vo2MaxSample,
} from '../services/api';
import { autoSyncVo2MaxFromHealth } from '../services/healthBridge';
import { colors, spacing, typography } from '../theme/colors';

// 🫁 Throttle the silent VO2 Max sync — Apple Watch writes new VO2
// samples only every 1–2 weeks, so syncing more than once a minute
// while the user navigates around the app would just wake up the
// HealthKit bridge for no reason.
const VO2_SYNC_THROTTLE_MS = 60_000;

export function HonorsScreen({ navigation }: { navigation: any }) {
  const [records, setRecords] = useState<PRType | null>(null);
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [vo2Samples, setVo2Samples] = useState<Vo2MaxSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeDetail, setBadgeDetail] = useState<Achievement | null>(null);
  const lastVo2SyncRef = useRef<number>(0);

  const loadVo2 = useCallback(async () => {
    try {
      const samples = await vo2maxApi.list(365);
      setVo2Samples(samples);
    } catch {
      setVo2Samples([]);
    }
  }, []);

  /** Silent HK → backend sync. No UI; we just refetch the local list
   *  if anything new came across so the trend chart shows the latest
   *  sample without a manual refresh. */
  const runSilentVo2Sync = useCallback(async () => {
    const now = Date.now();
    if (now - lastVo2SyncRef.current < VO2_SYNC_THROTTLE_MS) return;
    lastVo2SyncRef.current = now;
    try {
      const res = await autoSyncVo2MaxFromHealth();
      if (res.imported > 0) {
        await loadVo2();
      }
    } catch {
      // Best-effort only; the visible trend still works off whatever
      // is already in the backend.
    }
  }, [loadVo2]);

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([statsApi.getPersonalRecords(), statsApi.getAchievements()]);
      setRecords(r);
      setAchievements(a);
    } catch {
      setRecords(null);
      setAchievements(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    void loadVo2();
  }, [loadVo2]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
      void runSilentVo2Sync();
    }, [load, runSilentVo2Sync]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Honors</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {records && <PersonalRecords records={records} />}
            {/* 🫁 Cardio fitness trend — auto-synced from Apple Health.
                Self-hides when fewer than 2 samples are available
                (one dot is meaningless without a trend). */}
            {vo2Samples.length >= 2 && (
              <View style={styles.vo2Wrap}>
                <Vo2MaxCard samples={vo2Samples} />
              </View>
            )}
            {achievements && (
              <Achievements data={achievements} onBadgePress={a => setBadgeDetail(a)} />
            )}
            {!records && !achievements && (
              <Text style={styles.empty}>Nothing here yet — keep showing up.</Text>
            )}
          </>
        )}
      </ScrollView>
      <AchievementDetailModal
        visible={badgeDetail !== null}
        achievement={badgeDetail}
        onClose={() => setBadgeDetail(null)}
      />
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
  vo2Wrap: { marginTop: spacing.lg },
});
