/**
 * 📸 ALBUM SCREEN
 * ===============
 *
 * Top-level surface for every photo the user has taken on every run and
 * every walk, in one timeline. Mirrors the brand's "the album" pillar —
 * "the path and the album."
 *
 * Build 35 layout: photos are grouped into **activity cards** rather than
 * a flat grid. Each card shows the activity's date + headline stat,
 * followed by a horizontal photo strip. Tap a photo to open the viewer
 * (pinch-zoom + horizontal swipe between photos in the same activity).
 *
 * Implementation notes:
 *   - The backend feed is still a flat photo timeline — we group on the
 *     client by `${kind}-${activity_id}`. As long as the server returns
 *     photos in newest-first order (it does), grouping preserves chronology
 *     because all photos from the same activity arrive contiguously enough
 *     for a single sweep.
 *   - When pagination loads more photos, we re-group the entire list so
 *     trailing photos from the previous page can fold into the next page's
 *     activity card.
 *   - Pull-to-refresh resets pagination. Reaching the bottom auto-loads
 *     the next page.
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
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { albumApi, AlbumPhoto, AlbumPhotoActivity } from '../services/api';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { AppHeader } from '../components/AppHeader';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_SIZE = 24;
const STRIP_TILE = 96;
const STRIP_GAP = 6;

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

export function AlbumScreen({ navigation }: Props) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoaded, setFirstLoaded] = useState(false);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const page = await albumApi.list({
          cursor: reset ? null : cursor,
          limit: PAGE_SIZE,
          include_data: true,
        });
        setPhotos((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
      } catch (e: any) {
        setError(e?.message ?? 'Could not load album.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setFirstLoaded(true);
      }
    },
    [cursor, loading],
  );

  useEffect(() => {
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when the screen regains focus (so newly-uploaded photos show
  // up promptly).
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (firstLoaded) void fetchPage(true);
    });
    return unsub;
  }, [navigation, fetchPage, firstLoaded]);

  // Group photos by activity in memory. Preserves the server's reverse-
  // chronological order: the first activity card is the most recent.
  const groups = useMemo<Group[]>(() => groupByActivity(photos), [photos]);

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

  const renderGroup = ({ item: group }: { item: Group }) => {
    const date = group.activity.started_at || group.activity.completed_at;
    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => onActivityPress(group)}
          style={({ pressed }) => [
            styles.cardHeader,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={styles.cardHeaderIcon}>
            <MaterialCommunityIcons
              name={group.kind === 'run' ? 'run-fast' : 'walk'}
              size={18}
              color={group.kind === 'run' ? '#F97316' : '#10B981'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDate}>{formatDate(date)}</Text>
            <Text style={styles.cardSub}>
              {labelForActivity(group)} · {group.photos.length} photo
              {group.photos.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          decelerationRate="fast"
          snapToInterval={STRIP_TILE + STRIP_GAP}
        >
          {group.photos.map((p, idx) => (
            <Pressable
              key={`${p.kind}-${p.id}`}
              onPress={() => onPhotoPress(group, p, idx)}
              style={({ pressed }) => [
                styles.stripTile,
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              {p.photo_data ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${p.photo_data}` }}
                  style={styles.stripImage}
                />
              ) : (
                <View style={[styles.stripImage, styles.tilePlaceholder]} />
              )}
              {p.distance_marker_km != null && p.distance_marker_km > 0 && (
                <View style={styles.markerPill}>
                  <Text style={styles.markerPillText}>
                    {Math.round(p.distance_marker_km * 10) / 10}K
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (!firstLoaded && loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />
        <Header />
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
        <Header />
        <View style={styles.center}>
          <Ionicons name="images-outline" size={56} color={colors.textLight} />
          <Text style={styles.emptyTitle}>Your album is waiting.</Text>
          <Text style={styles.emptyBody}>
            Photos you take on a run or walk land here, grouped by the path
            you took.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />
      <Header />
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#fff" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loading && groups.length > 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : !hasMore && groups.length >= 3 ? (
            <Text style={styles.footerEnd}>That's everything ✦</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Album</Text>
      <Text style={styles.headerSubtitle}>The moments from your paths</Text>
    </View>
  );
}

function groupByActivity(photos: AlbumPhoto[]): Group[] {
  // Preserve insertion order so the most recent activity surfaces first.
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

  // Within the last week → weekday name. Otherwise: day month.
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
  const distance =
    km > 0 ? `${km.toFixed(km < 10 ? 1 : 0)} km ${kind}` : kind;
  return capitalise(distance);
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDate: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cardSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  stripContent: {
    paddingHorizontal: spacing.md,
    gap: STRIP_GAP,
  },
  stripTile: {
    width: STRIP_TILE,
    height: STRIP_TILE,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  stripImage: { width: '100%', height: '100%' },
  tilePlaceholder: { backgroundColor: colors.surfaceAlt },
  markerPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  markerPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
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
