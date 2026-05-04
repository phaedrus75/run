/**
 * 📸 ALBUM PHOTO DETAIL — full-screen photo viewer
 * ================================================
 *
 * Opened from the Album activity card. Shows the photo full-bleed with:
 *   - Horizontal swipe between photos in the same activity
 *   - Pinch-to-zoom on the focused photo (+ pan when zoomed)
 *   - The activity context (run / walk, distance, when)
 *   - The caption
 *   - A "View activity" link that jumps to the run / walk detail screen
 *   - A share button — for Build 35 we share the photo + a textual stamp
 *     (distance · pace · day). Build 36 will add a rendered image overlay
 *     (requires `react-native-view-shot`, deferred to keep this build's
 *     native deps unchanged).
 *
 * Navigation params:
 *   - `photo`        : the AlbumPhoto that was tapped (legacy single-photo mode)
 *   - `groupPhotos`  : optional AlbumPhoto[] of all photos in the activity
 *   - `index`        : starting index within `groupPhotos`
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Share,
  Dimensions,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AlbumPhoto, albumApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, radius } from '../theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  navigation: any;
  route: {
    params?: {
      photo?: AlbumPhoto;
      groupPhotos?: AlbumPhoto[];
      index?: number;
    };
  };
}

export function AlbumPhotoDetailScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const initialPhoto = route?.params?.photo;
  const groupPhotos: AlbumPhoto[] = useMemo(() => {
    const list = route?.params?.groupPhotos;
    if (Array.isArray(list) && list.length > 0) return list;
    if (initialPhoto) return [initialPhoto];
    return [];
  }, [route?.params?.groupPhotos, initialPhoto]);

  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, Math.min(groupPhotos.length - 1, route?.params?.index ?? 0)),
  );
  const flatListRef = useRef<FlatList<AlbumPhoto>>(null);

  if (groupPhotos.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Photo not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activePhoto = groupPhotos[activeIndex];
  const dateLabel = activePhoto.activity.completed_at
    ? new Date(activePhoto.activity.completed_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const goToActivity = () => {
    if (activePhoto.kind === 'run') {
      navigation.navigate('Activity', {
        screen: 'ActivityHome',
        params: { segment: 'runs', focusRunId: activePhoto.activity.id },
      });
    } else {
      navigation.navigate('Activity', {
        screen: 'WalkDetail',
        params: { walkId: activePhoto.activity.id },
      });
    }
  };

  const onShare = async () => {
    const stamp = buildStamp(activePhoto);
    try {
      await Share.share({
        message: stamp,
      });
    } catch {
      // user dismissed
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const idx = viewableItems[0]?.index;
      if (typeof idx === 'number') setActiveIndex(idx);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const renderItem: ListRenderItem<AlbumPhoto> = ({ item }) => (
    <ZoomablePhoto photo={item} />
  );

  const displayName = user?.name || 'Runner';
  const km = activePhoto.activity.distance_km;
  const subtitle = `${km > 0 ? `${km.toFixed(km < 10 ? 1 : 0)} km ` : ''}${activePhoto.kind === 'run' ? 'run' : 'walk'} · ${dateLabel}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <MaterialCommunityIcons
              name={activePhoto.kind === 'run' ? 'run-fast' : 'walk'}
              size={16}
              color={activePhoto.kind === 'run' ? '#F97316' : '#10B981'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtitle}
              {groupPhotos.length > 1 ? ` · ${activeIndex + 1}/${groupPhotos.length}` : ''}
            </Text>
          </View>
        </View>
        <Pressable onPress={onShare} hitSlop={10}>
          <Ionicons name="paper-plane-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={groupPhotos}
        keyExtractor={(p) => `${p.kind}-${p.id}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      <View style={styles.bottomCard}>
        <View style={styles.actionRow}>
          <Pressable onPress={goToActivity} style={styles.actionBtn} hitSlop={6}>
            <Ionicons name="map-outline" size={24} color="#fff" />
            <Text style={styles.actionText}>View activity</Text>
          </Pressable>
          {groupPhotos.length > 1 && (
            <View style={styles.dots}>
              {groupPhotos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
          {activePhoto.distance_marker_km > 0 && (
            <View style={styles.kmPill}>
              <Text style={styles.kmPillText}>
                {Math.round(activePhoto.distance_marker_km * 10) / 10}K
              </Text>
            </View>
          )}
        </View>
        {activePhoto.caption ? (
          <Text style={styles.caption}>
            <Text style={styles.captionAuthor}>{displayName}</Text>{' '}
            {activePhoto.caption}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/** A single zoomable photo page. Reanimated shared values handle the
 *  pinch-to-zoom and pan-when-zoomed gestures. Springs back to identity
 *  on release so swiping to the next page always starts fresh.
 *
 *  The Album feed delivers small (~360px) thumbnails so the grid loads fast.
 *  When the user opens a photo, this view shows the thumbnail immediately
 *  and asynchronously fetches the full-resolution image, swapping it in
 *  once available. */
function ZoomablePhoto({ photo }: { photo: AlbumPhoto }) {
  const [fullData, setFullData] = useState<string | null>(
    photo.is_thumb ? null : photo.photo_data ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!photo.is_thumb) {
      setFullData(photo.photo_data ?? null);
      return;
    }
    albumApi
      .getFull(photo.kind, photo.id)
      .then((res) => {
        if (!cancelled) setFullData(res.photo_data);
      })
      .catch(() => {
        // Stay on the thumbnail if the upgrade fails; user still sees something.
      });
    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.kind, photo.is_thumb, photo.photo_data]);

  const sourceData = fullData ?? photo.photo_data ?? null;
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      // Only allow pan when zoomed in; otherwise we'd interfere with the
      // outer FlatList's horizontal swipe between photos.
      if (savedScale.value > 1.05) {
        translateX.value = savedTx.value + e.translationX;
        translateY.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = translateX.value;
      savedTy.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withSpring(2.2);
        savedScale.value = 2.2;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.page}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.zoomWrap, animatedStyle]}>
          {sourceData ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${sourceData}` }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Ionicons name="image-outline" size={64} color={colors.textLight} />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Textual share-stamp. Build 36 will replace this with a rendered image
 *  card overlay, but for now it's just a concise caption that captures
 *  the brand voice (distance · day · #zenrun). */
function buildStamp(photo: AlbumPhoto): string {
  const km = photo.activity.distance_km;
  const distance = km > 0 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : '';
  const minutes = Math.floor(photo.activity.duration_seconds / 60);
  const seconds = photo.activity.duration_seconds % 60;
  const time =
    minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '';
  const dateStr = photo.activity.completed_at
    ? new Date(photo.activity.completed_at).toLocaleDateString(undefined, {
        weekday: 'long',
      })
    : '';
  const kind = photo.kind === 'run' ? 'run' : 'walk';
  const parts = [distance, time ? `${time} ${kind}` : null, dateStr].filter(Boolean);
  return `${parts.join(' · ')} · #zenrun`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#000',
    gap: spacing.md,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
  headerSub: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  page: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomWrap: {
    width: SCREEN_W,
    height: SCREEN_H * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCard: {
    backgroundColor: '#000',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: { backgroundColor: '#fff' },
  kmPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.full,
  },
  kmPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  caption: {
    fontSize: typography.sizes.sm,
    color: '#fff',
    lineHeight: 19,
  },
  captionAuthor: {
    fontWeight: typography.weights.bold,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: typography.sizes.md },
});
