/**
 * 📸 PHOTO HERO CAROUSEL
 * ======================
 *
 * Horizontal photo carousel used at the top of the run/walk detail
 * screens. Photos lead, then the map, then stats — that's the brand
 * sequence ("the path and the album").
 *
 * Each card shows:
 *   - The photo (full-bleed, large)
 *   - A small distance-marker pill in the top-left
 *   - A caption preview at the bottom (if present)
 *
 * Tapping a card invokes `onPress(photo)` — typically opening a
 * lightbox / pinch-zoomable viewer in the parent.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { colors, radius, spacing, typography, shadows } from '../theme/colors';

export interface HeroPhoto {
  id: number;
  /** Full-resolution base64 JPEG, if loaded. Falls back to thumb when missing. */
  photo_data?: string | null;
  /** Small base64 thumbnail. Used as the carousel source — full-res is only
   *  needed when the user opens the lightbox. */
  thumb_data?: string | null;
  distance_marker_km?: number | null;
  caption?: string | null;
}

interface Props {
  photos: HeroPhoto[];
  onPress?: (photo: HeroPhoto, index: number) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.72);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.2);

export function PhotoHeroCarousel({ photos, onPress }: Props) {
  if (!photos || photos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.md}
        snapToAlignment="start"
      >
        {photos.map((photo, idx) => {
          const km = photo.distance_marker_km != null
            ? Math.round(photo.distance_marker_km * 10) / 10
            : null;
          return (
            <Pressable
              key={photo.id}
              onPress={() => onPress?.(photo, idx)}
              style={({ pressed }) => [
                styles.card,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              {(() => {
                // Prefer the thumbnail (cheap to render, ~5–15 KB) and fall
                // back to the full image only if the caller already has it.
                const src = photo.thumb_data ?? photo.photo_data;
                return src ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${src}` }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.image, styles.placeholder]}>
                    <Text style={styles.placeholderText}>📷</Text>
                  </View>
                );
              })()}

              {/* Distance pill — top-left */}
              {km != null && (
                <View style={styles.markerPill}>
                  <Text style={styles.markerPillText}>{km}K</Text>
                </View>
              )}

              {/* Caption — bottom gradient strip */}
              {photo.caption ? (
                <View style={styles.captionWrap}>
                  <Text style={styles.captionText} numberOfLines={2}>
                    {photo.caption}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {/* Trailing spacer so the last card can scroll fully into view */}
        <View style={{ width: spacing.md }} />
      </ScrollView>

      {photos.length > 1 && (
        <Text style={styles.countHint}>
          {photos.length} photos · swipe to browse
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.medium,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 40, opacity: 0.4 },
  markerPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  markerPillText: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captionText: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  countHint: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
