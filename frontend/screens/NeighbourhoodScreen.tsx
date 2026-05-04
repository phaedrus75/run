/**
 * The Neighbourhood — city-level feed, saves, and settings.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import {
  neighbourhoodApi,
  type NeighbourhoodFeedItem,
  type NeighbourhoodMe,
  type NeighbourhoodRunDetail,
  type NeighbourhoodSearchHit,
} from '../services/api';
import { WalkMap, type MapMarker } from '../components/WalkMap';
import { decodePolyline, pointAlongRouteAtKm } from '../services/walkLocationTracker';
import { ReactionBar, type ReactionState } from '../components/ReactionBar';
import { REACTIONS, type ReactionId } from '../constants/reactions';

// Map a NeighbourhoodReactionState (counts + viewer flags from backend)
// into the ReactionState[] shape <ReactionBar /> consumes.
function reactionStateFromBackend(s: {
  like_count: number;
  love_count: number;
  zen_count: number;
  viewer_has_liked: boolean;
  viewer_has_loved: boolean;
  viewer_has_zenned: boolean;
}): ReactionState[] {
  const byId: Record<ReactionId, { count: number; reacted: boolean }> = {
    like: { count: s.like_count, reacted: s.viewer_has_liked },
    love: { count: s.love_count, reacted: s.viewer_has_loved },
    zen: { count: s.zen_count, reacted: s.viewer_has_zenned },
  };
  return REACTIONS.map(r => ({
    emoji: r.emoji,
    count: byId[r.id].count,
    reacted: byId[r.id].reacted,
  }));
}

const PURPLE = '#7E57C2';
const WIDEN_OPTIONS = [0, 25, 50, 100] as const;

function thumbUri(data: string | null | undefined): string | null {
  if (!data) return null;
  if (data.startsWith('data:')) return data;
  return `data:image/jpeg;base64,${data}`;
}

interface NeighbourhoodRouteParams {
  openSettings?: boolean;
}

export function NeighbourhoodScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: { params?: NeighbourhoodRouteParams };
}) {
  const [me, setMe] = useState<NeighbourhoodMe | null>(null);
  // Settings used to live as a card at the top of the feed. Now it lives
  // in a sheet you open from the header gear or from the drawer entry.
  // For new users (not yet "ready"), it stays inline — they need to
  // complete setup before there's anything else to show.
  const [settingsOpen, setSettingsOpen] = useState(!!route?.params?.openSettings);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'feed' | 'saved'>('feed');
  const [includeWiden, setIncludeWiden] = useState(false);
  const [feedItems, setFeedItems] = useState<NeighbourhoodFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<{
    published_before: string | null;
    before_run_id: number;
  } | null>(null);
  const nextCursorRef = useRef(nextCursor);
  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<NeighbourhoodSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NeighbourhoodRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Photo currently shown in the detail-modal lightbox (tapped from the
   *  route map or the inline photo list). */
  const [detailLightbox, setDetailLightbox] = useState<
    NeighbourhoodRunDetail['photos'][number] | null
  >(null);

  // Decode + memoise the route polyline and corresponding photo markers
  // for the detail map. Each photo gets pinned to the route point closest
  // to its `distance_marker_km`.
  const detailRoutePoints = useMemo(
    () => (detail?.route_polyline ? decodePolyline(detail.route_polyline) : []),
    [detail?.route_polyline],
  );
  const detailPhotoMarkers = useMemo((): MapMarker[] => {
    if (!detail?.photos?.length || detailRoutePoints.length === 0) return [];
    const out: MapMarker[] = [];
    for (const p of detail.photos) {
      const pt = pointAlongRouteAtKm(detailRoutePoints, p.distance_marker_km);
      if (!pt) continue;
      const km = Math.round(p.distance_marker_km * 10) / 10;
      out.push({
        id: `nb-photo-${p.id}`,
        lat: pt.lat,
        lng: pt.lng,
        title: p.caption ?? `${km} km`,
        tintColor: PURPLE,
      });
    }
    return out;
  }, [detail?.photos, detailRoutePoints]);

  /** Open the lightbox when a photo pin on the map is tapped. */
  const handleDetailMarkerPress = useCallback(
    (markerId: string) => {
      if (!markerId.startsWith('nb-photo-')) return;
      const photoId = Number(markerId.slice('nb-photo-'.length));
      const found = detail?.photos.find((p) => p.id === photoId);
      if (found) setDetailLightbox(found);
    },
    [detail?.photos],
  );

  const ready =
    !!me?.opted_in &&
    !!(me?.home_city || '').trim() &&
    !!me?.handle &&
    me.home_lat != null &&
    me.home_lng != null;

  // Re-open settings if the route param changes (drawer → already-mounted
  // screen). We also clear the param once we've consumed it so a back +
  // re-enter doesn't immediately re-open the sheet.
  useEffect(() => {
    if (route?.params?.openSettings) {
      setSettingsOpen(true);
      navigation.setParams?.({ openSettings: undefined });
    }
  }, [route?.params?.openSettings, navigation]);

  const loadMe = useCallback(async () => {
    try {
      const m = await neighbourhoodApi.getMe();
      setMe(m);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadMe();
    }, [loadMe]),
  );

  const fetchFeedPage = useCallback(
    async (reset: boolean) => {
      if (!ready || tab !== 'feed') return;
      setFeedLoading(true);
      try {
        const cur = reset ? null : nextCursorRef.current;
        const res = await neighbourhoodApi.getFeed({
          limit: 20,
          include_widen: includeWiden,
          published_before: cur?.published_before ?? undefined,
          before_run_id: cur?.before_run_id ?? undefined,
        });
        if (reset) setFeedItems(res.items);
        else setFeedItems((prev) => [...prev, ...res.items]);
        setNextCursor(res.next_cursor);
      } catch (e: any) {
        Alert.alert('Feed', e?.message || 'Could not load neighbourhood feed');
      } finally {
        setFeedLoading(false);
      }
    },
    [ready, tab, includeWiden],
  );

  useEffect(() => {
    if (!ready || tab !== 'feed') return;
    setNextCursor(null);
    nextCursorRef.current = null;
    setFeedItems([]);
    void fetchFeedPage(true);
  }, [ready, tab, includeWiden, fetchFeedPage]);

  const loadSaved = useCallback(async () => {
    if (!ready) return;
    setFeedLoading(true);
    try {
      const res = await neighbourhoodApi.getSaved();
      setFeedItems(res.items);
      setNextCursor(null);
    } catch (e: any) {
      Alert.alert('Saved', e?.message || 'Could not load saved runs');
    } finally {
      setFeedLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    if (ready && tab === 'saved') void loadSaved();
  }, [ready, tab, loadSaved]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadMe().then(() => {
      if (tab === 'feed') {
        setNextCursor(null);
        nextCursorRef.current = null;
        void fetchFeedPage(true);
      } else void loadSaved();
    });
  };

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      neighbourhoodApi
        .searchPlaces(searchQ.trim())
        .then((r) => setSearchHits(r.results || []))
        .catch(() => setSearchHits([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  const applySearchHit = async (hit: NeighbourhoodSearchHit) => {
    try {
      await neighbourhoodApi.patchMe({
        home_city: hit.city,
        home_country: hit.country || undefined,
        home_lat: hit.lat,
        home_lng: hit.lng,
        opted_in: true,
      });
      setSearchQ('');
      setSearchHits([]);
      await loadMe();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save city');
    }
  };

  const useLatestRunLocation = async () => {
    if (me?.latest_run_centroid_lat == null || me?.latest_run_centroid_lng == null) {
      Alert.alert('No GPS run', 'Log an outdoor run with GPS first, or search for your city below.');
      return;
    }
    try {
      const s = await neighbourhoodApi.suggestFromLatLng(
        me.latest_run_centroid_lat,
        me.latest_run_centroid_lng,
      );
      await neighbourhoodApi.patchMe({
        home_city: s.city,
        home_country: s.country || undefined,
        home_lat: s.lat,
        home_lng: s.lng,
        opted_in: true,
      });
      await loadMe();
      Alert.alert('Home city set', `${s.city}${s.country ? `, ${s.country}` : ''}`);
    } catch (e: any) {
      Alert.alert('Geocoding', e?.message || 'Could not resolve city from your last run.');
    }
  };

  // Optimistic toggle on a feed-card reaction. Backend returns the
  // post-toggle state so we patch only the affected row.
  const handleFeedReact = async (item: NeighbourhoodFeedItem, emoji: string) => {
    try {
      const next = await neighbourhoodApi.toggleReaction(item.run_id, emoji);
      setFeedItems((rows) =>
        rows.map((r) =>
          r.run_id === item.run_id
            ? {
                ...r,
                ...next,
                i_ran_this_count: next.love_count,
                viewer_has_run_this: next.viewer_has_loved,
              }
            : r,
        ),
      );
    } catch (err: any) {
      Alert.alert('Reaction', err?.message || 'Failed');
    }
  };

  const handleFeedSave = async (item: NeighbourhoodFeedItem) => {
    const wasSaved = item.viewer_has_saved;
    setFeedItems((rows) =>
      rows.map((r) =>
        r.run_id === item.run_id
          ? {
              ...r,
              viewer_has_saved: !wasSaved,
              saves_count: wasSaved ? r.saves_count - 1 : r.saves_count + 1,
            }
          : r,
      ),
    );
    try {
      if (wasSaved) await neighbourhoodApi.saveRemove(item.run_id);
      else await neighbourhoodApi.saveAdd(item.run_id);
    } catch (err: any) {
      // Roll back.
      setFeedItems((rows) =>
        rows.map((r) =>
          r.run_id === item.run_id
            ? {
                ...r,
                viewer_has_saved: wasSaved,
                saves_count: wasSaved ? r.saves_count + 1 : r.saves_count - 1,
              }
            : r,
        ),
      );
      Alert.alert('Save', err?.message || 'Failed');
    }
  };

  const openDetail = async (runId: number) => {
    setDetailId(runId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await neighbourhoodApi.getRun(runId);
      setDetail(d);
    } catch (e: any) {
      Alert.alert('Run', e?.message || 'Could not open this run');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const patchWiden = async (km: number) => {
    try {
      await neighbourhoodApi.patchMe({ widen_radius_km: km });
      await loadMe();
      if (km === 0) setIncludeWiden(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update');
    }
  };

  const renderFeedCard = ({ item }: { item: NeighbourhoodFeedItem }) => (
    <View style={styles.card}>
      <Pressable onPress={() => void openDetail(item.run_id)}>
      <View style={styles.cardRow}>
        {thumbUri(item.photo_thumb_data) ? (
          <Image source={{ uri: thumbUri(item.photo_thumb_data)! }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={colors.textLight} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.handle}>@{item.handle}</Text>
          <Text style={styles.meta}>
            {item.distance_km?.toFixed(1)} km · {item.saves_count} saves · {item.i_ran_this_count} loves
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </View>
      </Pressable>
      <View style={styles.cardActionsRow}>
        <View style={{ flex: 1 }}>
          <ReactionBar
            reactions={reactionStateFromBackend(item)}
            onToggleReaction={(_id, emoji) => void handleFeedReact(item, emoji)}
            saved={item.viewer_has_saved}
            onToggleSave={() => void handleFeedSave(item)}
          />
        </View>
        <Pressable
          style={styles.reportBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            Alert.alert('Report this run?', 'You will stop seeing posts from this runner in your feed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Report',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await neighbourhoodApi.reportRun(item.run_id);
                    setFeedItems((rows) => rows.filter((r) => r.run_id !== item.run_id));
                  } catch (err: any) {
                    Alert.alert('Report', err?.message || 'Failed');
                  }
                },
              },
            ]);
          }}
        >
          <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const settingsBlock = (
    <View style={styles.settingsCard}>
      <Text style={styles.settingsTitle}>Neighbourhood settings</Text>
      <Text style={styles.settingsHint}>
        Your @{me?.handle || '…'} is shown on shared albums. Profile privacy still applies when someone opens your
        profile.
      </Text>

      <View style={styles.rowBetween}>
        <Text style={styles.rowLabel}>Join the neighbourhood</Text>
        <Switch
          value={!!me?.opted_in}
          onValueChange={async (v) => {
            try {
              if (v && !me?.handle) {
                Alert.alert('Set a handle first', 'Profile → ZenRun handle, then come back.', [
                  { text: 'OK', onPress: () => navigation.getParent()?.navigate('Home', { screen: 'Profile' }) },
                ]);
                return;
              }
              await neighbourhoodApi.patchMe({ opted_in: v });
              await loadMe();
            } catch (e: any) {
              const msg = String(e?.message || '');
              if (msg.includes('HANDLE_REQUIRED')) {
                Alert.alert('Handle required', 'Set your handle on your profile first.');
              } else {
                Alert.alert('Error', msg || 'Could not update');
              }
            }
          }}
        />
      </View>

      <Text style={styles.label}>Search your city</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Lisbon, Portland…"
        placeholderTextColor={colors.textLight}
        value={searchQ}
        onChangeText={setSearchQ}
        autoCapitalize="words"
      />
      {searching ? <ActivityIndicator size="small" color={PURPLE} style={{ marginVertical: 6 }} /> : null}
      {searchHits.length > 0 && (
        <View style={styles.hitList}>
          {searchHits.map((h) => (
            <Pressable key={`${h.lat}-${h.lng}-${h.label}`} style={styles.hitRow} onPress={() => void applySearchHit(h)}>
              <Text style={styles.hitText} numberOfLines={2}>
                {h.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={styles.primaryBtn} onPress={() => void useLatestRunLocation()}>
        <Ionicons name="navigate-outline" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Use my latest run location</Text>
      </Pressable>

      <Text style={styles.label}>Include nearby cities (radius from home)</Text>
      <View style={styles.chipRow}>
        {WIDEN_OPTIONS.map((km) => (
          <Pressable
            key={km}
            style={[styles.chip, (me?.widen_radius_km ?? 0) === km && styles.chipOn]}
            onPress={() => void patchWiden(km)}
          >
            <Text style={[styles.chipText, (me?.widen_radius_km ?? 0) === km && styles.chipTextOn]}>
              {km === 0 ? 'Off' : `${km} km`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>The Neighbourhood</Text>
        {ready ? (
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={PURPLE} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={{ flex: 1 }}>
          {!ready ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <Text style={styles.lede}>
                Discover runs and albums from zenrunners in your city — pseudonymous, no leaderboards on people.
              </Text>
              {settingsBlock}
            </ScrollView>
          ) : (
            <>
              <View style={styles.segment}>
                <Pressable style={[styles.segBtn, tab === 'feed' && styles.segBtnOn]} onPress={() => setTab('feed')}>
                  <Text style={[styles.segText, tab === 'feed' && styles.segTextOn]}>Feed</Text>
                </Pressable>
                <Pressable style={[styles.segBtn, tab === 'saved' && styles.segBtnOn]} onPress={() => setTab('saved')}>
                  <Text style={[styles.segText, tab === 'saved' && styles.segTextOn]}>Saved</Text>
                </Pressable>
              </View>

              {tab === 'feed' && (me?.widen_radius_km ?? 0) > 0 && (
                <View style={styles.widenRow}>
                  <Text style={styles.widenLabel}>Include nearby ({me?.widen_radius_km} km)</Text>
                  <Switch value={includeWiden} onValueChange={setIncludeWiden} />
                </View>
              )}
              {tab === 'feed' && (
                <Text style={styles.showingChip}>
                  Showing {me?.home_city || 'your city'}
                  {includeWiden && (me?.widen_radius_km ?? 0) > 0 ? ' + nearby' : ''}
                </Text>
              )}

              <FlatList
                data={feedItems}
                keyExtractor={(it) => String(it.run_id)}
                renderItem={renderFeedCard}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                  feedLoading ? (
                    <ActivityIndicator color={PURPLE} style={{ marginTop: spacing.lg }} />
                  ) : (
                    <Text style={styles.empty}>Nothing here yet. Check back later or widen nearby cities.</Text>
                  )
                }
                onEndReached={() => {
                  if (tab !== 'feed' || !nextCursorRef.current || feedLoading) return;
                  void fetchFeedPage(false);
                }}
                onEndReachedThreshold={0.3}
              />
            </>
          )}
        </View>
      )}

      <Modal
        visible={settingsOpen && ready}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SafeAreaView style={styles.detailContainer} edges={['top']}>
          <View style={styles.detailHeader}>
            <Pressable onPress={() => setSettingsOpen(false)} hitSlop={10}>
              <Text style={styles.detailClose}>Close</Text>
            </Pressable>
            <Text style={styles.detailTitle}>Settings</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView contentContainerStyle={styles.detailScroll}>
            {settingsBlock}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={detailId != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailId(null)}>
        <SafeAreaView style={styles.detailContainer} edges={['top']}>
          <View style={styles.detailHeader}>
            <Pressable onPress={() => setDetailId(null)} hitSlop={10}>
              <Text style={styles.detailClose}>Close</Text>
            </Pressable>
            <Text style={styles.detailTitle}>Album</Text>
            <View style={{ width: 48 }} />
          </View>
          {detailLoading || !detail ? (
            <ActivityIndicator color={PURPLE} style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView contentContainerStyle={styles.detailScroll}>
              <Text style={styles.handle}>@{detail.handle}</Text>
              <Text style={styles.meta}>
                {detail.distance_km?.toFixed(1)} km · {detail.saves_count} saves · {detail.i_ran_this_count} loves
              </Text>
              {detailRoutePoints.length > 0 ? (
                <View style={styles.detailMap}>
                  <WalkMap
                    style={styles.map}
                    route={detailRoutePoints}
                    markers={
                      detailPhotoMarkers.length ? detailPhotoMarkers : undefined
                    }
                    centerOn={{
                      lat:
                        detailRoutePoints.reduce((s, p) => s + p.lat, 0) /
                        detailRoutePoints.length,
                      lng:
                        detailRoutePoints.reduce((s, p) => s + p.lng, 0) /
                        detailRoutePoints.length,
                    }}
                    zoom={13}
                    showUserLocation={false}
                    routeColor="#F97316"
                    interactive
                    onMarkerPress={handleDetailMarkerPress}
                  />
                </View>
              ) : null}
              {detail.photos?.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.photoBlock}
                  onPress={() => setDetailLightbox(p)}
                >
                  {p.photo_data ? (
                    <Image
                      source={{ uri: p.photo_data.startsWith('data:') ? p.photo_data : `data:image/jpeg;base64,${p.photo_data}` }}
                      style={styles.detailPhoto}
                    />
                  ) : null}
                  {p.caption ? <Text style={styles.caption}>{p.caption}</Text> : null}
                </Pressable>
              ))}
              <View style={styles.detailActions}>
                <ReactionBar
                  reactions={reactionStateFromBackend(detail)}
                  onToggleReaction={async (_id, emoji) => {
                    if (!detail) return;
                    try {
                      const next = await neighbourhoodApi.toggleReaction(detail.run_id, emoji);
                      setDetail({
                        ...detail,
                        ...next,
                        i_ran_this_count: next.love_count,
                        viewer_has_run_this: next.viewer_has_loved,
                      });
                    } catch (e: any) {
                      Alert.alert('Reaction', e?.message);
                    }
                  }}
                  saved={detail.viewer_has_saved}
                  onToggleSave={async () => {
                    if (!detail) return;
                    const wasSaved = detail.viewer_has_saved;
                    setDetail({
                      ...detail,
                      viewer_has_saved: !wasSaved,
                      saves_count: wasSaved ? detail.saves_count - 1 : detail.saves_count + 1,
                    });
                    try {
                      if (wasSaved) await neighbourhoodApi.saveRemove(detail.run_id);
                      else await neighbourhoodApi.saveAdd(detail.run_id);
                    } catch (e: any) {
                      // Roll back on failure.
                      setDetail((d) => (d ? {
                        ...d,
                        viewer_has_saved: wasSaved,
                        saves_count: wasSaved ? d.saves_count + 1 : d.saves_count - 1,
                      } : d));
                      Alert.alert('Save', e?.message);
                    }
                  }}
                />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>

        {/* Lightbox for tapped photos (from the route map or the inline list).
            Nested inside the detail modal so it visually layers above it. */}
        <Modal
          visible={detailLightbox !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setDetailLightbox(null)}
        >
          <Pressable
            style={styles.lightboxOverlay}
            onPress={() => setDetailLightbox(null)}
          >
            {detailLightbox?.photo_data ? (
              <Image
                source={{
                  uri: detailLightbox.photo_data.startsWith('data:')
                    ? detailLightbox.photo_data
                    : `data:image/jpeg;base64,${detailLightbox.photo_data}`,
                }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            ) : null}
            {detailLightbox?.caption ? (
              <Text style={styles.lightboxCaption}>{detailLightbox.caption}</Text>
            ) : null}
          </Pressable>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  lede: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.small,
  },
  settingsTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
  settingsHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowLabel: { fontSize: typography.sizes.sm, color: colors.text, flex: 1, marginRight: spacing.sm },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: typography.sizes.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  hitList: { marginTop: 4, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  hitRow: { padding: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hitText: { fontSize: typography.sizes.sm, color: colors.text },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PURPLE,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: PURPLE + '22', borderColor: PURPLE },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextOn: { color: PURPLE, fontWeight: typography.weights.bold },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  segBtnOn: { backgroundColor: colors.background },
  segText: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  segTextOn: { fontWeight: typography.weights.bold, color: colors.text },
  widenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  widenLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary, flex: 1 },
  showingChip: {
    marginHorizontal: spacing.lg,
    marginTop: 4,
    fontSize: 11,
    color: PURPLE,
    fontWeight: typography.weights.semibold,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.small,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  handle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  detailActions: {
    marginTop: spacing.lg,
  },
  reportBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    alignSelf: 'center',
  },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallBtnText: { fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  detailContainer: { flex: 1, backgroundColor: colors.background },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailClose: { fontSize: typography.sizes.md, color: colors.primary, fontWeight: typography.weights.semibold },
  detailTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
  detailScroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  detailMap: { height: 200, marginVertical: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  map: { flex: 1 },
  detailPhoto: { width: '100%', height: 220, borderRadius: radius.md, marginBottom: spacing.sm, resizeMode: 'cover' },
  photoBlock: { marginBottom: spacing.lg },
  caption: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  lightboxImage: { width: '100%', height: '85%' },
  lightboxCaption: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    color: '#fff',
    textAlign: 'center',
    fontSize: typography.sizes.sm,
  },
});
