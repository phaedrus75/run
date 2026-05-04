import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Share,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { getToken } from '../services/auth';
import { CircleFeedItem, type FeedItem, type FeedItemPhoto } from '../components/CircleFeedItem';

import { API_BASE_URL } from '../services/config';
const CHECKIN_EMOJIS = ['👋', '🏃', '🌱', '😊', '🍃', '✌️', '🌿', '☀️'];
const SCREEN_WIDTH = Dimensions.get('window').width;

type Tab = 'feed' | 'members' | 'photos';

interface CircleMember {
  user_id: number;
  name: string;
  handle: string | null;
  total_runs: number;
  total_km: number;
  weekly_runs: number;
  weekly_km: number;
  monthly_runs: number;
  monthly_km: number;
  is_you: boolean;
}

type MemberRange = 'week' | 'month';

interface CirclePhoto {
  id: number;
  thumb_data?: string | null;
  photo_data?: string | null;
  is_thumb?: boolean;
  caption: string | null;
  distance_marker_km: number;
  user_name: string;
  run_id?: number | null;
  run_distance: string;
  run_date: string | null;
  created_at: string | null;
}

interface CircleDetails {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  members: CircleMember[];
  milestones: any[];
  checkins: any[];
  my_checkin: any | null;
  created_by: number;
}

// Module-level cache so re-opening a circle is instant. Subsequent focus
// events revalidate in the background while showing the cached scaffold.
type CircleSpaceCacheEntry = {
  feed: FeedItem[];
  details: CircleDetails | null;
  photos: CirclePhoto[];
};
const circleSpaceCache: Map<number, CircleSpaceCacheEntry> = new Map();

export function CircleSpaceScreen({ route, navigation }: any) {
  const { circleId, circleName } = route.params;
  const cached = circleSpaceCache.get(circleId);
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [memberRange, setMemberRange] = useState<MemberRange>('week');
  const [refreshing, setRefreshing] = useState(false);

  const [feed, setFeed] = useState<FeedItem[]>(cached?.feed ?? []);
  const [details, setDetails] = useState<CircleDetails | null>(cached?.details ?? null);
  const [photos, setPhotos] = useState<CirclePhoto[]>(cached?.photos ?? []);
  // Per-section loaders so the screen scaffold (header + tabs) renders
  // immediately and each tab fills in independently.
  const [detailsLoading, setDetailsLoading] = useState(!cached?.details);
  const [feedLoading, setFeedLoading] = useState(!cached);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosFetched, setPhotosFetched] = useState(!!cached);

  const [checkinEmoji, setCheckinEmoji] = useState('👋');
  const [checkinMessage, setCheckinMessage] = useState('');

  const [selectedPhoto, setSelectedPhoto] = useState<CirclePhoto | null>(null);
  const [selectedFull, setSelectedFull] = useState<string | null>(null);

  const authFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    });
  };

  const writeCache = useCallback((patch: Partial<CircleSpaceCacheEntry>) => {
    const prev = circleSpaceCache.get(circleId) ?? { feed: [], details: null, photos: [] };
    circleSpaceCache.set(circleId, { ...prev, ...patch });
  }, [circleId]);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/circles/${circleId}/feed`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
        writeCache({ feed: data });
      }
    } catch (e) {
      console.error('Failed to fetch circle feed:', e);
    } finally {
      setFeedLoading(false);
    }
  }, [circleId, writeCache]);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/circles/${circleId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
        writeCache({ details: data });
      }
    } catch (e) {
      console.error('Failed to fetch circle details:', e);
    } finally {
      setDetailsLoading(false);
    }
  }, [circleId, writeCache]);

  const fetchPhotos = useCallback(async () => {
    setPhotosLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/circles/${circleId}/photos`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
        writeCache({ photos: data });
      }
    } catch (e) {
      console.error('Failed to fetch circle photos:', e);
    } finally {
      setPhotosLoading(false);
      setPhotosFetched(true);
    }
  }, [circleId, writeCache]);

  // Always refresh feed + details on focus (cheap, small payloads).
  // Defer photos until the user actually visits the Photos tab — they're
  // the heaviest payload and most opens never visit that tab.
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
      fetchDetails();
    }, [fetchFeed, fetchDetails])
  );

  // Fetch photos lazily — first time the Photos tab is opened.
  React.useEffect(() => {
    if (activeTab === 'photos' && !photosFetched && !photosLoading) {
      fetchPhotos();
    }
  }, [activeTab, photosFetched, photosLoading, fetchPhotos]);

  // Fetch full-resolution image when the lightbox opens.
  React.useEffect(() => {
    let cancelled = false;
    setSelectedFull(null);
    if (!selectedPhoto) return;
    if (selectedPhoto.photo_data && !selectedPhoto.is_thumb) {
      setSelectedFull(selectedPhoto.photo_data);
      return;
    }
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/circles/${circleId}/photos/${selectedPhoto.id}/full`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSelectedFull(data.photo_data ?? null);
        }
      } catch (e) {
        console.error('Failed to fetch full photo:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPhoto, circleId]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchFeed(), fetchDetails(), fetchPhotos()]).finally(() => setRefreshing(false));
  };

  const handleReact = async (itemType: string, itemId: number, emoji: string) => {
    try {
      await authFetch(`${API_BASE_URL}/circles/${circleId}/feed/${itemType}/${itemId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      const feedRes = await authFetch(`${API_BASE_URL}/circles/${circleId}/feed`);
      if (feedRes.ok) {
        const data = await feedRes.json();
        setFeed(data);
        writeCache({ feed: data });
      }
    } catch (e) {
      console.error('Reaction failed:', e);
    }
  };

  const handleToggleSave = async (runId: number, currentlySaved: boolean) => {
    // Optimistic update so the bookmark feels instant.
    setFeed(prev =>
      prev.map(it =>
        it.type === 'run' && it.id === runId
          ? { ...it, viewer_has_saved: !currentlySaved }
          : it
      )
    );
    try {
      await authFetch(`${API_BASE_URL}/circles/${circleId}/runs/${runId}/save`, {
        method: currentlySaved ? 'DELETE' : 'POST',
      });
    } catch (e) {
      console.error('Save toggle failed:', e);
      // Roll back on failure.
      setFeed(prev =>
        prev.map(it =>
          it.type === 'run' && it.id === runId
            ? { ...it, viewer_has_saved: currentlySaved }
            : it
        )
      );
    }
  };

  // Tapping a photo thumb in the feed opens the same lightbox the Photos
  // tab uses. We reuse the CirclePhoto shape via a synthetic record built
  // from the feed item's photo info; the lightbox will fetch full-res.
  const handleFeedPhotoPress = (p: FeedItemPhoto) => {
    setSelectedPhoto({
      id: p.id,
      thumb_data: p.thumb_data,
      is_thumb: true,
      caption: p.caption,
      distance_marker_km: p.distance_marker_km,
      user_name: '',
      run_distance: '',
      run_date: null,
      created_at: null,
    });
  };

  const handleCheckin = async () => {
    try {
      await authFetch(`${API_BASE_URL}/circles/${circleId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ emoji: checkinEmoji, message: checkinMessage }),
      });
      setCheckinMessage('');
      fetchFeed();
      fetchDetails();
    } catch (e) {
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave Circle', `Are you sure you want to leave "${circleName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await authFetch(`${API_BASE_URL}/circles/${circleId}/leave`, { method: 'DELETE' });
            navigation.goBack();
          } catch { Alert.alert('Error', 'Failed to leave circle'); }
        },
      },
    ]);
  };

  const shareInvite = async () => {
    const code = details?.invite_code || '';
    try {
      await Share.share({ message: `Join my running circle "${circleName}" on ZenRun!\n\nInvite code: ${code}` });
    } catch {}
  };

  const renderFeedTab = () => (
    <View>
      {!details?.my_checkin && (
        <View style={[styles.checkinForm, shadows.small]}>
          <Text style={styles.checkinPrompt}>How's your week going?</Text>
          <View style={styles.emojiPicker}>
            {CHECKIN_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                onPress={() => setCheckinEmoji(e)}
                style={[styles.emojiOption, checkinEmoji === e && styles.emojiOptionActive]}
              >
                <Text style={styles.emojiOptionText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.checkinInputRow}>
            <TextInput
              style={styles.checkinInput}
              placeholder="Share a thought..."
              placeholderTextColor={colors.textLight}
              value={checkinMessage}
              onChangeText={setCheckinMessage}
              maxLength={100}
            />
            <TouchableOpacity style={styles.checkinSend} onPress={handleCheckin}>
              <Ionicons name="send" size={18} color={colors.surface} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {details?.milestones && details.milestones.length > 0 && (
        <View style={styles.milestonesSection}>
          {details.milestones.map((m: any, i: number) => (
            <View key={i} style={[styles.milestoneCard, shadows.small]}>
              <Text style={styles.milestoneIcon}>
                {m.type === 'combined_km' ? '🌿' : m.type === 'all_active' ? '🤝' : '🌳'}
              </Text>
              <Text style={styles.milestoneText}>{m.message}</Text>
            </View>
          ))}
        </View>
      )}

      {feedLoading && feed.length === 0 ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyEmoji}>🌿</Text>
          <Text style={styles.emptyText}>No activity yet. Log a run or check in to get started.</Text>
        </View>
      ) : (
        feed.map(item => (
          <CircleFeedItem
            key={`${item.type}-${item.id}`}
            item={item}
            onReact={handleReact}
            onToggleSave={handleToggleSave}
            onPhotoPress={handleFeedPhotoPress}
          />
        ))
      )}
    </View>
  );

  const renderMembersTab = () => {
    const rangeRuns = (m: CircleMember) =>
      memberRange === 'week' ? m.weekly_runs : m.monthly_runs;
    const rangeKm = (m: CircleMember) =>
      memberRange === 'week' ? m.weekly_km : m.monthly_km;

    // Sort by km in the selected range, descending — leaderboard feel.
    // Ties fall back to name for stable ordering.
    const sortedMembers = [...(details?.members || [])].sort((a, b) => {
      const diff = rangeKm(b) - rangeKm(a);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    return (
      <View>
        <View style={styles.rangeToggle}>
          {(['week', 'month'] as MemberRange[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeOption, memberRange === r && styles.rangeOptionActive]}
              onPress={() => setMemberRange(r)}
            >
              <Text
                style={[
                  styles.rangeOptionText,
                  memberRange === r && styles.rangeOptionTextActive,
                ]}
              >
                {r === 'week' ? 'This week' : 'This month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {sortedMembers.map((member, idx) => {
          const runs = rangeRuns(member);
          const km = rangeKm(member);
          return (
            <View
              key={member.user_id}
              style={[styles.memberRow, member.is_you && styles.memberRowYou]}
            >
              <Text style={styles.memberRank}>{idx + 1}</Text>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name}{member.is_you ? ' (You)' : ''}
                </Text>
                {member.handle && (
                  <Text style={styles.memberHandle}>@{member.handle}</Text>
                )}
              </View>
              <View style={styles.memberStats}>
                <Text style={styles.memberStatPrimary}>
                  {km.toFixed(1)} km
                </Text>
                <Text style={styles.memberStatSecondary}>
                  {runs} run{runs === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          );
        })}

        {details?.invite_code && (
          <View style={[styles.inviteCard, shadows.small]}>
            <Text style={styles.inviteLabel}>Invite Code</Text>
            <Text style={styles.inviteCode}>{details.invite_code}</Text>
            <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
              <Text style={styles.shareButtonText}>Share with friends</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
          <Text style={styles.leaveText}>Leave Circle</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const photoSize = (SCREEN_WIDTH - spacing.lg * 2 - spacing.xs * 2) / 3;

  const renderPhotosTab = () => {
    if (photosLoading && photos.length === 0) {
      return <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xl }} />;
    }
    if (photos.length === 0) {
      return (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyText}>No trail photos yet. Share your scenic runs.</Text>
        </View>
      );
    }
    return (
      <View style={styles.photoGrid}>
        {photos.map(photo => {
          const src = photo.thumb_data || photo.photo_data;
          if (!src) return null;
          return (
            <TouchableOpacity
              key={photo.id}
              style={[styles.photoThumbnail, { width: photoSize, height: photoSize }]}
              onPress={() => setSelectedPhoto(photo)}
            >
              <Image
                source={{ uri: `data:image/jpeg;base64,${src}` }}
                style={styles.photoImage}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{circleName}</Text>
        <TouchableOpacity onPress={shareInvite}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {([
          { key: 'feed' as Tab, label: 'Feed' },
          { key: 'members' as Tab, label: 'Members' },
          { key: 'photos' as Tab, label: 'Trail Album' },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'feed' && renderFeedTab()}
        {activeTab === 'members' && renderMembersTab()}
        {activeTab === 'photos' && renderPhotosTab()}
      </ScrollView>

      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <TouchableOpacity style={styles.photoModalBackdrop} activeOpacity={1} onPress={() => setSelectedPhoto(null)}>
          <View style={styles.photoModalContent}>
            {selectedPhoto && (
              <>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${selectedFull || selectedPhoto.thumb_data || selectedPhoto.photo_data}` }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
                {!selectedFull && (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={styles.photoModalLoader}
                  />
                )}
                <View style={styles.photoModalInfo}>
                  <Text style={styles.photoModalName}>{selectedPhoto.user_name}</Text>
                  <Text style={styles.photoModalDetail}>
                    {selectedPhoto.run_distance} run{selectedPhoto.caption ? ` — ${selectedPhoto.caption}` : ''}
                  </Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.semibold,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  checkinForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  checkinPrompt: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  emojiOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emojiOptionActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emojiOptionText: {
    fontSize: 18,
  },
  checkinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkinInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  checkinSend: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestonesSection: {
    marginBottom: spacing.md,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  milestoneIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  milestoneText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  emptyFeed: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberRowYou: {
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  memberHandle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  ranThisWeek: {
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  ranThisWeekText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  rangeOption: {
    flex: 1,
    paddingVertical: spacing.sm - 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  rangeOptionActive: {
    backgroundColor: colors.primary,
  },
  rangeOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  rangeOptionTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.semibold,
  },
  memberRank: {
    width: 24,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textAlign: 'center',
    marginRight: spacing.xs,
  },
  memberStats: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  memberStatPrimary: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  memberStatSecondary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  inviteLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviteCode: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  shareButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textOnPrimary,
  },
  leaveButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  leaveText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  photoThumbnail: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContent: {
    width: '90%',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '100%',
    height: 350,
    borderRadius: radius.md,
  },
  photoModalLoader: {
    position: 'absolute',
    top: 165,
    alignSelf: 'center',
  },
  photoModalInfo: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  photoModalName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  photoModalDetail: {
    fontSize: typography.sizes.sm,
    color: '#ccc',
    marginTop: spacing.xs,
  },
});
