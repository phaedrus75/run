/**
 * 🌅 JOURNEY DETAIL SCREEN
 * =========================
 *
 * Single Journey deep-dive: progress, plan, contributing activities,
 * notes, and lifecycle controls.
 *
 * Status-driven UI:
 * - planned    : countdown to scheduled date, prep checklist, readiness
 *                note, and "Start it now" / "Reschedule" / "Cancel" CTAs.
 * - active     : the user can edit notes, mark complete, or abandon.
 * - completed  : Guide debrief, read-only.
 * - abandoned  : read-only with a "Delete journey" option.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import DateTimePicker from '@react-native-community/datetimepicker';

import { Journey, JourneyMapContext, journeyApi } from '../services/api';
import { CoachChatSheet } from '../components/CoachChatSheet';
import { JourneyPreviewMap } from '../components/JourneyPreviewMap';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

function isoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntil(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

function formatScheduledDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

interface Props {
  navigation: any;
  route: { params?: { journeyId?: number } };
}

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `tonight at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow night';
  return d.toLocaleDateString();
}

export function JourneyDetailScreen({ navigation, route }: Props) {
  const journeyId = route?.params?.journeyId ?? null;
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showRescheduler, setShowRescheduler] = useState(false);
  const [mapContext, setMapContext] = useState<JourneyMapContext | null>(null);
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

  // 🗺 Lazy-load the map context once we know we're rendering a planned
  // journey. Active/completed/abandoned journeys don't show the preview
  // map (they have their own attribution UI), so we don't fetch for those.
  useEffect(() => {
    if (!journey || journey.status !== 'planned') return;
    if (mapContext !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const ctx = await journeyApi.mapContext(journey.tier);
        if (!cancelled) setMapContext(ctx);
      } catch {
        // Non-fatal — the JourneyPreviewMap component renders gracefully
        // when the context is null/empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [journey, mapContext]);

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

  const onDelete = () => {
    if (!journey) return;
    const isPlanned = journey.status === 'planned';
    Alert.alert(
      isPlanned ? 'Cancel this journey?' : 'Delete journey?',
      isPlanned
        ? 'This removes the journey from your to-do list. You can plan a new one any time.'
        : 'The journey is removed for good. Your runs and walks stay — they just stop being linked to it.',
      [
        { text: isPlanned ? 'Keep it' : 'Cancel', style: 'cancel' },
        {
          text: isPlanned ? 'Cancel journey' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await journeyApi.delete(journey.id);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Could not delete', String(e?.message || ''));
            }
          },
        },
      ],
    );
  };

  const onStartNow = () => {
    if (!journey) return;
    Alert.alert(
      'Start this journey now?',
      'The window opens immediately. Every run and walk you save from now on counts toward the line.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            setStarting(true);
            try {
              const next = await journeyApi.start(journey.id);
              setJourney(next);
            } catch (e: any) {
              const msg = String(e?.message || '');
              if (/already have an active/i.test(msg)) {
                Alert.alert(
                  'Already on a journey',
                  'Another journey is already active. Finish or abandon it first.',
                );
              } else {
                Alert.alert('Could not start', msg || 'Try again in a moment.');
              }
            } finally {
              setStarting(false);
            }
          },
        },
      ],
    );
  };

  const onPickReschedule = async (_event: any, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowRescheduler(false);
    if (!journey || !selected) return;
    try {
      const next = await journeyApi.schedule(journey.id, isoDateString(selected));
      setJourney(next);
    } catch (e: any) {
      Alert.alert('Could not reschedule', String(e?.message || ''));
    }
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

  const isPlanned = journey.status === 'planned';
  const isActive = journey.status === 'active';
  const isCompleted = journey.status === 'completed';
  const isAbandoned = journey.status === 'abandoned';

  const scheduledDate = parseIsoDate(journey.scheduled_for);
  const scheduledDays = scheduledDate ? daysUntil(scheduledDate) : null;

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
              isPlanned && styles.statusPlanned,
              isActive && styles.statusActive,
              isCompleted && styles.statusCompleted,
              isAbandoned && styles.statusAbandoned,
            ]}
          >
            {isPlanned
              ? 'Planned'
              : isActive
              ? 'Active'
              : isCompleted
              ? 'Completed'
              : 'Abandoned'}
          </Text>
        </View>

        {journey.plan_summary ? (
          <Text style={styles.planSummary}>{journey.plan_summary}</Text>
        ) : null}

        {/* ── Planned-state hero: countdown + scheduled date ─────────────── */}
        {isPlanned ? (
          <View style={styles.bigStat}>
            <Text style={styles.bigStatValue}>
              {scheduledDays == null
                ? 'When?'
                : scheduledDays <= 0
                ? 'Today'
                : scheduledDays === 1
                ? 'Tomorrow'
                : `${scheduledDays} days`}
              {scheduledDays != null && scheduledDays > 1 ? (
                <Text style={styles.bigStatTarget}> to go</Text>
              ) : null}
            </Text>
            {scheduledDate ? (
              <Text style={styles.scheduledDateLine}>
                Scheduled for {formatScheduledDate(scheduledDate)}
              </Text>
            ) : (
              <Text style={styles.scheduledDateLine}>No date set yet.</Text>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaItem}>
                {journey.target_distance_km.toFixed(0)} km
              </Text>
              <Text style={styles.metaDot}> · </Text>
              <Text style={styles.metaItem}>
                {journey.max_days <= 1 ? '1 day' : `up to ${journey.max_days} days`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.bigStat}>
            <Text style={styles.bigStatValue}>
              {journey.accumulated_km.toFixed(1)}{' '}
              <Text style={styles.bigStatTarget}>
                / {journey.target_distance_km.toFixed(0)} km
              </Text>
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
        )}

        {isActive ? (
          <View style={styles.hintCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.hintText}>
              {journey.max_days <= 1
                ? 'Today is the day. Every run and walk you save while this journey is active counts toward the line.'
                : `You have up to ${journey.max_days} days. Every run and walk you save inside the window counts.`}
              {journey.expires_at
                ? ` Window closes ${formatExpiresAt(journey.expires_at)}.`
                : ''}
              {journey.is_expired ? ' (window has closed)' : ''}
            </Text>
          </View>
        ) : null}

        {/* ── Planned: map (your usual ground) ──────────────────────── */}
        {isPlanned ? (
          <JourneyPreviewMap
            context={mapContext}
            metaLabel={`${journey.target_distance_km.toFixed(0)} km · ${
              journey.max_days <= 1 ? '1 day' : `up to ${journey.max_days} days`
            }`}
          />
        ) : null}

        {/* ── Planned: readiness note + prep checklist + CTAs ─────────── */}
        {isPlanned && journey.readiness_note ? (
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <Ionicons name="sparkles-outline" size={14} color={colors.textLight} />
              <Text style={styles.guideLabel}>From your Guide</Text>
            </View>
            <Text style={styles.guideText}>{journey.readiness_note}</Text>
          </View>
        ) : null}

        {isPlanned && journey.prep_checklist.length > 0 ? (
          <>
            <Text style={styles.section}>Prep checklist</Text>
            <View style={styles.checklist}>
              {journey.prep_checklist.map((item, idx) => (
                <View key={`prep-${idx}`} style={styles.checklistRow}>
                  <View style={styles.checklistDot} />
                  <Text style={styles.checklistText}>{item}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {isPlanned ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onStartNow}
              disabled={starting}
              style={({ pressed }) => [
                styles.completeBtn,
                starting && { opacity: 0.6 },
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.completeBtnText}>Start it now</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => setShowRescheduler(true)}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>Reschedule</Text>
            </Pressable>
            {Platform.OS === 'ios' && showRescheduler ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={scheduledDate || new Date()}
                  mode="date"
                  display="inline"
                  onChange={onPickReschedule}
                  minimumDate={new Date()}
                />
                <Pressable
                  onPress={() => setShowRescheduler(false)}
                  style={styles.iosPickerDone}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </Pressable>
              </View>
            ) : null}
            {Platform.OS !== 'ios' && showRescheduler ? (
              <DateTimePicker
                value={scheduledDate || new Date()}
                mode="date"
                display="default"
                onChange={onPickReschedule}
                minimumDate={new Date()}
              />
            ) : null}
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [
                styles.abandonBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Text style={styles.abandonBtnText}>Cancel this journey</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 🌅 Guide's debrief — only on completed journeys, only if the
         * Guide is opted in. Quiet card, journal-style. */}
        {isCompleted && journey.completion_note ? (
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <Ionicons name="sparkles-outline" size={14} color={colors.textLight} />
              <Text style={styles.guideLabel}>Guide's note</Text>
            </View>
            <Text style={styles.guideText}>{journey.completion_note}</Text>
          </View>
        ) : null}

        {!isPlanned ? (
          <>
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
          </>
        ) : null}
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

        {/* 🌅 Quiet entry point to chat with the Guide *about this journey*.
         * The chat is journey-aware globally (the active journey is in the
         * Guide's context block), so no extra prompt-engineering is needed
         * here — opening the sheet is enough. */}
        {isActive ? (
          <Pressable
            onPress={() => setChatVisible(true)}
            style={({ pressed }) => [
              styles.askGuideRow,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={styles.askGuideText}>
              {journey.max_days > 1 ? 'Check in with your Guide' : 'Ask your Guide'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
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

        {/* 🗑 Abandoned journeys can be removed from the list. Completed
         * journeys stay forever — they're a record of something you did. */}
        {journey.status === 'abandoned' ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete journey</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          {isPlanned ? (
            <Text style={styles.footerText}>
              Planned. The journey window opens the moment you start it.
            </Text>
          ) : (
            <Text style={styles.footerText}>
              Started {new Date(journey.started_at).toLocaleDateString()}
              {journey.completed_at
                ? `  ·  finished ${new Date(journey.completed_at).toLocaleDateString()}`
                : ''}
            </Text>
          )}
        </View>
      </ScrollView>

      <CoachChatSheet
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        onOptInPress={() => {
          setChatVisible(false);
          // Cross-stack: CoachOptIn lives on the Home stack.
          (navigation as any).navigate?.('Home', { screen: 'CoachOptIn' });
        }}
      />
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
  statusPlanned: { color: colors.warning },
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
  scheduledDateLine: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  checklist: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadows.small,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  checklistDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  checklistText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  iosPickerWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    ...shadows.small,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  iosPickerDoneText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
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
  guideCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  guideLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
  },
  guideText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  askGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'flex-start',
  },
  askGuideText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    flex: 1,
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteBtnText: {
    color: colors.error,
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
