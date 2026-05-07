/**
 * 🌅 COACH TODAY CARD
 * ====================
 *
 * The calm "today" recommendation rendered on the Home screen for users
 * who have opted into the coach. The text is generated once per UTC day
 * server-side and cached in `coach_today_cards`.
 *
 * Design intent:
 * - The card is quiet. It looks like a hand-written note, not a banner.
 * - It never shouts numbers or pace targets.
 * - It says one specific thing for today and offers a soft "Ask the coach"
 *   thread for the user to push back, vary, or ignore.
 *
 * Behaviour:
 * - Renders nothing if the user is opted out, or `coach_today_card` is off.
 * - Lazily fetches on mount; silent on error.
 * - Renders an "Ask the coach" link that delegates upward via the
 *   `onAskPress` callback (the chat sheet lives at the screen level).
 *
 * Layered with other Home cards above it (greeting, daily wisdom). The
 * point is: the day starts with one clear suggestion, not a dashboard.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { coachApi, CoachTodayCard as CoachTodayCardData } from '../services/api';
import { colors, radius, spacing, typography, shadows } from '../theme/colors';

interface Props {
  /** Tap handler for the soft "Ask the coach" link. Optional in Phase 2 — wired up in Phase 3. */
  onAskPress?: () => void;
  /** Optional press for opting in if disabled (only shown when the coach is off). */
  onOptInPress?: () => void;
  /** Tap handler for the "Run with coach" CTA. Wired in Phase 4. */
  onRunPress?: () => void;
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; card: CoachTodayCardData }
  | { phase: 'opted_out' }
  | { phase: 'disabled_card' }
  | { phase: 'error' };

export function CoachTodayCard({ onAskPress, onOptInPress, onRunPress }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    (async () => {
      try {
        const card = await coachApi.getTodayCard();
        if (!cancelled) setState({ phase: 'ok', card });
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || '');
        if (/(coach|guide) is not enabled/i.test(msg) || /403/.test(msg)) {
          setState({ phase: 'opted_out' });
        } else if (/Today card is disabled/i.test(msg) || /404/.test(msg)) {
          setState({ phase: 'disabled_card' });
        } else {
          setState({ phase: 'error' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === 'loading') {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <View style={styles.headerRow}>
          <Ionicons name="sunny-outline" size={14} color={colors.textLight} />
          <Text style={styles.label}>For today</Text>
        </View>
        <ActivityIndicator color={colors.textLight} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  // The Today card is opt-in-only. We render NOTHING when the coach is off
  // or when the user has chosen to hide today's card — the home screen has
  // its own opt-in surface in Profile and we don't want a recurring nag.
  if (state.phase === 'opted_out' || state.phase === 'disabled_card' || state.phase === 'error') {
    return null;
  }

  const { card } = state;
  return (
    <View style={[styles.card]}>
      <View style={styles.headerRow}>
        <Ionicons name="sunny-outline" size={14} color={colors.primary} />
        <Text style={styles.label}>For today</Text>
        {card.is_stub ? (
          <View style={styles.stubBadge}>
            <Text style={styles.stubBadgeText}>preview</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardText}>{card.text}</Text>
      <View style={styles.actionRow}>
        {onRunPress ? (
          <Pressable
            onPress={onRunPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.runBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.runBtnText}>Run with your Guide</Text>
          </Pressable>
        ) : null}
        {onAskPress ? (
          <Pressable
            onPress={onAskPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.askRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.askText}>Ask your Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {/* Suppress unused warning for opt-in handler (used in other phases) */}
      {false && onOptInPress ? <View /> : null}
    </View>
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
  },
  cardText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  runBtnText: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  askText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  stubBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: 'auto',
  },
  stubBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
