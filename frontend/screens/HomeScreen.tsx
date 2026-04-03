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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { 
  StatCard, 

  StreakProgress,
  StreakModal,
  PersonalRecords,
  Achievements,
  GoalsProgress as GoalsProgressComponent,
  WeekSummaryCard,
} from '../components';
import { MonthInReview } from '../components/MonthInReview';
import { QuarterInReview } from '../components/QuarterInReview';
import { WeeklyReflection } from '../components/WeeklyReflection';
import { RhythmPlant } from '../components/RhythmPlant';
import { ScenicRunsModal } from './ScenicRunsScreen';
import { 
  statsApi,
  levelApi,
  reflectionsApi,
  type Stats, 
  type MotivationalMessage, 
  type WeeklyStreakProgress, 
  type GoalsProgress,
  type PersonalRecords as PersonalRecordsType,
  type AchievementsData,
  type MonthInReview as MonthInReviewType,
  type DailyWisdom,
  type SeasonalMarker,
  type StreakPeriod,
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
  
  // 🔥 Streak modal state
  const [showStreak, setShowStreak] = useState(false);
  
  // 📸 Scenic runs modal state
  const [showScenicRuns, setShowScenicRuns] = useState(false);
  
  // 📊 State for our data
  const [stats, setStats] = useState<Stats | null>(null);

  const [motivation, setMotivation] = useState<MotivationalMessage | null>(null);
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [goals, setGoals] = useState<GoalsProgress | null>(null);
  const [records, setRecords] = useState<PersonalRecordsType | null>(null);
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [monthReview, setMonthReview] = useState<MonthInReviewType | null>(null);
  const [showMonthReview, setShowMonthReview] = useState(false);
  const [monthBannerVisible, setMonthBannerVisible] = useState(false);
  const monthDismissedRef = useRef(false);
  const [showQuarterReview, setShowQuarterReview] = useState(false);
  const [quarterBannerVisible, setQuarterBannerVisible] = useState(false);
  const quarterDismissedRef = useRef(false);
  const [autoQuarter, setAutoQuarter] = useState<{ q: number; year: number } | null>(null);
  const [dailyWisdom, setDailyWisdom] = useState<DailyWisdom | null>(null);
  const [seasonalMarkers, setSeasonalMarkers] = useState<SeasonalMarker[]>([]);
  const [streakHistory, setStreakHistory] = useState<StreakPeriod[]>([]);
  const [currentReflection, setCurrentReflection] = useState<{ has_reflection: boolean; reflection?: string; mood?: string } | null>(null);
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
      const [statsData, motivationData, streakData, goalsData, recordsData, achievementsData] = await Promise.all([
        statsApi.get(),
        statsApi.getMotivation(),
        statsApi.getStreakProgress(),
        statsApi.getGoals(),
        statsApi.getPersonalRecords(),
        statsApi.getAchievements(),
      ]);
      
      setStats(statsData);
      setMotivation(motivationData);
      setStreakProgress(streakData);
      setGoals(goalsData);
      setRecords(recordsData);
      setAchievements(achievementsData);
      
      // Fetch secondary data (graceful failure)
      try {
        const [monthReviewData, wisdomData, markersData, historyData, levelData, reflectionData] = await Promise.all([
          statsApi.getMonthReview().catch(() => null),
          statsApi.getDailyWisdom().catch(() => null),
          statsApi.getSeasonalMarkers().catch(() => ({ markers: [] })),
          statsApi.getStreakHistory().catch(() => []),
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
        if (monthReviewData && monthReviewData.should_show) {
          setMonthReview(monthReviewData);
          if (!monthDismissedRef.current) {
            setMonthBannerVisible(true);
          }
        }

        const now = new Date();
        const dayOfMonth = now.getDate();
        const month = now.getMonth() + 1;
        if (dayOfMonth <= 7 && [1, 4, 7, 10].includes(month)) {
          const prevQ = month === 1 ? 4 : Math.ceil((month - 1) / 3);
          const prevYear = month === 1 ? now.getFullYear() - 1 : now.getFullYear();
          setAutoQuarter({ q: prevQ, year: prevYear });
          if (!quarterDismissedRef.current) {
            setQuarterBannerVisible(true);
          }
        }

        if (wisdomData) setDailyWisdom(wisdomData);
        setSeasonalMarkers(markersData?.markers || []);
        setStreakHistory(historyData || []);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 👋 Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Image source={require('../assets/logo.png')} style={styles.titleLogo} />
            <Text style={styles.title}>ZenRun</Text>
          </View>
          <View style={styles.headerRight}>
            {/* 🔥 Streak Badge */}
            {streakProgress && (
              <TouchableOpacity 
                style={styles.streakBadge}
                onPress={() => setShowStreak(true)}
              >
                <RhythmPlant weeks={streakProgress.current_streak} size="small" />
                <Text style={styles.streakCount}>{streakProgress.current_streak}w</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
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

        {/* Review Banners */}
        {quarterBannerVisible && autoQuarter && (
          <TouchableOpacity
            style={[styles.reviewBanner, { backgroundColor: '#E8756F' }]}
            onPress={() => setShowQuarterReview(true)}
            activeOpacity={0.85}
          >
            <View style={styles.reviewBannerContent}>
              <Text style={styles.reviewBannerEmoji}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewBannerTitle}>Q{autoQuarter.q} {autoQuarter.year} in Review</Text>
                <Text style={styles.reviewBannerSubtitle}>Tap to see your quarter wrapped</Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={(e) => {
                  e.stopPropagation();
                  quarterDismissedRef.current = true;
                  setQuarterBannerVisible(false);
                }}
              >
                <Ionicons name="close" size={18} color="#ffffffaa" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        {monthBannerVisible && monthReview && (
          <TouchableOpacity
            style={[styles.reviewBanner, { backgroundColor: '#7BAFA6' }]}
            onPress={() => setShowMonthReview(true)}
            activeOpacity={0.85}
          >
            <View style={styles.reviewBannerContent}>
              <Text style={styles.reviewBannerEmoji}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewBannerTitle}>{monthReview.month_name.split(' ')[0]} in Review</Text>
                <Text style={styles.reviewBannerSubtitle}>Tap to see your month wrapped</Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={(e) => {
                  e.stopPropagation();
                  monthDismissedRef.current = true;
                  setMonthBannerVisible(false);
                }}
              >
                <Ionicons name="close" size={18} color="#ffffffaa" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

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
        
        {/* Weekly Reflection */}
        <WeeklyReflection
          weekComplete={streakProgress?.is_complete || false}
          existingReflection={currentReflection}
          onSaved={() => reflectionsApi.getCurrent().then(setCurrentReflection).catch(() => {})}
        />

        {/* Quick Action */}
        <TouchableOpacity
          style={[styles.startButton, shadows.medium]}
          onPress={() => navigation.navigate('Run')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Log a run</Text>
        </TouchableOpacity>
        
        {/* 🎯 Goals Progress */}
        {goals && (
          <GoalsProgressComponent goals={goals} />
        )}
        
        {/* 📸 Scenic Runs */}
        <TouchableOpacity 
          style={[styles.scenicRunsButton, shadows.small]}
          onPress={() => setShowScenicRuns(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.scenicRunsEmoji}>🏞️</Text>
          <View>
            <Text style={styles.scenicRunsTitle}>Scenic Runs</Text>
            <Text style={styles.scenicRunsSubtitle}>Photos from your outdoor runs</Text>
          </View>
        </TouchableOpacity>

        {/* 🏆 Personal Records */}
        {records && (
          <PersonalRecords records={records} />
        )}
        
        {/* 🎖️ Achievements */}
        {achievements && (
          <Achievements data={achievements} />
        )}
        
      </ScrollView>
      
      {/* 📸 Scenic Runs Modal */}
      <ScenicRunsModal
        visible={showScenicRuns}
        onClose={() => setShowScenicRuns(false)}
      />
      
      
      {/* 🔥 Streak Modal */}
      <StreakModal
        visible={showStreak}
        onClose={() => setShowStreak(false)}
        progress={streakProgress}
        streakHistory={streakHistory}
      />
      
      {/* 📅 Month in Review Modal */}
      {showMonthReview && monthReview && (
        <MonthInReview 
          data={monthReview}
          onDismiss={() => setShowMonthReview(false)}
        />
      )}

      {/* 📊 Quarter in Review Modal */}
      {showQuarterReview && autoQuarter && (
        <QuarterInReview
          visible={showQuarterReview}
          quarter={autoQuarter.q}
          year={autoQuarter.year}
          onClose={() => setShowQuarterReview(false)}
        />
      )}
      
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
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
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
  reviewBanner: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewBannerEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  reviewBannerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
  reviewBannerSubtitle: {
    fontSize: typography.sizes.xs,
    color: '#ffffffbb',
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
});
