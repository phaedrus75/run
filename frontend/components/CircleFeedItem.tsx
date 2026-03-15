import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

const REACTION_EMOJIS = ['🌿', '👋', '🌊', '☀️', '🏔️'];

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface FeedItem {
  type: 'run' | 'checkin';
  id: number;
  user_name: string;
  user_handle: string | null;
  is_you: boolean;
  data: any;
  reactions: Reaction[];
  created_at: string | null;
}

interface CircleFeedItemProps {
  item: FeedItem;
  onReact: (itemType: string, itemId: number, emoji: string) => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CircleFeedItem({ item, onReact }: CircleFeedItemProps) {
  const isRun = item.type === 'run';

  return (
    <View style={[styles.card, shadows.small]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.user_name[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.userName}>
            {item.user_name}{item.is_you ? ' (You)' : ''}
          </Text>
          <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>

      {isRun ? (
        <View style={styles.runBody}>
          <View style={styles.runRow}>
            <View style={[styles.distanceBadge, { backgroundColor: colors.runTypes[item.data.distance?.toLowerCase()] || colors.primary }]}>
              <Text style={styles.distanceText}>{item.data.distance}</Text>
            </View>
            <View style={styles.runDetails}>
              <Text style={styles.runStat}>{item.data.formatted_duration}</Text>
              <Text style={styles.runStatLabel}>{item.data.category === 'treadmill' ? 'Treadmill' : 'Outdoor'}</Text>
            </View>
            {item.data.mood && (
              <Text style={styles.moodEmoji}>
                {item.data.mood === 'easy' ? '😌' : item.data.mood === 'good' ? '😊' : item.data.mood === 'tough' ? '😤' : item.data.mood === 'great' ? '😄' : ''}
              </Text>
            )}
          </View>
          {item.data.has_photos && (
            <Text style={styles.photoIndicator}>📷 {item.data.photo_count} photo{item.data.photo_count !== 1 ? 's' : ''}</Text>
          )}
        </View>
      ) : (
        <View style={styles.checkinBody}>
          <Text style={styles.checkinEmoji}>{item.data.emoji}</Text>
          {item.data.message ? (
            <Text style={styles.checkinMessage}>{item.data.message}</Text>
          ) : null}
        </View>
      )}

      <View style={styles.reactionBar}>
        {REACTION_EMOJIS.map(emoji => {
          const existing = item.reactions.find(r => r.emoji === emoji);
          const count = existing?.count || 0;
          const reacted = existing?.reacted || false;
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactionButton, reacted && styles.reactionButtonActive]}
              onPress={() => onReact(item.type, item.id, emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 0 && <Text style={[styles.reactionCount, reacted && styles.reactionCountActive]}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  headerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: 1,
  },
  runBody: {
    marginBottom: spacing.sm,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  distanceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  distanceText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  runDetails: {
    flex: 1,
  },
  runStat: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  runStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  moodEmoji: {
    fontSize: 24,
  },
  photoIndicator: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  checkinBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkinEmoji: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  checkinMessage: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    flex: 1,
    fontStyle: 'italic',
  },
  reactionBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  reactionButtonActive: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 3,
    fontWeight: typography.weights.medium,
  },
  reactionCountActive: {
    color: colors.primary,
  },
});
