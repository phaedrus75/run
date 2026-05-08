/**
 * 🌅 JOURNEY PREVIEW SCREEN
 * ==========================
 *
 * The new "show me before you start it" screen. The user lands here when
 * they tap a Guide suggestion or a static template card on
 * StartJourneyScreen — they see the journey's shape, a readiness line
 * from the Guide, a discrete prep checklist, and a date picker, before
 * deciding to:
 *
 *   - "Plan it" — saves as `planned` with the chosen date, lives on the
 *                  to-do list, prep happens in the lead-up.
 *   - "Start it now" — saves as `active`, the window opens immediately
 *                      and runs/walks start auto-attributing.
 *
 * The screen never persists anything by itself; the preview endpoint
 * is read-only and the journey only exists when the user commits.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Journey, JourneyMapContext, JourneyPreview, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';
import { JourneyPreviewMap } from '../components/JourneyPreviewMap';

interface Props {
  navigation: any;
  route: {
    params?: {
      tier?: string;
      name?: string;
      blurb?: string;
    };
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

export function JourneyPreviewScreen({ navigation, route }: Props) {
  const { tier, name, blurb } = route?.params || {};

  const [preview, setPreview] = useState<JourneyPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState<'plan' | 'start' | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tier || !name) {
      setError('Missing journey tier or name.');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await journeyApi.preview({ tier, name, blurb });
        if (cancelled) return;
        setPreview(p);
        setScheduledDate(parseIsoDate(p.suggested_scheduled_for));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || 'Could not load preview'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tier, name, blurb]);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const onPickDate = (_event: any, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (selected) setScheduledDate(selected);
  };

  const commit = async (mode: 'plan' | 'start') => {
    if (!preview) return;
    if (mode === 'plan' && !scheduledDate) {
      Alert.alert('Pick a date', 'Choose when you want to do this journey.');
      return;
    }
    setSubmitting(mode);
    try {
      const journey = await journeyApi.create({
        name: preview.name,
        tier: preview.tier,
        plan_summary: preview.plan_summary,
        readiness_note: preview.readiness_note,
        prep_checklist: preview.prep_checklist,
        as_planned: mode === 'plan',
        scheduled_for: mode === 'plan' && scheduledDate ? isoDateString(scheduledDate) : null,
      });
      // Pop both StartJourney and JourneyPreview off the stack — the
      // user lands on JourneyDetail and can come back via the tab.
      (navigation as any).replace?.('JourneyDetail', { journeyId: journey.id });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (mode === 'start' && /already have an active/i.test(msg)) {
        Alert.alert(
          'Already on a journey',
          'You already have an active journey. Finish or abandon it before starting another. ' +
            'You can still plan this one and start it later.',
        );
      } else {
        Alert.alert(
          mode === 'plan' ? 'Could not plan' : 'Could not start',
          msg || 'Try again in a moment.',
        );
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingHint}>Your Guide is preparing this…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !preview) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Could not load preview.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const days = preview.max_days <= 1 ? '1 day' : `up to ${preview.max_days} days`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Preview</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.heroRow}>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{preview.tier}</Text>
          </View>
          <Text style={styles.tierMeta}>
            {preview.target_distance_km.toFixed(0)} km · {days}
          </Text>
        </View>
        <Text style={styles.name}>{preview.name}</Text>
        <Text style={styles.blurb}>{preview.plan_summary}</Text>

        {/* ── Map (your usual ground) ───────────────────────────────── */}
        <JourneyPreviewMap
          context={preview.map_context}
          metaLabel={`${preview.target_distance_km.toFixed(0)} km · ${days}`}
        />

        {/* ── Readiness ──────────────────────────────────────────────── */}
        <View style={styles.readinessCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={styles.cardLabel}>From your Guide</Text>
          </View>
          <Text style={styles.readinessText}>{preview.readiness_note}</Text>
        </View>

        {/* ── Prep checklist ─────────────────────────────────────────── */}
        {preview.prep_checklist.length > 0 ? (
          <>
            <Text style={styles.section}>Prep checklist</Text>
            <View style={styles.checklist}>
              {preview.prep_checklist.map((item, idx) => (
                <View key={`prep-${idx}`} style={styles.checklistRow}>
                  <View style={styles.checklistDot} />
                  <Text style={styles.checklistText}>{item}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Schedule ───────────────────────────────────────────────── */}
        <Text style={styles.section}>When?</Text>
        <Text style={styles.scheduleHint}>
          Pick the day you mean to start. You can always reschedule from the journey
          details later.
        </Text>
        {Platform.OS === 'ios' ? (
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <DateTimePicker
              value={scheduledDate || minDate}
              mode="date"
              display="compact"
              onChange={onPickDate}
              minimumDate={minDate}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.dateBtn,
                { transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              <Text style={styles.dateBtnText}>
                {scheduledDate ? formatDate(scheduledDate) : 'Choose a date'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={scheduledDate || minDate}
                mode="date"
                display="default"
                onChange={onPickDate}
                minimumDate={minDate}
              />
            ) : null}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Footer CTAs ──────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => void commit('plan')}
          disabled={submitting !== null}
          style={({ pressed }) => [
            styles.planBtn,
            submitting !== null && { opacity: 0.6 },
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          {submitting === 'plan' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="bookmark-outline" size={18} color="#fff" />
              <Text style={styles.planBtnText}>Plan it</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => void commit('start')}
          disabled={submitting !== null}
          style={({ pressed }) => [
            styles.startBtn,
            submitting !== null && { opacity: 0.6 },
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          {submitting === 'start' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.startBtnText}>Start it now</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  headerBar: {
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
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  loadingHint: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.error,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  tierMeta: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  name: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  blurb: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  readinessCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
  },
  readinessText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
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
  scheduleHint: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.small,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.small,
  },
  dateBtnText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  bottomSpacer: { height: spacing.xl },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  planBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  planBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  startBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
