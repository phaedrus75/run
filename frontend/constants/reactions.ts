/**
 * 🎭 Standardised reactions
 * ==========================
 *
 * Single source of truth for the reaction vocabulary used across Circle
 * and Neighbourhood feeds. Three public reactions (Like / Love / Zen)
 * carry a count and toggle for the current viewer; Save is a personal
 * bookmark with no public count.
 *
 * Emojis chosen for green-tinted, peaceful brand fit.
 */

export type ReactionId = 'like' | 'love' | 'zen';

export interface ReactionDef {
  id: ReactionId;
  emoji: string;
  label: string;
}

export const REACTIONS: ReactionDef[] = [
  { id: 'like', emoji: '👏', label: 'Like' },
  { id: 'love', emoji: '💚', label: 'Love' },
  { id: 'zen', emoji: '🌿', label: 'Zen' },
];

export const REACTION_BY_EMOJI: Record<string, ReactionDef> = REACTIONS.reduce(
  (acc, r) => {
    acc[r.emoji] = r;
    return acc;
  },
  {} as Record<string, ReactionDef>
);

export const REACTION_EMOJIS = REACTIONS.map(r => r.emoji);

export const SAVE_REACTION = {
  emoji: '🔖',
  label: 'Save',
  labelActive: 'Saved',
};
