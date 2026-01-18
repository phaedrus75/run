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

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { 
  StatCard, 
  RunHistoryCard, 
  StreakProgress,
  StreakModal,
  PersonalRecords,
  Achievements,
  GoalsProgress as GoalsProgressComponent,
  WeightTracker,
  ProfileModal,
  StepsTracker,
  WeekSummaryCard,
} from '../components';
import { 
  runApi, 
  statsApi, 
  weightApi,
  stepsApi,
  type Run, 
  type Stats, 
  type MotivationalMessage, 
  type WeeklyStreakProgress, 
  type GoalsProgress,
  type PersonalRecords as PersonalRecordsType,
  type AchievementsData,
  type WeightProgress,
  type WeightChartData,
  type StepsSummary,
} from '../services/api';

interface HomeScreenProps {
  navigation: any; // Navigation prop from React Navigation
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  // 🔐 Auth context
  const { user } = useAuth();
  
  // 👤 Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  
  // 🔥 Streak modal state
  const [showStreak, setShowStreak] = useState(false);
  
  // 📊 State for our data
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [motivation, setMotivation] = useState<MotivationalMessage | null>(null);
  const [streakProgress, setStreakProgress] = useState<WeeklyStreakProgress | null>(null);
  const [goals, setGoals] = useState<GoalsProgress | null>(null);
  const [records, setRecords] = useState<PersonalRecordsType | null>(null);
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [weightProgress, setWeightProgress] = useState<WeightProgress | null>(null);
  const [weightChart, setWeightChart] = useState<WeightChartData[]>([]);
  const [stepsSummary, setStepsSummary] = useState<StepsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 📡 Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [statsData, runsData, motivationData, streakData, goalsData, recordsData, achievementsData, weightProgressData, weightChartData, stepsData] = await Promise.all([
        statsApi.get(),
        runApi.getAll({ limit: 3 }),
        statsApi.getMotivation(),
        statsApi.getStreakProgress(),
        statsApi.getGoals(),
        statsApi.getPersonalRecords(),
        statsApi.getAchievements(),
        weightApi.getProgress(),
        weightApi.getChartData(),
        stepsApi.getSummary(),
      ]);
      
      setStats(statsData);
      setRecentRuns(runsData);
      setMotivation(motivationData);
      setStreakProgress(streakData);
      setGoals(goalsData);
      setRecords(recordsData);
      setAchievements(achievementsData);
      setWeightProgress(weightProgressData);
      setWeightChart(weightChartData);
      setStepsSummary(stepsData);
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
        message: "Ready to start your running journey?",
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
  
  // 🔄 Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  // 🎨 Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning! ☀️';
    if (hour < 17) return 'Good afternoon! 🌤️';
    return 'Good evening! 🌙';
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🏃 Loading...</Text>
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
          <Text style={styles.title}>RunZen</Text>
          <View style={styles.headerRight}>
            {/* 🔥 Streak Badge */}
            {streakProgress && (
              <TouchableOpacity 
                style={styles.streakBadge}
                onPress={() => setShowStreak(true)}
              >
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakCount}>{streakProgress.current_streak}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => setShowProfile(true)}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 👋 Greeting */}
        <Text style={styles.greeting}>
          {getGreeting()} {user?.name || 'Runner'}
        </Text>
        
        {/* 📊 Lifetime Stats */}
        <View style={[styles.lifetimeCard, shadows.medium]}>
          <Text style={styles.lifetimeTitle}>📊 Lifetime Stats</Text>
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
              <Text style={styles.lifetimeValue}>{stepsSummary?.all_time?.total_entries || 0}</Text>
              <Text style={styles.lifetimeLabel}>step days</Text>
            </View>
          </View>
        </View>
        
        {/* 📅 This Week / Month */}
        <WeekSummaryCard
          runsThisWeek={stats?.runs_this_week || 0}
          kmThisWeek={stats?.km_this_week || 0}
          motivation={motivation || undefined}
        />
        
        {/* 🚀 Quick Start Button */}
        <TouchableOpacity
          style={[styles.startButton, shadows.medium]}
          onPress={() => navigation.navigate('Run')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>📝 Log a Run</Text>
        </TouchableOpacity>
        
        {/* 🎯 Goals Progress */}
        {goals && (
          <GoalsProgressComponent goals={goals} />
        )}
        
        {/* 👟 Steps Tracker */}
        <StepsTracker 
          summary={stepsSummary}
          onUpdate={fetchData}
        />
        
        {/* ⚖️ Weight Tracker */}
        {weightProgress && (
          <WeightTracker 
            progress={weightProgress} 
            chartData={weightChart}
            onUpdate={fetchData}
          />
        )}
        
        {/* 🏆 Personal Records */}
        {records && (
          <PersonalRecords records={records} />
        )}
        
        {/* 🎖️ Achievements */}
        {achievements && (
          <Achievements data={achievements} />
        )}
        
        {/* 📜 Recent Runs */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Runs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>
          
          {recentRuns.length > 0 ? (
            recentRuns.map(run => (
              <RunHistoryCard key={run.id} run={run} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏃‍♀️</Text>
              <Text style={styles.emptyText}>No runs yet!</Text>
              <Text style={styles.emptySubtext}>
                Tap "Start a Run" to record your first run
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* 👤 Profile Modal */}
      <ProfileModal 
        visible={showProfile} 
        onClose={() => setShowProfile(false)} 
      />
      
      {/* 🔥 Streak Modal */}
      <StreakModal
        visible={showStreak}
        onClose={() => setShowStreak(false)}
        progress={streakProgress}
      />
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
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
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
    width: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight + "40",
    borderRadius: 22,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginLeft: 1,
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
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
});
