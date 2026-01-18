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
  MotivationBanner, 
  RunHistoryCard, 
  StreakProgress,
  PersonalRecords,
  Achievements,
  GoalsProgress as GoalsProgressComponent,
  WeightTracker,
  ProfileModal,
} from '../components';
import { 
  runApi, 
  statsApi, 
  weightApi,
  type Run, 
  type Stats, 
  type MotivationalMessage, 
  type WeeklyStreakProgress, 
  type GoalsProgress,
  type PersonalRecords as PersonalRecordsType,
  type AchievementsData,
  type WeightProgress,
  type WeightChartData,
} from '../services/api';

interface HomeScreenProps {
  navigation: any; // Navigation prop from React Navigation
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  // 🔐 Auth context
  const { user } = useAuth();
  
  // 👤 Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  
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
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 📡 Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [statsData, runsData, motivationData, streakData, goalsData, recordsData, achievementsData, weightProgressData, weightChartData] = await Promise.all([
        statsApi.get(),
        runApi.getAll({ limit: 3 }),
        statsApi.getMotivation(),
        statsApi.getStreakProgress(),
        statsApi.getGoals(),
        statsApi.getPersonalRecords(),
        statsApi.getAchievements(),
        weightApi.getProgress(),
        weightApi.getChartData(),
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
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()} {user?.name || 'Runner'}
            </Text>
            <Text style={styles.title}>RunTracker</Text>
          </View>
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
        
        {/* 🎉 Motivation Banner */}
        {motivation && (
          <MotivationBanner
            message={motivation.message}
            emoji={motivation.emoji}
            achievement={motivation.achievement}
          />
        )}
        
        {/* 🔥 Weekly Streak Progress */}
        {streakProgress && (
          <StreakProgress progress={streakProgress} />
        )}
        
        {/* 🚀 Quick Start Button */}
        <TouchableOpacity
          style={[styles.startButton, shadows.medium]}
          onPress={() => navigation.navigate('Run')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>▶️ Start a Run</Text>
        </TouchableOpacity>
        
        {/* ⚖️ Weight Tracker */}
        {weightProgress && (
          <WeightTracker 
            progress={weightProgress} 
            chartData={weightChart}
            onUpdate={fetchData}
          />
        )}
        
        {/* 🎯 Goals Progress */}
        {goals && (
          <GoalsProgressComponent goals={goals} />
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
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  profileButton: {
    padding: spacing.xs,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  title: {
    fontSize: typography.sizes.hero,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.xs,
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
