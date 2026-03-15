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
import { CircleFeedItem, type FeedItem } from '../components/CircleFeedItem';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';
const CHECKIN_EMOJIS = ['👋', '🏃', '🌱', '😊', '🍃', '✌️', '🌿', '☀️'];
const SCREEN_WIDTH = Dimensions.get('window').width;

type Tab = 'feed' | 'members' | 'photos';

interface CircleMember {
  user_id: number;
  name: string;
  handle: string | null;
  monthly_runs: number;
  is_you: boolean;
}

interface CirclePhoto {
  id: number;
  photo_data: string;
  caption: string | null;
  distance_marker_km: number;
  user_name: string;
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

export function CircleSpaceScreen({ route, navigation }: any) {
  const { circleId, circleName } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [refreshing, setRefreshing] = useState(false);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [details, setDetails] = useState<CircleDetails | null>(null);
  const [photos, setPhotos] = useState<CirclePhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const [checkinEmoji, setCheckinEmoji] = useState('👋');
  const [checkinMessage, setCheckinMessage] = useState('');

  const [selectedPhoto, setSelectedPhoto] = useState<CirclePhoto | null>(null);

  const authFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    });
  };

  const fetchAll = useCallback(async () => {
    try {
      const [feedRes, detailsRes, photosRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/circles/${circleId}/feed`),
        authFetch(`${API_BASE_URL}/circles/${circleId}`),
        authFetch(`${API_BASE_URL}/circles/${circleId}/photos`),
      ]);
      if (feedRes.ok) setFeed(await feedRes.json());
      if (detailsRes.ok) setDetails(await detailsRes.json());
      if (photosRes.ok) setPhotos(await photosRes.json());
    } catch (e) {
      console.error('Failed to fetch circle data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circleId]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleReact = async (itemType: string, itemId: number, emoji: string) => {
    try {
      await authFetch(`${API_BASE_URL}/circles/${circleId}/feed/${itemType}/${itemId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      const feedRes = await authFetch(`${API_BASE_URL}/circles/${circleId}/feed`);
      if (feedRes.ok) setFeed(await feedRes.json());
    } catch (e) {
      console.error('Reaction failed:', e);
    }
  };

  const handleCheckin = async () => {
    try {
      await authFetch(`${API_BASE_URL}/circles/${circleId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ emoji: checkinEmoji, message: checkinMessage }),
      });
      setCheckinMessage('');
      fetchAll();
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

      {feed.length === 0 && !loading ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyEmoji}>🌿</Text>
          <Text style={styles.emptyText}>No activity yet. Log a run or check in to get started.</Text>
        </View>
      ) : (
        feed.map(item => (
          <CircleFeedItem key={`${item.type}-${item.id}`} item={item} onReact={handleReact} />
        ))
      )}
    </View>
  );

  const renderMembersTab = () => {
    const sortedMembers = [...(details?.members || [])].sort((a, b) => a.name.localeCompare(b.name));
    return (
      <View>
        {sortedMembers.map(member => (
          <View key={member.user_id} style={[styles.memberRow, member.is_you && styles.memberRowYou]}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{member.name[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}{member.is_you ? ' (You)' : ''}</Text>
              {member.handle && <Text style={styles.memberHandle}>@{member.handle}</Text>}
            </View>
            {member.monthly_runs > 0 && (
              <View style={styles.ranThisWeek}>
                <Text style={styles.ranThisWeekText}>ran this month</Text>
              </View>
            )}
          </View>
        ))}

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

  const renderPhotosTab = () => (
    <View>
      {photos.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyText}>No trail photos yet. Share your scenic runs.</Text>
        </View>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map(photo => (
            <TouchableOpacity
              key={photo.id}
              style={[styles.photoThumbnail, { width: photoSize, height: photoSize }]}
              onPress={() => setSelectedPhoto(photo)}
            >
              <Image
                source={{ uri: `data:image/jpeg;base64,${photo.photo_data}` }}
                style={styles.photoImage}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

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
                  source={{ uri: `data:image/jpeg;base64,${selectedPhoto.photo_data}` }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
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
