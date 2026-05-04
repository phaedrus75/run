/**
 * 🏠 HOME SCREEN
 * ===============
 * 
 * The main dashboard showing stats and quick actions.
 * 
 * 🎓 LEARNING NOTES:
 * - This is a "screen" component - it represents a full page
 * - useEffect with [] runs once when component mounts
 * - We fetch data from the API and display it
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import {
  GoalsProgress as GoalsProgressComponent,
  WeekSummaryCard,
  PersonalRecords,
} from '../components';
import { AppHeader } from '../components/AppHeader';
import { WeeklyReflection } from '../components/WeeklyReflection';
import { 
  statsApi,
  levelApi,
  reflectionsApi,
  walkApi,
  albumApi,
  type Stats, 
  type MotivationalMessage, 
  type WeeklyStreakProgress, 
  type GoalsProgress,
  type DailyWisdom,
  type SeasonalMarker,
  type WalkStats,
  type PersonalRecords as PersonalRecordsData,
  type AchievementsData,
  type AlbumPhoto,
} from '../services/api';

interface HomeScreenProps {
  navigation: any; // Navigation prop from React Navigation
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  // 🔐 Auth context
  const { user } = useAuth();
  
  // 🎯 Route params for celebration
  const route = useRoute();
  const { celebrations } = (route.params as { celebrations?: Array<{type: string; title: string; message: string}> }) || {};
  
  // 🎊 Confetti ref
  const confettiRef = useRef<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // 📊 State for our data
  const [stats, setStats] = useState<Stats | null>(null);
  const [walkStats, setWalkStats] = useState<WalkStats | null>(null);

  const [motivation, setMotivation] = useState<MotivationalMessage | null>(null);
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [goals, setGoals] = useState<GoalsProgress | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecordsData | null>(null);
  const [achievementsData, setAchievementsData] = useState<AchievementsData | null>(null);
  const [dailyWisdom, setDailyWisdom] = useState<DailyWisdom | null>(null);
  const [seasonalMarkers, setSeasonalMarkers] = useState<SeasonalMarker[]>([]);
  const [currentReflection, setCurrentReflection] = useState<{ has_reflection: boolean; reflection?: string; mood?: string } | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<AlbumPhoto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Level upgrade state
  const [upgradeInfo, setUpgradeInfo] = useState<{
    eligible: boolean;
    nextLevel: string | null;
    nextLevelName: string;
    nextLevelEmoji: string;
    currentLevelName: string;
    maxDistance: string;
  } | null>(null);
  
  // 📡 Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [statsData, motivationData, streakData, goalsData, prData, achData] = await Promise.all([
        statsApi.get(),
        statsApi.getMotivation(),
        statsApi.getStreakProgress(),
        statsApi.getGoals(),
        statsApi.getPersonalRecords().catch(() => null),
        statsApi.getAchievements().catch(() => null),
      ]);
      
      setStats(statsData);
      setMotivation(motivationData);
      setStreakProgress(streakData);
      setGoals(goalsData);
      setPersonalRecords(prData);
      setAchievementsData(achData);

      // Walk stats are non-critical — fail quietly so the home screen always
      // renders even if the walk endpoints aren't reachable.
      walkApi.getStats().then(setWalkStats).catch(() => setWalkStats(null));

      // Recent scenic photos — small thumbnails, used for the "Recent moments"
      // strip. Backend already returns ~360px thumbs by default so this is light.
      albumApi
        .list({ limit: 6, include_data: true })
        .then((page) => setRecentPhotos(page.items))
        .catch(() => setRecentPhotos([]));
      
      // Fetch secondary data (graceful failure)
      try {
        const [wisdomData, markersData, levelData, reflectionData] = await Promise.all([
          statsApi.getDailyWisdom().catch(() => null),
          statsApi.getSeasonalMarkers().catch(() => ({ markers: [] })),
          levelApi.get().catch(() => null),
          reflectionsApi.getCurrent().catch(() => null),
        ]);
        
        if (levelData?.upgrade_eligible && levelData.next_level) {
          const LEVEL_META: Record<string, { name: string; emoji: string }> = {
            breath: { name: 'Breath', emoji: '🌱' },
            stride: { name: 'Stride', emoji: '🏃' },
            flow: { name: 'Flow', emoji: '🌊' },
            zen: { name: 'Zen', emoji: '🧘' },
          };
          const next = LEVEL_META[levelData.next_level] || { name: levelData.next_level, emoji: '⬆️' };
          const current = LEVEL_META[levelData.level] || { name: levelData.level, emoji: '' };
          setUpgradeInfo({
            eligible: true,
            nextLevel: levelData.next_level,
            nextLevelName: next.name,
            nextLevelEmoji: next.emoji,
            currentLevelName: current.name,
            maxDistance: levelData.level === 'breath' ? '5K' : levelData.level === 'stride' ? '10K' : '21K',
          });
        } else {
          setUpgradeInfo(null);
        }
        if (wisdomData) setDailyWisdom(wisdomData);
        setSeasonalMarkers(markersData?.markers || []);
        if (reflectionData) setCurrentReflection(reflectionData);
      } catch (e) {
        console.log('Secondary data fetch partial failure');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // For demo purposes, show mock data if API is unavailable
      setStats({
        total_runs: 0,
        total_km: 0,
        total_duration_seconds: 0,
        current_streak: 0,
        longest_streak: 0,
        average_pace: '0:00',
        runs_this_week: 0,
        km_this_week: 0,
        runs_this_month: 0,
        km_this_month: 0,
      });
      setMotivation({
        message: "Your running journey starts here.",
        emoji: "🏃",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // 🎬 Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // 🔄 Refetch when screen comes into focus (e.g., after deleting a run)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  // 🎊 Trigger confetti for celebrations
  useEffect(() => {
    if (celebrations && celebrations.length > 0) {
      setShowConfetti(true);
      // Clear the params so confetti doesn't show again on re-render
      navigation.setParams({ celebrations: undefined });
    }
  }, [celebrations, navigation]);
  
  // 🔄 Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Early riser';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>ZenRun</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text style={styles.greeting}>
          {getGreeting()}, {user?.name || 'Runner'}
        </Text>
        
        {/* Daily Wisdom */}
        {dailyWisdom && (
          <View style={styles.wisdomCard}>
            <Text style={styles.wisdomText}>"{dailyWisdom.text}"</Text>
            <Text style={styles.wisdomAuthor}>— {dailyWisdom.author}</Text>
          </View>
        )}

        {/* Level Upgrade Banner */}
        {upgradeInfo?.eligible && upgradeInfo.nextLevel && (
          <TouchableOpacity
            style={[styles.upgradeBanner, shadows.small]}
            onPress={async () => {
              try {
                await levelApi.set(upgradeInfo.nextLevel!);
                Alert.alert(
                  `${upgradeInfo.nextLevelEmoji} Your path deepens`,
                  `You've grown into ${upgradeInfo.nextLevelName}. New distances await you.`
                );
                setUpgradeInfo(null);
                fetchData();
              } catch {
                Alert.alert('Error', 'Failed to upgrade level');
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeEmoji}>{upgradeInfo.nextLevelEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>Your practice is deepening</Text>
              <Text style={styles.upgradeText}>
                You've been running {upgradeInfo.maxDistance} every week for a month. {upgradeInfo.nextLevelName} distances are calling.
              </Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Comeback / Rest Banner */}
        {streakProgress?.is_comeback && (
          <View style={[styles.comebackBanner, shadows.small]}>
            <Text style={styles.comebackEmoji}>👋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.comebackTitle}>Welcome back.</Text>
              <Text style={styles.comebackText}>Your rhythm starts fresh. Good to see you.</Text>
            </View>
          </View>
        )}
        {streakProgress?.missed_last_week && !streakProgress?.is_comeback && streakProgress?.current_streak === 0 && (
          <View style={[styles.restBanner, shadows.small]}>
            <Text style={styles.comebackEmoji}>🌿</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.restText}>You took a breather last week. Your body rebuilds during rest.</Text>
            </View>
          </View>
        )}

        {/* 🖼️ Recent moments — newest scenic photos with link to Album */}
        {recentPhotos.length > 0 && (
          <View style={styles.momentsCard}>
            <View style={styles.momentsHeader}>
              <Text style={styles.momentsTitle}>Recent moments</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  navigation.navigate('Album', { screen: 'AlbumGrid' })
                }
              >
                <Text style={styles.momentsSeeAll}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.momentsRow}
            >
              {recentPhotos.map((photo, idx) => {
                const samePhotos = recentPhotos.filter(
                  (p) =>
                    p.kind === photo.kind && p.activity_id === photo.activity_id,
                );
                const startIndex = samePhotos.findIndex(
                  (p) => p.id === photo.id,
                );
                return (
                  <Pressable
                    key={`${photo.kind}-${photo.id}`}
                    style={[
                      styles.momentTile,
                      idx === recentPhotos.length - 1 && { marginRight: 0 },
                    ]}
                    onPress={() =>
                      navigation.navigate('Album', {
                        screen: 'AlbumPhoto',
                        params: {
                          photo,
                          groupPhotos: samePhotos,
                          index: Math.max(0, startIndex),
                        },
                      })
                    }
                  >
                    {photo.photo_data ? (
                      <Image
                        source={{
                          uri: `data:image/jpeg;base64,${photo.photo_data}`,
                        }}
                        style={styles.momentImage}
                      />
                    ) : (
                      <View style={[styles.momentImage, styles.momentImagePlaceholder]}>
                        <Ionicons
                          name="image-outline"
                          size={22}
                          color={colors.textLight}
                        />
                      </View>
                    )}
                    <View style={styles.momentBadge}>
                      <MaterialCommunityIcons
                        name={photo.kind === 'run' ? 'run-fast' : 'walk'}
                        size={12}
                        color="#fff"
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        
        {/* Overall Stats */}
        <View style={[styles.lifetimeCard, shadows.medium]}>
          <Text style={styles.lifetimeTitle}>Your journey</Text>
          <View style={styles.lifetimeRow}>
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{stats?.total_runs || 0}</Text>
              <Text style={styles.lifetimeLabel}>runs</Text>
            </View>
            <View style={styles.lifetimeDivider} />
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{stats?.total_km?.toFixed(0) || 0}</Text>
              <Text style={styles.lifetimeLabel}>km</Text>
            </View>
            <View style={styles.lifetimeDivider} />
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{Math.floor((stats?.total_duration_seconds || 0) / 3600)}</Text>
              <Text style={styles.lifetimeLabel}>hours</Text>
            </View>
          </View>

          {walkStats && walkStats.total_walks > 0 && (
            <View style={styles.combinedRow}>
              <Text style={styles.combinedLabel}>Plus walking</Text>
              <Text style={styles.combinedValue}>
                {walkStats.total_walks} walks · {walkStats.total_km.toFixed(1)} km
              </Text>
            </View>
          )}
          
          {/* Motivation Banner */}
          {motivation && (
            <View style={styles.motivationBanner}>
              <Text style={styles.motivationEmoji}>{motivation.emoji}</Text>
              <Text style={styles.motivationText}>{motivation.message}</Text>
            </View>
          )}
        </View>
        
        {/* 📅 This Week / Month */}
        <WeekSummaryCard
          runsThisWeek={stats?.runs_this_week || 0}
          kmThisWeek={stats?.km_this_week || 0}
        />

        {/* Seasonal Markers */}
        {seasonalMarkers.length > 0 && (
          <View style={styles.seasonalCard}>
            {seasonalMarkers.map((marker, i) => (
              <View key={i} style={styles.seasonalRow}>
                <Text style={styles.seasonalEmoji}>{marker.emoji}</Text>
                <Text style={styles.seasonalText}>{marker.message}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Weekly Reflection */}
        <WeeklyReflection
          weekComplete={streakProgress?.is_complete || false}
          existingReflection={currentReflection}
          onSaved={() => reflectionsApi.getCurrent().then(setCurrentReflection).catch(() => {})}
        />

        {/* 🎯 Goals Progress */}
        {goals && (
          <GoalsProgressComponent goals={goals} />
        )}

        {personalRecords && <PersonalRecords records={personalRecords} />}

        {/* 🏅 Recent milestones — the 6 most-recently unlocked badges.
            Backed by user_achievements.unlocked_at (recorded on every
            locked → unlocked transition). Existing rows that pre-date
            this feature are stamped lazily on the first GET /achievements
            after deploy, so the order is approximate for legacy unlocks
            but exact for everything earned after. */}
        {achievementsData && achievementsData.unlocked_count > 0 && (
          <View style={styles.momentsCard}>
            <View style={styles.momentsHeader}>
              <Text style={styles.momentsTitle}>Recent milestones</Text>
              <View style={styles.milestonesHeaderRight}>
                <Text style={styles.milestonesCount}>
                  {achievementsData.unlocked_count} earned
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => navigation.navigate('Honors')}
                >
                  <Text style={styles.momentsSeeAll}>See all</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.momentsRow}
            >
              {[...achievementsData.unlocked]
                .sort((a, b) => {
                  const ta = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
                  const tb = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
                  return tb - ta;
                })
                .slice(0, 6)
                .map((a, idx, arr) => (
                  <Pressable
                    key={a.id}
                    onPress={() => navigation.navigate('Honors')}
                    style={[
                      styles.milestoneTile,
                      idx === arr.length - 1 && { marginRight: 0 },
                    ]}
                  >
                    <Text style={styles.milestoneEmoji}>{a.emoji}</Text>
                    <Text
                      style={styles.milestoneName}
                      numberOfLines={2}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>
      
      {/* 🎊 Confetti for Personal Bests! */}
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: Dimensions.get('window').width / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
          explosionSpeed={350}
          colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
          onAnimationEnd={() => setShowConfetti(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakCount: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: -4,
  },
  profileButton: {
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  greeting: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.sm,
  },
  lifetimeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  lifetimeTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  lifetimeStat: {
    alignItems: 'center',
    flex: 1,
  },
  lifetimeValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  lifetimeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lifetimeDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.background,
  },
  combinedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  combinedLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  combinedValue: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  motivationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  motivationEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  motivationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  recentSection: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  wisdomCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  wisdomText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  wisdomAuthor: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary + '15',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
    gap: spacing.md,
  },
  upgradeEmoji: {
    fontSize: 28,
  },
  upgradeTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  upgradeText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  comebackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  comebackEmoji: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  comebackTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  comebackText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  restBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  restText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  seasonalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  seasonalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  seasonalEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  seasonalText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  scenicRunsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  scenicRunsEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  scenicRunsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scenicRunsSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  momentsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  momentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  momentsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  momentsSeeAll: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  momentsRow: {
    paddingHorizontal: spacing.md,
  },
  momentTile: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  momentImage: {
    width: '100%',
    height: '100%',
  },
  momentImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  milestonesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  milestonesCount: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontWeight: typography.weights.medium,
  },
  milestoneTile: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  milestoneEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  milestoneName: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
});
