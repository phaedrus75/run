/**
 * 🧠 GUIDE NOTE CARD
 * ===================
 *
 * Renders the Guide's note for a saved run or walk. Lazy-fetches on
 * first mount; shows nothing if the user has not opted in.
 *
 * The card is intentionally quiet. It styles like a journal annotation
 * — italic serif feel, soft surface, no emoji, no exclamation marks.
 *
 * The component / file are still named `Coach*` because the API and DB
 * keep the internal `coach_*` namespace; only user-facing copy says
 * "Guide". See AI_COACH_SCOPE.md.
 *
 * Usage:
 *   <CoachNoteCard kind="walk" activityId={walk.id} />
 *   <CoachNoteCard kind="run"  activityId={run.id} />
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { coachApi, CoachNote } from '../services/api';
import { colors, radius, spacing, typography } from '../theme/colors';

type Kind = 'run' | 'walk';

interface Props {
  kind: Kind;
  activityId: number;
  /** Called if the user taps "Set up the coach" while opted-out. */
  onOptInPress?: () => void;
}

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; note: CoachNote }
  | { phase: 'opted_out' }
  | { phase: 'error'; message: string };

export function CoachNoteCard({ kind, activityId, onOptInPress }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });

    (async () => {
      try {
        const note =
          kind === 'walk'
            ? await coachApi.getWalkNote(activityId)
            : await coachApi.getRunNote(activityId);
        if (!cancelled) setState({ phase: 'ok', note });
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || '');
        // The backend returns 403 with this exact phrase when coach_enabled=false.
        if (/(coach|guide) is not enabled/i.test(msg) || /403/.test(msg)) {
          setState({ phase: 'opted_out' });
        } else {
          setState({ phase: 'error', message: msg || 'Coach unavailable' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, activityId]);

  if (state.phase === 'loading') {
    return (
      <View style={[styles.card, styles.cardQuiet]}>
        <View style={styles.headerRow}>
          <Ionicons name="sparkles-outline" size={14} color={colors.textLight} />
          <Text style={styles.label}>Guide's note</Text>
        </View>
        <ActivityIndicator color={colors.textLight} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  if (state.phase === 'opted_out') {
    return (
      <Pressable
        onPress={onOptInPress}
        style={[styles.card, styles.cardQuiet, styles.optInCard]}
      >
        <View style={styles.headerRow}>
          <Ionicons name="sparkles-outline" size={14} color={colors.textLight} />
          <Text style={styles.label}>Guide's note</Text>
        </View>
        <Text style={styles.optInText}>
          Turn the Guide on to get a short journal note on every run and walk.
        </Text>
        <View style={styles.optInLink}>
          <Text style={styles.optInLinkText}>Set up your Guide</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  if (state.phase === 'error') {
    // Quiet failure — the brand never insists. A small, dismissable footnote.
    return null;
  }

  const { note } = state;
  return (
    <View style={[styles.card, styles.cardQuiet]}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles-outline" size={14} color={colors.textLight} />
        <Text style={styles.label}>Guide's note</Text>
        {note.is_stub ? (
          <View style={styles.stubBadge}>
            <Text style={styles.stubBadgeText}>preview</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.noteText}>{note.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  cardQuiet: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
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
  noteText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 23,
    fontStyle: 'italic',
  },
  optInCard: { opacity: 1 },
  optInText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  optInLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  optInLinkText: {
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
