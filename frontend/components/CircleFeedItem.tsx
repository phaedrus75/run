import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { ReactionBar, type ReactionState } from './ReactionBar';
import { type ReactionId } from '../constants/reactions';

export interface FeedItemPhoto {
  id: number;
  thumb_data: string;
  caption: string | null;
  distance_marker_km: number;
}

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
  viewer_has_saved?: boolean;
  created_at: string | null;
}

interface CircleFeedItemProps {
  item: FeedItem;
  onReact: (itemType: string, itemId: number, emoji: string) => void;
  onToggleSave?: (runId: number, currentlySaved: boolean) => void;
  onPhotoPress?: (photo: FeedItemPhoto) => void;
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

export function CircleFeedItem({ item, onReact, onToggleSave, onPhotoPress }: CircleFeedItemProps) {
  const isRun = item.type === 'run';
  const photos: FeedItemPhoto[] = (item.data?.photos as FeedItemPhoto[]) || [];
  const photoCount: number = item.data?.photo_count ?? photos.length;
  const moreCount = photoCount - photos.length;
  const reactionStates: ReactionState[] = item.reactions.map(r => ({
    emoji: r.emoji,
    count: r.count,
    reacted: r.reacted,
  }));

  const handleReact = (_id: ReactionId, emoji: string) => {
    onReact(item.type, item.id, emoji);
  };

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

          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              contentContainerStyle={styles.photoStripContent}
            >
              {photos.map(p => (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.85}
                  onPress={() => onPhotoPress?.(p)}
                  style={styles.photoThumbWrap}
                >
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${p.thumb_data}` }}
                    style={styles.photoThumb}
                  />
                  {p.distance_marker_km != null && (
                    <View style={styles.kmBadge}>
                      <Text style={styles.kmBadgeText}>{p.distance_marker_km}K</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {moreCount > 0 && (
                <View style={[styles.photoThumbWrap, styles.moreTile]}>
                  <Text style={styles.moreTileText}>+{moreCount}</Text>
                </View>
              )}
            </ScrollView>
          ) : item.data.has_photos ? (
            <Text style={styles.photoIndicator}>📷 {photoCount} photo{photoCount !== 1 ? 's' : ''}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.checkinBody}>
          <Text style={styles.checkinEmoji}>{item.data.emoji}</Text>
          {item.data.message ? (
            <Text style={styles.checkinMessage}>{item.data.message}</Text>
          ) : null}
        </View>
      )}

      <ReactionBar
        reactions={reactionStates}
        onToggleReaction={handleReact}
        showSave={isRun && !!onToggleSave}
        saved={!!item.viewer_has_saved}
        onToggleSave={isRun && onToggleSave ? () => onToggleSave(item.id, !!item.viewer_has_saved) : undefined}
      />
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
  photoStrip: {
    marginTop: spacing.sm,
  },
  photoStripContent: {
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  photoThumbWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  kmBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  kmBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  moreTile: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
  },
  moreTileText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
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
});
