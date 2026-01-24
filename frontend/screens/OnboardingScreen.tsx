/**
 * 🎓 ONBOARDING SCREEN
 * ====================
 * 
 * Beautiful onboarding flow to introduce users to RunZen.
 * Shows after signup, before entering the main app.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../services/auth';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tips?: string[];
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    emoji: '🏃',
    title: 'Welcome to RunZen',
    description: 'Your personal running companion for tracking runs, setting goals, and crushing your fitness journey.',
    tips: [
      'Track every run with precision',
      'Set and achieve your goals',
      'Watch your progress grow',
    ],
  },
  {
    id: '2',
    emoji: '📝',
    title: 'Log Your Runs',
    description: 'After each run, log your distance and time. Choose from 3K to 21K distances.',
    tips: [
      'Tap "Log a Run" on the home screen',
      'Select your distance (3K, 5K, 10K, etc.)',
      'Enter your time and save!',
    ],
  },
  {
    id: '3',
    emoji: '🎯',
    title: 'Set Your Goals',
    description: 'Stay motivated with yearly and monthly distance goals. We\'ll track your progress automatically.',
    tips: [
      'Default: 1000km/year, 100km/month',
      'Customize in your profile settings',
      'Watch your progress bars fill up!',
    ],
  },
  {
    id: '4',
    emoji: '🏆',
    title: 'Earn Achievements',
    description: 'Unlock badges as you hit milestones. Personal bests trigger confetti celebrations!',
    tips: [
      'First run, streak milestones, distance goals',
      'Beat your best time = 🎊 Confetti!',
      'Track all achievements in Stats',
    ],
  },
  {
    id: '5',
    emoji: '📊',
    title: 'Track Everything',
    description: 'Beyond runs, track your weight journey and high step days. See trends over time.',
    tips: [
      'Log weight to track fitness progress',
      'Record 15K+ step days',
      'View charts and trends in Stats',
    ],
  },
];

interface OnboardingScreenProps {
  navigation: any;
}

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const { refreshUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [yearlyGoal, setYearlyGoal] = useState('1000');
  const [monthlyGoal, setMonthlyGoal] = useState('100');
  const [startWeight, setStartWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowGoalSetup(true);
    }
  };

  const handleSkip = () => {
    setShowGoalSetup(true);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      
      // Save goals (including weight goals)
      await fetch(`${API_BASE_URL}/user/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          yearly_km_goal: parseFloat(yearlyGoal) || 1000,
          monthly_km_goal: parseFloat(monthlyGoal) || 100,
          start_weight_lbs: startWeight ? parseFloat(startWeight) : null,
          goal_weight_lbs: goalWeight ? parseFloat(goalWeight) : null,
        }),
      });
      
      // Mark onboarding complete
      await fetch(`${API_BASE_URL}/user/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      // Refresh user data
      await refreshUser();
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
      
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
      
      {item.tips && (
        <View style={styles.tipsContainer}>
          {item.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {ONBOARDING_SLIDES.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];
        
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });
        
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              { width: dotWidth, opacity },
            ]}
          />
        );
      })}
    </View>
  );

  if (showGoalSetup) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.goalSetupContainer}
        >
          <ScrollView 
            contentContainerStyle={styles.goalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>🎯</Text>
            </View>
            
            <Text style={styles.title}>Set Your Goals</Text>
            <Text style={styles.description}>
              What are your running goals for this year? You can always change these later.
            </Text>
            
            <View style={styles.goalInputContainer}>
              {/* Running Goals */}
              <Text style={styles.sectionLabel}>🏃 Running Goals</Text>
              
              <View style={styles.goalInputRow}>
                <Text style={styles.goalLabel}>Yearly Goal</Text>
                <View style={styles.goalInputWrapper}>
                  <TextInput
                    style={styles.goalInput}
                    value={yearlyGoal}
                    onChangeText={setYearlyGoal}
                    keyboardType="number-pad"
                    placeholder="1000"
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={styles.goalUnit}>km</Text>
                </View>
              </View>
              
              <View style={styles.goalInputRow}>
                <Text style={styles.goalLabel}>Monthly Goal</Text>
                <View style={styles.goalInputWrapper}>
                  <TextInput
                    style={styles.goalInput}
                    value={monthlyGoal}
                    onChangeText={setMonthlyGoal}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={styles.goalUnit}>km</Text>
                </View>
              </View>
              
              {/* Weight Goals */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>⚖️ Weight Tracking (Optional)</Text>
              
              <View style={styles.goalInputRow}>
                <Text style={styles.goalLabel}>Current Weight</Text>
                <View style={styles.goalInputWrapper}>
                  <TextInput
                    style={styles.goalInput}
                    value={startWeight}
                    onChangeText={setStartWeight}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={styles.goalUnit}>lbs</Text>
                </View>
              </View>
              
              <View style={styles.goalInputRow}>
                <Text style={styles.goalLabel}>Goal Weight</Text>
                <View style={styles.goalInputWrapper}>
                  <TextInput
                    style={styles.goalInput}
                    value={goalWeight}
                    onChangeText={setGoalWeight}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={styles.goalUnit}>lbs</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.goalTips}>
              <Text style={styles.goalTipTitle}>💡 Quick Tips:</Text>
              <Text style={styles.goalTipText}>
                • 1000km/year = ~20km/week{'\n'}
                • Start small and adjust as you go{'\n'}
                • Consistency beats intensity!
              </Text>
            </View>
          </ScrollView>
          
          <TouchableOpacity
            style={[styles.completeButton, saving && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={saving}
          >
            <Text style={styles.completeButtonText}>
              {saving ? 'Setting up...' : "Let's Go! 🚀"}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />
      
      {renderDots()}
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Set Goals' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
  slide: {
    width,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  tipsContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    ...shadows.small,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  tipBullet: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    marginRight: spacing.sm,
    fontWeight: typography.weights.bold,
  },
  tipText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    flex: 1,
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: 4,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  nextButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  // Goal Setup Styles
  goalSetupContainer: {
    flex: 1,
  },
  goalScrollContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  goalInputContainer: {
    width: '100%',
    marginTop: spacing.lg,
  },
  goalInputRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  goalLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  goalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInput: {
    flex: 1,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    padding: 0,
  },
  goalUnit: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  goalTips: {
    backgroundColor: colors.primaryLight + '20',
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    marginTop: spacing.lg,
  },
  goalTipTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  goalTipText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  completeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  completeButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
