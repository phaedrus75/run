/**
 * 🎯 ONBOARDING SCREEN
 * =====================
 * 
 * Multi-step onboarding to set up user goals.
 * Steps: Welcome → Weight Goals → Running Goals → Done
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { getToken } from '../services/auth';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface OnboardingScreenProps {
  onComplete: () => void;
  userName?: string;
}

export default function OnboardingScreen({ onComplete, userName }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Weight goals
  const [startWeight, setStartWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  
  // Running goals
  const [yearlyGoal, setYearlyGoal] = useState('1000');
  const [monthlyGoal, setMonthlyGoal] = useState('100');

  async function saveGoals() {
    setIsLoading(true);
    try {
      const token = await getToken();
      
      // Save goals
      await fetch(`${API_BASE_URL}/user/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_weight_lbs: startWeight ? parseFloat(startWeight) : null,
          goal_weight_lbs: goalWeight ? parseFloat(goalWeight) : null,
          weight_goal_date: '2026-12-31T00:00:00',
          yearly_km_goal: parseFloat(yearlyGoal) || 1000,
          monthly_km_goal: parseFloat(monthlyGoal) || 100,
        }),
      });

      // Mark onboarding complete
      await fetch(`${API_BASE_URL}/user/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      onComplete();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function nextStep() {
    if (step < 3) {
      setStep(step + 1);
    } else {
      saveGoals();
    }
  }

  function prevStep() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  // Step 0: Welcome
  const renderWelcome = () => (
    <View style={styles.stepContent}>
      <Text style={styles.emoji}>🏃</Text>
      <Text style={styles.stepTitle}>
        Welcome{userName ? `, ${userName}` : ''}!
      </Text>
      <Text style={styles.stepDescription}>
        Let's set up your personal goals to help you track your running journey.
      </Text>
      <View style={styles.featureList}>
        <Text style={styles.feature}>📊 Track your runs</Text>
        <Text style={styles.feature}>🎯 Set personalized goals</Text>
        <Text style={styles.feature}>⚖️ Monitor weight progress</Text>
        <Text style={styles.feature}>🏆 Earn achievements</Text>
      </View>
    </View>
  );

  // Step 1: Weight Goals
  const renderWeightGoals = () => (
    <View style={styles.stepContent}>
      <Text style={styles.emoji}>⚖️</Text>
      <Text style={styles.stepTitle}>Weight Goals</Text>
      <Text style={styles.stepDescription}>
        Track your weight loss journey. Leave blank if you don't want to track weight.
      </Text>
      
      <View style={styles.inputRow}>
        <View style={styles.inputHalf}>
          <Text style={styles.label}>Current Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 200"
            placeholderTextColor={colors.textLight}
            value={startWeight}
            onChangeText={setStartWeight}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.inputHalf}>
          <Text style={styles.label}>Goal Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 180"
            placeholderTextColor={colors.textLight}
            value={goalWeight}
            onChangeText={setGoalWeight}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <Text style={styles.hint}>
        💡 Your goal date will be set to end of 2026
      </Text>
    </View>
  );

  // Step 2: Running Goals
  const renderRunningGoals = () => (
    <View style={styles.stepContent}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.stepTitle}>Running Goals</Text>
      <Text style={styles.stepDescription}>
        Set your distance goals to stay motivated throughout the year.
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Yearly Goal (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="1000"
          placeholderTextColor={colors.textLight}
          value={yearlyGoal}
          onChangeText={setYearlyGoal}
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>
          That's about {Math.round(parseFloat(yearlyGoal || '0') / 52)} km per week
        </Text>
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Monthly Goal (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="100"
          placeholderTextColor={colors.textLight}
          value={monthlyGoal}
          onChangeText={setMonthlyGoal}
          keyboardType="numeric"
        />
        <Text style={styles.inputHint}>
          That's about {Math.round(parseFloat(monthlyGoal || '0') / 4)} km per week
        </Text>
      </View>
    </View>
  );

  // Step 3: Ready
  const renderReady = () => (
    <View style={styles.stepContent}>
      <Text style={styles.emoji}>🚀</Text>
      <Text style={styles.stepTitle}>You're All Set!</Text>
      <Text style={styles.stepDescription}>
        Here's a summary of your goals:
      </Text>
      
      <View style={[styles.summaryCard, shadows.small]}>
        {startWeight && goalWeight && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>⚖️ Weight Goal</Text>
            <Text style={styles.summaryValue}>
              {startWeight} → {goalWeight} lbs
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>📅 Yearly Goal</Text>
          <Text style={styles.summaryValue}>{yearlyGoal} km</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>📆 Monthly Goal</Text>
          <Text style={styles.summaryValue}>{monthlyGoal} km</Text>
        </View>
      </View>
      
      <Text style={styles.hint}>
        💡 You can change these anytime in Settings
      </Text>
    </View>
  );

  const steps = [renderWelcome, renderWeightGoals, renderRunningGoals, renderReady];
  const stepTitles = ['Welcome', 'Weight', 'Running', 'Ready'];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {stepTitles.map((title, index) => (
            <View key={index} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  index <= step && styles.progressDotActive,
                ]}
              />
              <Text
                style={[
                  styles.progressLabel,
                  index <= step && styles.progressLabelActive,
                ]}
              >
                {title}
              </Text>
            </View>
          ))}
        </View>

        {/* Step content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {steps[step]()}
        </ScrollView>

        {/* Navigation buttons */}
        <View style={styles.buttonContainer}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={prevStep}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.nextButton, isLoading && styles.buttonDisabled]}
            onPress={nextStep}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === 3 ? "Let's Go! 🏃" : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textLight,
    marginBottom: spacing.xs,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  progressLabelActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  featureList: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  feature: {
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.text,
    textAlign: 'center',
  },
  inputHint: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  summaryLabel: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: colors.surface,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});

