/**
 * 📸 ALBUM SCREEN
 * ===============
 *
 * Top-level surface that shows every photo the user has taken on every
 * run and every walk, in one timeline. Mirrors the brand's "the album"
 * pillar — "the path and the album."
 *
 * Cursor-paginated against `GET /me/photos`. Photos are rendered as a
 * 3-column grid; tapping a tile opens the AlbumPhotoDetail screen.
 *
 * Implementation notes:
 *   - We fetch `include_data=true` for now since the backend doesn't yet
 *     have separate thumbnail derivatives. Page size is small (12) to
 *     keep first-paint snappy on cellular. Bumping pagination is the
 *     simplest knob if performance bites.
 *   - Pull-to-refresh resets the cursor. Reaching the bottom auto-loads
 *     the next page.
 *   - Empty state is brand-aligned: "Your album is waiting."
 */

import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { albumApi, AlbumPhoto } from '../services/api';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 3;
const GAP = 4;
const TILE = (SCREEN_W - GAP * (COLS + 1)) / COLS;

const PAGE_SIZE = 12;

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

  const onTilePress = (item: AlbumPhoto) => {
    navigation.navigate('AlbumPhoto', { photo: stripDataForNav(item), index: photos.findIndex((p) => p.id === item.id && p.kind === item.kind) });
  };

  const renderItem = ({ item }: { item: AlbumPhoto }) => (
    <Pressable style={styles.tile} onPress={() => onTilePress(item)}>
      {item.photo_data ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.photo_data}` }}
          style={styles.tileImage}
        />
      ) : (
        <View style={[styles.tileImage, styles.tilePlaceholder]} />
      )}
      <View style={styles.tileBadge}>
        <Ionicons
          name={item.kind === 'run' ? 'fitness' : 'walk'}
          size={11}
          color="#fff"
        />
      </View>
    </Pressable>
  );

  if (!firstLoaded && loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
        <Header />
        <View style={styles.center}>
          <Ionicons name="images-outline" size={56} color={colors.textLight} />
          <Text style={styles.emptyTitle}>Your album is waiting.</Text>
          <Text style={styles.emptyBody}>
            Photos you take on a run or walk land here, one timeline of your
            paths.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#fff" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={photos}
        keyExtractor={(p) => `${p.kind}-${p.id}`}
        numColumns={COLS}
        renderItem={renderItem}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={{ gap: GAP }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loading && photos.length > 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : !hasMore && photos.length >= PAGE_SIZE ? (
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

/** Avoid passing the heavy base64 through the navigation cache (it's
 *  serialised). Detail screen will refetch with full data if needed. */
function stripDataForNav(item: AlbumPhoto): AlbumPhoto {
  return { ...item, photo_data: item.photo_data };
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
  gridContent: {
    paddingHorizontal: GAP,
    paddingTop: GAP,
    paddingBottom: spacing.xl,
    gap: GAP,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  tileImage: { width: '100%', height: '100%' },
  tilePlaceholder: { backgroundColor: colors.surfaceAlt },
  tileBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
