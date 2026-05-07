/**
 * 🌅 JOURNEY ACTIVE CARD
 * =======================
 *
 * Renders a quiet progress card for the user's active Journey on Home.
 * Renders nothing when no journey is active — the surface stays clean
 * until the user opts in.
 *
 * The card states a single number (km accumulated of target), a soft
 * progress bar, and a tap-through to the journey detail screen. It
 * never shouts.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Journey, JourneyDayBrief, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  /** Tap handler. The host navigates to the journey detail screen. */
  onPress: (journey: Journey) => void;
  /** Optional refresh tick — bumping this re-fetches active journey. */
  refreshKey?: number;
}

function parseSchedule(s: string | null | undefined): Date | null {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

export function JourneyActiveCard({ onPress, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [mode, setMode] = useState<'active' | 'planned'>('active');
  const [todayBrief, setTodayBrief] = useState<JourneyDayBrief | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Active journey wins. If there's none, surface the nearest
        // upcoming planned journey so the runner sees what's on the
        // to-do list without having to switch tabs.
        const active = await journeyApi.getActive();
        if (cancelled) return;
        if (active) {
          setJourney(active);
          setMode('active');
          if ((active.max_days || 1) > 1) {
            try {
              const briefs = await journeyApi.listDayBriefs(active.id);
              const day = active.days_active || 1;
              const todays =
                briefs.find((b) => b.day_index === day) ??
                briefs[briefs.length - 1] ??
                null;
              if (!cancelled) setTodayBrief(todays);
            } catch {
              if (!cancelled) setTodayBrief(null);
            }
          } else if (!cancelled) {
            setTodayBrief(null);
          }
          return;
        }

        // No active — fall back to the soonest planned journey.
        try {
          const all = await journeyApi.list();
          if (cancelled) return;
          const upcoming = all
            .filter((j) => j.status === 'planned')
            .sort((x, y) => {
              const xd = x.scheduled_for || '';
              const yd = y.scheduled_for || '';
              if (!xd && !yd) return 0;
              if (!xd) return 1;
              if (!yd) return -1;
              return xd.localeCompare(yd);
            });
          setJourney(upcoming[0] || null);
          setMode('planned');
          setTodayBrief(null);
        } catch {
          if (!cancelled) {
            setJourney(null);
            setTodayBrief(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color={colors.textLight} size="small" />
      </View>
    );
  }

  if (!journey) return null;

  if (mode === 'planned') {
    const date = parseSchedule(journey.scheduled_for);
    let dayLabel = 'No date set';
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = Math.round((date.getTime() - today.getTime()) / 86400000);
      dayLabel =
        days <= 0
          ? 'Today'
          : days === 1
          ? 'Tomorrow'
          : days < 14
          ? `In ${days} days`
          : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return (
      <Pressable
        onPress={() => onPress(journey)}
        style={({ pressed }) => [
          styles.card,
          styles.cardPlanned,
          { transform: [{ scale: pressed ? 0.99 : 1 }] },
        ]}
      >
        <View style={styles.headerRow}>
          <Ionicons name="bookmark-outline" size={14} color={colors.warning} />
          <Text style={styles.labelPlanned}>Planned journey</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{journey.tier}</Text>
          </View>
        </View>
        <Text style={styles.name}>{journey.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {journey.target_distance_km.toFixed(0)} km
            {' · '}
            {journey.max_days <= 1 ? '1 day' : `up to ${journey.max_days} days`}
          </Text>
          <Text style={styles.metaTextWarning}>{dayLabel}</Text>
        </View>
      </Pressable>
    );
  }

  const pct = Math.max(0, Math.min(100, journey.progress_percent || 0));
  return (
    <Pressable
      onPress={() => onPress(journey)}
      style={({ pressed }) => [
        styles.card,
        { transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons name="compass-outline" size={14} color={colors.primary} />
        <Text style={styles.label}>Your slow ultra</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{journey.tier}</Text>
        </View>
      </View>
      <Text style={styles.name}>{journey.name}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {journey.accumulated_km.toFixed(1)} of {journey.target_distance_km.toFixed(0)} km
        </Text>
        <Text style={styles.metaTextSecondary}>
          {journey.max_days <= 1
            ? journey.is_expired
              ? 'window closed'
              : 'today is the day'
            : `day ${Math.min(journey.days_active || 1, journey.max_days)} of ${journey.max_days}`}
        </Text>
      </View>
      {/* 🌅 Today's Guide brief, only on multi-day journeys, only when one
       * has been generated for today. Quiet, two-line max. */}
      {todayBrief ? (
        <Text style={styles.briefText} numberOfLines={3}>
          {todayBrief.text}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.small,
  },
  cardLoading: {
    backgroundColor: colors.surfaceAlt,
    borderLeftColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  cardPlanned: {
    borderLeftColor: colors.warning,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  labelPlanned: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  metaTextSecondary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  metaTextWarning: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  briefText: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight ?? colors.border,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
