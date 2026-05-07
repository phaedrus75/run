/**
 * 🌅 JOURNEY DETAIL SCREEN
 * =========================
 *
 * Single Journey deep-dive: progress, plan, contributing activities,
 * notes, and lifecycle controls (complete / abandon).
 *
 * Active journey: the user can edit notes, mark complete, or abandon.
 * Completed/abandoned: read-only view.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Journey, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
  route: { params?: { journeyId?: number } };
}

export function JourneyDetailScreen({ navigation, route }: Props) {
  const journeyId = route?.params?.journeyId ?? null;
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesDirty = useRef(false);

  const fetch = useCallback(async () => {
    if (journeyId == null) return;
    try {
      const j = await journeyApi.get(journeyId);
      setJourney(j);
      if (!notesDirty.current) setNotesDraft(j.notes || '');
    } catch (e: any) {
      Alert.alert('Could not load journey', String(e?.message || ''));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [journeyId]);

  useEffect(() => {
    setLoading(true);
    void fetch();
    const unsub = navigation.addListener('focus', fetch);
    return unsub;
  }, [navigation, fetch]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetch();
  };

  const onSaveNotes = async () => {
    if (!journey) return;
    setSavingNotes(true);
    try {
      const next = await journeyApi.update(journey.id, { notes: notesDraft });
      setJourney(next);
      notesDirty.current = false;
    } catch (e: any) {
      Alert.alert('Could not save notes', String(e?.message || ''));
    } finally {
      setSavingNotes(false);
    }
  };

  const onComplete = () => {
    if (!journey) return;
    Alert.alert(
      'Mark journey complete?',
      'You can mark it done early — the line is wherever you decide it is.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            try {
              const next = await journeyApi.complete(journey.id);
              setJourney(next);
            } catch (e: any) {
              Alert.alert('Could not complete', String(e?.message || ''));
            }
          },
        },
      ],
    );
  };

  const onAbandon = () => {
    if (!journey) return;
    Alert.alert(
      'Abandon journey?',
      'This stops counting future runs and walks toward the journey. You can start a new one any time.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            try {
              const next = await journeyApi.abandon(journey.id);
              setJourney(next);
            } catch (e: any) {
              Alert.alert('Could not abandon', String(e?.message || ''));
            }
          },
        },
      ],
    );
  };

  const pct = useMemo(() => {
    if (!journey) return 0;
    return Math.max(0, Math.min(100, journey.progress_percent || 0));
  }, [journey]);

  if (loading || !journey) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = journey.status === 'active';
  const isCompleted = journey.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{journey.name}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statusRow}>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{journey.tier}</Text>
          </View>
          <Text
            style={[
              styles.statusText,
              isActive && styles.statusActive,
              isCompleted && styles.statusCompleted,
              !isActive && !isCompleted && styles.statusAbandoned,
            ]}
          >
            {isActive ? 'Active' : isCompleted ? 'Completed' : 'Abandoned'}
          </Text>
        </View>

        {journey.plan_summary ? (
          <Text style={styles.planSummary}>{journey.plan_summary}</Text>
        ) : null}

        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>
            {journey.accumulated_km.toFixed(1)}{' '}
            <Text style={styles.bigStatTarget}>/ {journey.target_distance_km.toFixed(0)} km</Text>
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              {journey.activity_count} activit{journey.activity_count === 1 ? 'y' : 'ies'}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            <Text style={styles.metaItem}>
              {journey.days_active} day{journey.days_active === 1 ? '' : 's'}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            <Text style={styles.metaItem}>{Math.round(pct)}%</Text>
          </View>
        </View>

        {isActive ? (
          <View style={styles.hintCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.hintText}>
              Every run and walk you record while this journey is active counts toward the line.
              You don't need to mark them as journey runs.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Your notes</Text>
        <TextInput
          editable={isActive}
          value={notesDraft}
          onChangeText={(t) => {
            if (t !== notesDraft) notesDirty.current = true;
            setNotesDraft(t);
          }}
          placeholder={isActive ? 'A line about today, or where you want this to go…' : 'No notes.'}
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={2000}
          style={[styles.notes, !isActive && { backgroundColor: colors.surfaceAlt }]}
        />
        {isActive ? (
          <Pressable
            onPress={() => void onSaveNotes()}
            disabled={savingNotes || !notesDirty.current}
            style={({ pressed }) => [
              styles.saveNotesBtn,
              (savingNotes || !notesDirty.current) && { opacity: 0.5 },
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {savingNotes ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.saveNotesText}>Save notes</Text>
            )}
          </Pressable>
        ) : null}

        {isActive ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onComplete}
              style={({ pressed }) => [
                styles.completeBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.completeBtnText}>Mark complete</Text>
            </Pressable>
            <Pressable
              onPress={onAbandon}
              style={({ pressed }) => [
                styles.abandonBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Text style={styles.abandonBtnText}>Abandon journey</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Started {new Date(journey.started_at).toLocaleDateString()}
            {journey.completed_at ? `  ·  finished ${new Date(journey.completed_at).toLocaleDateString()}` : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  statusActive: { color: colors.primary },
  statusCompleted: { color: colors.success },
  statusAbandoned: { color: colors.textLight },
  planSummary: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 23,
    marginTop: spacing.md,
  },
  bigStat: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.small,
  },
  bigStatValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  bigStatTarget: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  metaDot: { color: colors.textLight },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hintText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  notes: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    color: colors.text,
    fontSize: typography.sizes.md,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveNotesBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  saveNotesText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  abandonBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
});
