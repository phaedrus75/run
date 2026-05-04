/**
 * 🎭 ReactionBar
 * ===============
 *
 * Standardised pill-row of reactions used in Circle + Neighbourhood feeds.
 *
 *   [👏 Like 3] [💚 Love 12] [🌿 Zen]   [🔖 Save]
 *
 * The three public reactions on the left toggle on/off and show counts.
 * The Save bookmark on the right is a personal action (no public count).
 *
 * Each surface wires its own `onToggleReaction` / `onToggleSave` callbacks
 * to the right backend (Circle uses CircleFeedReaction; Neighbourhood
 * dispatches Love → i-ran-this and Like/Zen → run_reactions). The bar
 * itself is presentational.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/colors';
import {
  REACTIONS,
  REACTION_BY_EMOJI,
  SAVE_REACTION,
  type ReactionId,
} from '../constants/reactions';

export interface ReactionState {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface ReactionBarProps {
  reactions: ReactionState[];
  onToggleReaction: (id: ReactionId, emoji: string) => void;
  saved?: boolean;
  onToggleSave?: () => void;
  showSave?: boolean;
  /**
   * If true, hides reactions with count === 0 and reacted === false to
   * declutter feeds with little engagement. Tapping the bar still works
   * because the parent re-renders after a successful toggle adds to count.
   * Disabled by default — show the full vocabulary so the actions are
   * discoverable.
   */
  collapseEmpty?: boolean;
}

export function ReactionBar({
  reactions,
  onToggleReaction,
  saved = false,
  onToggleSave,
  showSave = true,
  collapseEmpty = false,
}: ReactionBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {REACTIONS.map(def => {
          const state = reactions.find(r => r.emoji === def.emoji);
          const count = state?.count ?? 0;
          const reacted = state?.reacted ?? false;
          if (collapseEmpty && count === 0 && !reacted) return null;
          return (
            <Pressable
              key={def.id}
              hitSlop={4}
              style={[styles.pill, reacted && styles.pillActive]}
              onPress={() => onToggleReaction(def.id, def.emoji)}
            >
              <Text style={styles.emoji}>{def.emoji}</Text>
              <Text style={[styles.label, reacted && styles.labelActive]}>
                {def.label}
              </Text>
              {count > 0 && (
                <Text style={[styles.count, reacted && styles.countActive]}>
                  {count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {showSave && onToggleSave && (
        <Pressable
          hitSlop={4}
          style={[styles.pill, styles.savePill, saved && styles.pillActive]}
          onPress={onToggleSave}
        >
          <Text style={styles.emoji}>{SAVE_REACTION.emoji}</Text>
          <Text style={[styles.label, saved && styles.labelActive]}>
            {saved ? SAVE_REACTION.labelActive : SAVE_REACTION.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Re-export for convenience so consumers can match on emoji <-> id.
export { REACTION_BY_EMOJI, REACTIONS };

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    gap: 4,
  },
  pillActive: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xs - 1,
  },
  savePill: {
    marginLeft: 'auto',
  },
  emoji: {
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  count: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginLeft: 1,
  },
  countActive: {
    color: colors.primary,
  },
});
