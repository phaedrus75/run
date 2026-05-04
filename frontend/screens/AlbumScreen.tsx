/**
 * ALBUM — Instagram-style.
 *
 * Two view modes:
 *   - Grid (default): tight 3-column square thumbnails. Photos lead.
 *   - Feed: per-activity post cards with handle row, full-bleed photo,
 *           action row (View activity, Share), caption + km marker.
 *
 * Server returns a flat reverse-chronological photo timeline; grouping for
 * the feed view is done on the client. Pagination is shared across modes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { albumApi, AlbumPhoto, AlbumPhotoActivity } from '../services/api';
import { albumCache } from '../services/albumCache';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { AppHeader } from '../components/AppHeader';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_SIZE = 24;

const GRID_COLS = 3;
const GRID_GAP = 2;
const GRID_TILE = Math.floor((SCREEN_W - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

interface Group {
  key: string;
  kind: 'run' | 'walk';
  activityId: number;
  activity: AlbumPhotoActivity;
  photos: AlbumPhoto[];
}

interface Props {
  navigation: any;
}

type Mode = 'grid' | 'feed';

export function AlbumScreen({ navigation }: Props) {
  const { user } = useAuth();

  // Hydrate from the module-level cache so re-opening the tab is instant
  // and we don't pay for a full refetch every time.
  const cached = albumCache.read();
  const [photos, setPhotos] = useState<AlbumPhoto[]>(cached?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMore, setHasMore] = useState<boolean>(cached?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoaded, setFirstLoaded] = useState<boolean>(!!cached);
  const [mode, setMode] = useState<Mode>('grid');

  const fetchPage = useCallback(
    async (reset: boolean, opts: { silent?: boolean } = {}) => {
      // Allow concurrent silent revalidate to skip if a foreground load
      // is already in flight — the foreground load will refresh state.
      if (loading && opts.silent) return;
      if (loading && !opts.silent) return;
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const page = await albumApi.list({
          cursor: reset ? null : cursor,
          limit: PAGE_SIZE,
          include_data: true,
        });
        if (reset) {
          setPhotos(page.items);
          albumCache.writeFirstPage(page.items, page.next_cursor);
        } else {
          setPhotos((prev) => [...prev, ...page.items]);
          albumCache.appendPage(page.items, page.next_cursor);
        }
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
      } catch (e: any) {
        if (!opts.silent) setError(e?.message ?? 'Could not load album.');
      } finally {
        if (!opts.silent) setLoading(false);
        setRefreshing(false);
        setFirstLoaded(true);
      }
    },
    [cursor, loading],
  );

  // Initial mount: only hit the network if we have no cache, or the
  // cache is older than the TTL. Either way we render whatever we have
  // immediately (see hydration above).
  useEffect(() => {
    if (!cached) {
      void fetchPage(true);
    } else if (albumCache.isStale()) {
      // Fresh data in the background, no spinner.
      void fetchPage(true, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-focus: revalidate silently if stale, never blow away the list.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (albumCache.isStale()) void fetchPage(true, { silent: true });
    });
    return unsub;
  }, [navigation, fetchPage]);

  const groups = useMemo<Group[]>(() => groupByActivity(photos), [photos]);

  const counts = useMemo(() => {
    const runIds = new Set<number>();
    const walkIds = new Set<number>();
    for (const p of photos) {
      if (p.kind === 'run') runIds.add(p.activity_id);
      else walkIds.add(p.activity_id);
    }
    return { photos: photos.length, runs: runIds.size, walks: walkIds.size };
  }, [photos]);

  const onRefresh = () => {
    setRefreshing(true);
    setCursor(null);
    setHasMore(true);
    void fetchPage(true);
  };

  const onEndReached = () => {
    if (!hasMore || loading) return;
    void fetchPage(false);
  };

  const onPhotoPress = (group: Group, photo: AlbumPhoto, index: number) => {
    navigation.navigate('AlbumPhoto', {
      photo,
      groupPhotos: group.photos,
      index,
    });
  };

  const onActivityPress = (group: Group) => {
    if (group.kind === 'walk') {
      navigation.navigate('Activity', {
        screen: 'WalkDetail',
        params: { walkId: group.activityId },
      });
    } else {
      navigation.navigate('Activity', {
        screen: 'ActivityHome',
        params: { segment: 'runs', focusRunId: group.activityId },
      });
    }
  };

  /* ───────────── Header (profile-style) ───────────── */

  const profileHeader = (
    <View style={styles.profileHeader}>
      <View style={styles.profileTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name?.[0] ?? user?.email?.[0] ?? 'Z').toUpperCase()}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Stat value={counts.photos} label="photos" />
          <Stat value={counts.runs} label="runs" />
          <Stat value={counts.walks} label="walks" />
        </View>
      </View>
      <Text style={styles.profileName}>{user?.name || 'Runner'}</Text>
      <Text style={styles.profileBio}>The path and the album.</Text>

      <View style={styles.modeBar}>
        <ModeButton
          active={mode === 'grid'}
          onPress={() => setMode('grid')}
          icon="grid-outline"
        />
        <ModeButton
          active={mode === 'feed'}
          onPress={() => setMode('feed')}
          icon="reader-outline"
        />
      </View>
    </View>
  );

  /* ───────────── Empty / loading states ───────────── */

  if (!firstLoaded && loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (firstLoaded && photos.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />
        {profileHeader}
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="camera-outline" size={32} color={colors.textLight} />
          </View>
          <Text style={styles.emptyTitle}>Your album is waiting.</Text>
          <Text style={styles.emptyBody}>
            Photos you take on a run or walk land here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ───────────── Grid mode ───────────── */

  if (mode === 'grid') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />
        {error && <ErrorBanner message={error} />}
        <FlatList
          data={photos}
          key="grid"
          numColumns={GRID_COLS}
          keyExtractor={(p) => `${p.kind}-${p.id}`}
          renderItem={({ item, index }) => {
            const isRightEdge = (index + 1) % GRID_COLS === 0;
            return (
              <Pressable
                onPress={() => {
                  const group = findGroupForPhoto(groups, item);
                  if (group) {
                    const idx = group.photos.findIndex(
                      (gp) => gp.kind === item.kind && gp.id === item.id,
                    );
                    onPhotoPress(group, item, Math.max(0, idx));
                  }
                }}
                style={[
                  styles.gridTile,
                  { marginRight: isRightEdge ? 0 : GRID_GAP, marginBottom: GRID_GAP },
                ]}
              >
                {item.photo_data ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${item.photo_data}` }}
                    style={styles.gridImage}
                  />
                ) : (
                  <View style={[styles.gridImage, styles.tilePlaceholder]} />
                )}
                <View style={styles.gridKindDot}>
                  <MaterialCommunityIcons
                    name={item.kind === 'run' ? 'run-fast' : 'walk'}
                    size={11}
                    color="#fff"
                  />
                </View>
              </Pressable>
            );
          }}
          ListHeaderComponent={profileHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loading && photos.length > 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : !hasMore && photos.length >= 12 ? (
              <Text style={styles.footerEnd}>That&apos;s everything ✦</Text>
            ) : null
          }
        />
      </SafeAreaView>
    );
  }

  /* ───────────── Feed mode ───────────── */

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />
      {error && <ErrorBanner message={error} />}
      <FlatList
        data={groups}
        key="feed"
        keyExtractor={(g) => g.key}
        renderItem={({ item: group }) => (
          <FeedCard
            group={group}
            displayName={user?.name || 'Runner'}
            onPhotoPress={(photo, idx) => onPhotoPress(group, photo, idx)}
            onActivityPress={() => onActivityPress(group)}
          />
        )}
        ListHeaderComponent={profileHeader}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loading && groups.length > 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : !hasMore && groups.length >= 3 ? (
            <Text style={styles.footerEnd}>That&apos;s everything ✦</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/* ───────────── Sub-components ───────────── */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ModeButton({
  active,
  onPress,
  icon,
}: {
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      hitSlop={8}
    >
      <Ionicons name={icon} size={22} color={active ? colors.text : colors.textLight} />
    </Pressable>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={14} color="#fff" />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

const FEED_PHOTO_SIZE = SCREEN_W; // square, edge to edge

function FeedCard({
  group,
  displayName,
  onPhotoPress,
  onActivityPress,
}: {
  group: Group;
  displayName: string;
  onPhotoPress: (photo: AlbumPhoto, index: number) => void;
  onActivityPress: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const photos = group.photos;
  const lead = photos[activeIdx] ?? photos[0];
  const dateLabel = formatDate(group.activity.started_at || group.activity.completed_at);
  const subtitle = labelForActivity(group);

  const onShare = async () => {
    const km = group.activity.distance_km;
    const distance = km > 0 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : '';
    const kind = group.kind === 'run' ? 'run' : 'walk';
    try {
      await Share.share({
        message: `${distance} ${kind} on ${dateLabel.toLowerCase()} · #zenrun`,
      });
    } catch {
      // user dismissed
    }
  };

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedHeaderRow}>
        <View style={styles.feedAvatar}>
          <MaterialCommunityIcons
            name={group.kind === 'run' ? 'run-fast' : 'walk'}
            size={18}
            color={group.kind === 'run' ? '#F97316' : '#10B981'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.feedAuthor}>{displayName}</Text>
          <Text style={styles.feedSub}>
            {subtitle} · {dateLabel}
          </Text>
        </View>
        <Pressable onPress={onActivityPress} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.feedPhotoWrap}>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={photos}
          keyExtractor={(p) => `${p.kind}-${p.id}`}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / FEED_PHOTO_SIZE);
            setActiveIdx(Math.max(0, Math.min(photos.length - 1, idx)));
          }}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => onPhotoPress(item, index)}>
              {item.photo_data ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.photo_data}` }}
                  style={styles.feedPhoto}
                />
              ) : (
                <View style={[styles.feedPhoto, styles.tilePlaceholder]} />
              )}
            </Pressable>
          )}
        />
        {photos.length > 1 && (
          <View style={styles.feedCountPill}>
            <Text style={styles.feedCountPillText}>
              {activeIdx + 1}/{photos.length}
            </Text>
          </View>
        )}
        {lead?.distance_marker_km != null && lead.distance_marker_km > 0 && (
          <View style={styles.feedKmPill}>
            <Text style={styles.feedKmText}>
              {Math.round(lead.distance_marker_km * 10) / 10}K
            </Text>
          </View>
        )}
      </View>

      <View style={styles.feedActions}>
        <Pressable onPress={onActivityPress} style={styles.feedActionBtn} hitSlop={6}>
          <Ionicons name="map-outline" size={22} color={colors.text} />
          <Text style={styles.feedActionText}>View activity</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.feedActionBtn} hitSlop={6}>
          <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
        </Pressable>
        {photos.length > 1 && (
          <View style={styles.feedDots}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.feedDot, i === activeIdx && styles.feedDotActive]}
              />
            ))}
          </View>
        )}
      </View>

      {lead?.caption ? (
        <Text style={styles.feedCaption} numberOfLines={3}>
          <Text style={styles.feedCaptionAuthor}>{displayName}</Text> {lead.caption}
        </Text>
      ) : null}
    </View>
  );
}

/* ───────────── Helpers ───────────── */

function findGroupForPhoto(groups: Group[], photo: AlbumPhoto): Group | null {
  const key = `${photo.kind}-${photo.activity_id}`;
  return groups.find((g) => g.key === key) ?? null;
}

function markerSortKey(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return Number.POSITIVE_INFINITY;
  return km;
}

function sortPhotosByMarkerDistance(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => {
    const da = markerSortKey(a.distance_marker_km);
    const db = markerSortKey(b.distance_marker_km);
    if (da !== db) return da - db;
    return a.id - b.id;
  });
}

function groupByActivity(photos: AlbumPhoto[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of photos) {
    const key = `${p.kind}-${p.activity_id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        kind: p.kind,
        activityId: p.activity_id,
        activity: p.activity,
        photos: [],
      };
      map.set(key, g);
    }
    g.photos.push(p);
  }
  for (const g of map.values()) {
    g.photos = sortPhotosByMarkerDistance(g.photos);
  }
  return Array.from(map.values());
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';

  const diffMs = now.getTime() - d.getTime();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  if (diffMs < ONE_WEEK) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function labelForActivity(group: Group): string {
  const km = group.activity.distance_km;
  const kind = group.kind === 'run' ? 'run' : 'walk';
  const distance = km > 0 ? `${km.toFixed(km < 10 ? 1 : 0)} km ${kind}` : kind;
  return capitalise(distance);
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/* ───────────── Styles ───────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Profile-style header
  profileHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  profileBio: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  modeBtnActive: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text,
  },

  // Grid
  gridTile: {
    width: GRID_TILE,
    height: GRID_TILE,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  tilePlaceholder: { backgroundColor: colors.surfaceAlt },
  gridKindDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Feed
  feedCard: {
    backgroundColor: colors.background,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  feedAuthor: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  feedSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  feedPhotoWrap: {
    width: SCREEN_W,
    height: FEED_PHOTO_SIZE,
    backgroundColor: colors.surfaceAlt,
  },
  feedPhoto: {
    width: SCREEN_W,
    height: FEED_PHOTO_SIZE,
  },
  feedCountPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  feedCountPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  feedKmPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  feedKmText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  feedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedActionText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  feedDots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  feedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  feedDotActive: { backgroundColor: colors.primary },
  feedCaption: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    lineHeight: 19,
  },
  feedCaptionAuthor: {
    fontWeight: typography.weights.bold,
  },

  // Empty / errors
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  errorBannerText: { color: '#fff', fontSize: typography.sizes.xs, flex: 1 },
  footerEnd: {
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontSize: typography.sizes.xs,
    letterSpacing: 1,
  },
});
