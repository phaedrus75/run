/**
 * 🎓 ONBOARDING SCREEN
 * ====================
 * 
 * Onboarding that reflects ZenRun's philosophy:
 * 3 focused slides about WHY (not how), then goal setup.
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

const { width } = Dimensions.get('window');

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Run first.\nTrack second.',
    subtitle: 'The ZenRun philosophy',
    body: "Most apps want you to carry your phone, watch your pace, and analyze every step. ZenRun is different. Run however you want — then log it in 10 seconds when you're done.",
    accent: colors.primary,
  },
  {
    id: '2',
    title: 'Consistency\nover speed.',
    subtitle: 'What actually matters',
    body: "We don't care about your splits. We care about your streak. Show up, log the run, build the habit. That's how real progress happens.",
    accent: colors.secondary,
  },
  {
    id: '3',
    title: 'Just enough\ndata.',
    subtitle: 'Progress without noise',
    body: "Distance. Time. Streak. Goals. That's it. No heart rate graphs, no cadence charts, no GPS maps. Just a clean record of your running journey.",
    accent: colors.primary,
  },
];

interface OnboardingScreenProps {
  navigation: any;
}

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const { refreshUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState('');
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
    const cleanHandle = handle.trim().toLowerCase();
    if (!cleanHandle || cleanHandle.length < 3) {
      setHandleError('Handle must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
      setHandleError('Only letters, numbers, and underscores');
      return;
    }
    
    setSaving(true);
    setHandleError('');
    
    try {
      const token = await getToken();
      
      const handleResponse = await fetch(`${API_BASE_URL}/user/handle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ handle: cleanHandle }),
      });
      
      if (!handleResponse.ok) {
        const error = await handleResponse.json();
        setHandleError(error.detail || 'Handle not available');
        setSaving(false);
        return;
      }
      
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
      
      await fetch(`${API_BASE_URL}/user/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      await refreshUser();
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.slideContent}>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <View style={[styles.slideDivider, { backgroundColor: item.accent }]} />
        <Text style={styles.slideBody}>{item.body}</Text>
      </View>
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
          outputRange: [8, 28, 8],
          extrapolate: 'clamp',
        });
        
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.25, 1, 0.25],
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
            <Text style={styles.setupSubtitle}>Almost there</Text>
            <Text style={styles.setupTitle}>Set your baseline</Text>
            <Text style={styles.setupDescription}>
              These keep you accountable. You can always adjust later.
            </Text>
            
            <View style={styles.goalInputContainer}>
              {/* Handle */}
              <Text style={styles.sectionLabel}>Your handle</Text>
              
              <View style={styles.goalInputRow}>
                <View style={styles.goalInputWrapper}>
                  <Text style={styles.handlePrefix}>@</Text>
                  <TextInput
                    style={[styles.goalInput, styles.handleInput]}
                    value={handle}
                    onChangeText={(text) => {
                      setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                      setHandleError('');
                    }}
                    placeholder="yourname"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                </View>
                {handleError ? (
                  <Text style={styles.handleError}>{handleError}</Text>
                ) : (
                  <Text style={styles.handleHint}>This can't be changed later</Text>
                )}
              </View>
              
              {/* Running Goals */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Running goals</Text>
              
              <View style={styles.goalRow}>
                <View style={[styles.goalCard, shadows.small]}>
                  <Text style={styles.goalCardLabel}>Yearly</Text>
                  <View style={styles.goalCardInputRow}>
                    <TextInput
                      style={styles.goalCardInput}
                      value={yearlyGoal}
                      onChangeText={setYearlyGoal}
                      keyboardType="number-pad"
                      placeholder="1000"
                      placeholderTextColor={colors.textLight}
                    />
                    <Text style={styles.goalCardUnit}>km</Text>
                  </View>
                </View>
                
                <View style={[styles.goalCard, shadows.small]}>
                  <Text style={styles.goalCardLabel}>Monthly</Text>
                  <View style={styles.goalCardInputRow}>
                    <TextInput
                      style={styles.goalCardInput}
                      value={monthlyGoal}
                      onChangeText={setMonthlyGoal}
                      keyboardType="number-pad"
                      placeholder="100"
                      placeholderTextColor={colors.textLight}
                    />
                    <Text style={styles.goalCardUnit}>km</Text>
                  </View>
                </View>
              </View>
              
              {/* Weight Goals */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Weight tracking <Text style={styles.optionalTag}>optional</Text></Text>
              
              <View style={styles.goalRow}>
                <View style={[styles.goalCard, shadows.small]}>
                  <Text style={styles.goalCardLabel}>Current</Text>
                  <View style={styles.goalCardInputRow}>
                    <TextInput
                      style={styles.goalCardInput}
                      value={startWeight}
                      onChangeText={setStartWeight}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textLight}
                    />
                    <Text style={styles.goalCardUnit}>lbs</Text>
                  </View>
                </View>
                
                <View style={[styles.goalCard, shadows.small]}>
                  <Text style={styles.goalCardLabel}>Goal</Text>
                  <View style={styles.goalCardInputRow}>
                    <TextInput
                      style={styles.goalCardInput}
                      value={goalWeight}
                      onChangeText={setGoalWeight}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textLight}
                    />
                    <Text style={styles.goalCardUnit}>lbs</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>
                1000 km/year = about 20 km/week.{'\n'}
                Start where you are. Adjust as you go.
              </Text>
            </View>
          </ScrollView>
          
          <TouchableOpacity
            style={[styles.completeButton, saving && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={saving}
          >
            <Text style={styles.completeButtonText}>
              {saving ? 'Setting up...' : "Let's run"}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerBrand}>ZenRun</Text>
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
            {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Set up goals' : 'Next'}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerBrand: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },

  // Slides
  slide: {
    width,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    flex: 1,
  },
  slideContent: {
    paddingBottom: 60,
  },
  slideSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  slideTitle: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
    color: colors.text,
    lineHeight: 44,
    marginBottom: spacing.lg,
  },
  slideDivider: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  slideBody: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 26,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginHorizontal: 3,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  nextButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },

  // Goal Setup
  goalSetupContainer: {
    flex: 1,
  },
  goalScrollContent: {
    padding: spacing.xl,
  },
  setupSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  setupTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  setupDescription: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  goalInputContainer: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  optionalTag: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textLight,
  },
  goalInputRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.small,
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
  handlePrefix: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  handleInput: {
    fontSize: typography.sizes.xl,
  },
  handleError: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  handleHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  goalRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  goalCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginRight: spacing.sm,
  },
  goalCardLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  goalCardInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  goalCardInput: {
    flex: 1,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    padding: 0,
  },
  goalCardUnit: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  tipBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  completeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
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
