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
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../services/auth';
import { levelApi } from '../services/api';

const { width } = Dimensions.get('window');
import { API_BASE_URL } from '../services/config';

const LEVEL_GOAL_DEFAULTS: Record<string, { yearly: string; monthly: string }> = {
  breath: { yearly: '250', monthly: '20' },
  stride: { yearly: '500', monthly: '40' },
  flow:   { yearly: '1000', monthly: '80' },
};

const LEVELS = [
  {
    key: 'breath',
    name: 'Breath',
    tagline: 'Every journey begins with a single breath',
    distances: '1K  ·  2K  ·  3K  ·  5K',
    description: 'Perfect for getting started or getting back into running.',
    color: colors.secondary,
    emoji: '🌱',
  },
  {
    key: 'stride',
    name: 'Stride',
    tagline: "You've found your stride",
    distances: '2K  ·  3K  ·  5K  ·  8K  ·  10K',
    description: "You run regularly and want to push a little further.",
    color: colors.primary,
    emoji: '🏃',
  },
  {
    key: 'flow',
    name: 'Flow',
    tagline: 'Running in flow',
    distances: '3K  ·  5K  ·  8K  ·  10K  ·  15K  ·  18K  ·  21K',
    description: 'Seasoned runner. From casual 3Ks to half marathons.',
    color: '#6C5CE7',
    emoji: '🌊',
  },
];

// --- Slide data ---

type SlideIcon = { name: string; color: string };

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  icon?: SlideIcon;
  visual?: 'logging' | 'rhythm' | 'circles';
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  // Philosophy
  {
    id: '1',
    title: 'Run first.\nTrack second.',
    subtitle: 'The ZenRun philosophy',
    body: "Most apps want you to carry your phone, watch your pace, and analyze every step. ZenRun is different. Run however you want — then log it in 2 seconds when you're back.",
    accent: colors.primary,
  },
  {
    id: '2',
    title: 'Find your\nrhythm.',
    subtitle: 'Consistency over perfection',
    body: "Run at least twice a week. That's your rhythm. Keep it going and watch it grow — 66 days of consistency turns running into a habit that stays.",
    accent: colors.secondary,
  },
  // Feature showcase
  {
    id: '3',
    title: 'Log in\n2 seconds.',
    subtitle: 'Quick logging',
    body: "Pick your distance, hit start, run. When you're done, tap stop. That's it — no GPS, no phone in your pocket, no fuss.",
    accent: colors.primary,
    icon: { name: 'timer-outline', color: colors.primary },
    visual: 'logging',
  },
  {
    id: '4',
    title: 'Rhythm &\nmilestones.',
    subtitle: 'Quiet celebrations',
    body: "Your rhythm grows each week you show up. Hit milestones along the way — 100 of them — without the pressure of daily streaks.",
    accent: colors.secondary,
    icon: { name: 'flame-outline', color: colors.secondary },
    visual: 'rhythm',
  },
  {
    id: '5',
    title: 'Run with\nyour circle.',
    subtitle: 'Friendly accountability',
    body: "Create a circle with up to 10 friends. See who's running, cheer each other on, and keep each other accountable — no leaderboards, just showing up together.",
    accent: colors.primary,
    icon: { name: 'people-outline', color: colors.primary },
    visual: 'circles',
  },
];

// --- Phases ---

type Phase = 'slides' | 'level' | 'goals' | 'beta' | 'handle' | 'verify';

interface OnboardingScreenProps {
  navigation: any;
}

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const { refreshUser } = useAuth();

  const [phase, setPhase] = useState<Phase>('slides');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Level
  const [selectedLevel, setSelectedLevel] = useState<string>('breath');

  // Goals
  const [yearlyGoal, setYearlyGoal] = useState('250');
  const [monthlyGoal, setMonthlyGoal] = useState('20');

  // Beta
  const [betaSteps, setBetaSteps] = useState(false);
  const [betaWeight, setBetaWeight] = useState(false);

  // Handle
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState('');
  const [saving, setSaving] = useState(false);

  // Verify
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // --- Navigation helpers ---

  const handleSlideNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      setPhase('level');
    }
  };

  const handleSkipSlides = () => setPhase('level');

  const handleLevelContinue = () => setPhase('goals');

  const handleGoalsContinue = () => setPhase('beta');

  const handleBetaContinue = () => setPhase('handle');

  const handleHandleContinue = async () => {
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

      // 1. Set handle
      const handleRes = await fetch(`${API_BASE_URL}/user/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle: cleanHandle }),
      });
      if (!handleRes.ok) {
        const err = await handleRes.json();
        setHandleError(err.detail || 'Handle not available');
        setSaving(false);
        return;
      }

      // 2. Set goals
      await fetch(`${API_BASE_URL}/user/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          yearly_km_goal: parseFloat(yearlyGoal) || parseFloat(LEVEL_GOAL_DEFAULTS[selectedLevel]?.yearly || '250'),
          monthly_km_goal: parseFloat(monthlyGoal) || parseFloat(LEVEL_GOAL_DEFAULTS[selectedLevel]?.monthly || '20'),
        }),
      });

      // 3. Set level
      await levelApi.set(selectedLevel);

      // 4. Set beta preferences
      await fetch(`${API_BASE_URL}/user/beta-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ steps_enabled: betaSteps, weight_enabled: betaWeight }),
      });

      setPhase('verify');
    } catch (error) {
      setHandleError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setResendSuccess(false);
    setVerifyError('');
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/auth/send-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch {
      setVerifyError('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyComplete = async () => {
    const code = verifyCode.trim();
    if (code.length !== 6) {
      setVerifyError('Enter the 6-digit code from your email');
      return;
    }

    setVerifying(true);
    setVerifyError('');

    try {
      const token = await getToken();

      const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setVerifyError(err.detail || 'Invalid code. Please try again.');
        setVerifying(false);
        return;
      }

      // Complete onboarding
      await fetch(`${API_BASE_URL}/user/complete-onboarding`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshUser();
    } catch {
      setVerifyError('Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // --- Feature visual mini-illustrations ---

  const renderFeatureVisual = (visual?: string) => {
    if (visual === 'logging') {
      return (
        <View style={s.featureVisual}>
          <View style={s.fvRow}>
            {['3K', '5K', '10K'].map(d => (
              <View key={d} style={[s.fvChip, d === '5K' && s.fvChipActive]}>
                <Text style={[s.fvChipText, d === '5K' && s.fvChipTextActive]}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={s.fvTimerBox}>
            <Text style={s.fvTimer}>12:34</Text>
            <Text style={s.fvTimerLabel}>tap to start</Text>
          </View>
        </View>
      );
    }
    if (visual === 'rhythm') {
      return (
        <View style={s.featureVisual}>
          <View style={s.fvRow}>
            {[4, 5, 6, 7, 8].map(w => (
              <View key={w} style={s.fvWeekCol}>
                <View style={[s.fvBar, { height: w * 6 }]} />
                <Text style={s.fvWeekLabel}>W{w}</Text>
              </View>
            ))}
          </View>
          <View style={s.fvBadgeRow}>
            <View style={s.fvBadge}><Text style={s.fvBadgeText}>10 runs</Text></View>
            <View style={s.fvBadge}><Text style={s.fvBadgeText}>50 km</Text></View>
          </View>
        </View>
      );
    }
    if (visual === 'circles') {
      return (
        <View style={s.featureVisual}>
          <View style={s.fvAvatarRow}>
            {['A', 'M', 'S', 'R'].map((letter, i) => (
              <View key={i} style={[s.fvAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                <Text style={s.fvAvatarText}>{letter}</Text>
              </View>
            ))}
          </View>
          <Text style={s.fvCircleLabel}>Weekend Warriors</Text>
        </View>
      );
    }
    return null;
  };

  // ====================================
  //  PHASE: SLIDES
  // ====================================

  if (phase === 'slides') {
    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
      <View style={s.slide}>
        <View style={s.slideContent}>
          {item.icon && (
            <View style={[s.slideIconWrap, { backgroundColor: item.icon.color + '15' }]}>
              <Ionicons name={item.icon.name as any} size={28} color={item.icon.color} />
            </View>
          )}
          <Text style={s.slideSubtitle}>{item.subtitle}</Text>
          <Text style={s.slideTitle}>{item.title}</Text>
          <View style={[s.slideDivider, { backgroundColor: item.accent }]} />
          <Text style={s.slideBody}>{item.body}</Text>
          {renderFeatureVisual(item.visual)}
        </View>
      </View>
    );

    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <View style={s.headerBrandRow}>
            <Image source={require('../assets/logo.png')} style={s.headerLogo} />
            <Text style={s.headerBrand}>ZenRun</Text>
          </View>
          <TouchableOpacity onPress={handleSkipSlides} style={s.skipButton}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={ONBOARDING_SLIDES}
          renderItem={renderSlide}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          onMomentumScrollEnd={e => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          scrollEventThrottle={16}
        />

        {/* Dots */}
        <View style={s.dotsContainer}>
          {ONBOARDING_SLIDES.map((_, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 28, 8], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
            return <Animated.View key={index} style={[s.dot, { width: dotWidth, opacity }]} />;
          })}
        </View>

        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleSlideNext}>
            <Text style={s.primaryBtnText}>
              {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Get started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ====================================
  //  PHASE: LEVEL PICKER
  // ====================================

  if (phase === 'level') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.phaseSubtitle}>Your running journey</Text>
          <Text style={s.phaseTitle}>Where are you today?</Text>
          <Text style={s.phaseDesc}>
            Pick what feels right. This sets your default distances and goals. You can always change it later.
          </Text>

          {LEVELS.map(level => {
            const isSelected = selectedLevel === level.key;
            return (
              <TouchableOpacity
                key={level.key}
                style={[
                  s.levelCard,
                  isSelected && { borderColor: level.color, borderWidth: 2 },
                  !isSelected && { borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={() => {
                  setSelectedLevel(level.key);
                  const defaults = LEVEL_GOAL_DEFAULTS[level.key];
                  if (defaults) { setYearlyGoal(defaults.yearly); setMonthlyGoal(defaults.monthly); }
                }}
                activeOpacity={0.7}
              >
                <View style={s.levelCardHeader}>
                  <Text style={s.levelEmoji}>{level.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.levelName}>{level.name}</Text>
                    <Text style={s.levelTagline}>{level.tagline}</Text>
                  </View>
                  <View style={[s.levelRadio, isSelected && { backgroundColor: level.color, borderColor: level.color }]}>
                    {isSelected && <View style={s.levelRadioInner} />}
                  </View>
                </View>
                <Text style={s.levelDistances}>{level.distances}</Text>
                <Text style={s.levelDescription}>{level.description}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={s.primaryBtn} onPress={handleLevelContinue}>
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ====================================
  //  PHASE: GOAL SETUP
  // ====================================

  if (phase === 'goals') {
    const levelName = LEVELS.find(l => l.key === selectedLevel)?.name || selectedLevel;
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={s.phaseSubtitle}>Running goals</Text>
            <Text style={s.phaseTitle}>Set your targets</Text>
            <Text style={s.phaseDesc}>
              These keep you accountable. You can adjust anytime in Profile.
            </Text>

            <View style={s.recommendedBanner}>
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              <Text style={s.recommendedText}>
                Recommended for {levelName}: {LEVEL_GOAL_DEFAULTS[selectedLevel]?.yearly} km/year, {LEVEL_GOAL_DEFAULTS[selectedLevel]?.monthly} km/month
              </Text>
            </View>

            <Text style={s.sectionLabel}>Running goals</Text>
            <View style={s.goalRow}>
              <View style={[s.goalCard, shadows.small]}>
                <Text style={s.goalCardLabel}>Yearly</Text>
                <View style={s.goalCardInputRow}>
                  <TextInput
                    style={s.goalCardInput}
                    value={yearlyGoal}
                    onChangeText={setYearlyGoal}
                    keyboardType="number-pad"
                    placeholder={LEVEL_GOAL_DEFAULTS[selectedLevel]?.yearly || '250'}
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={s.goalCardUnit}>km</Text>
                </View>
              </View>
              <View style={[s.goalCard, shadows.small]}>
                <Text style={s.goalCardLabel}>Monthly</Text>
                <View style={s.goalCardInputRow}>
                  <TextInput
                    style={s.goalCardInput}
                    value={monthlyGoal}
                    onChangeText={setMonthlyGoal}
                    keyboardType="number-pad"
                    placeholder={LEVEL_GOAL_DEFAULTS[selectedLevel]?.monthly || '20'}
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={s.goalCardUnit}>km</Text>
                </View>
              </View>
            </View>

            <View style={s.tipBox}>
              <Text style={s.tipText}>
                1000 km/year = about 20 km/week.{'\n'}
                Start where you are. Adjust as you go.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={s.primaryBtn} onPress={handleGoalsContinue}>
            <Text style={s.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ====================================
  //  PHASE: BETA OPT-IN
  // ====================================

  if (phase === 'beta') {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[s.slideIconWrap, { backgroundColor: colors.primary + '15', alignSelf: 'flex-start' }]}>
            <Ionicons name="flask-outline" size={28} color={colors.primary} />
          </View>
          <Text style={s.phaseSubtitle}>Experimental</Text>
          <Text style={s.phaseTitle}>Try beta features</Text>
          <Text style={s.phaseDesc}>
            These are optional extras we're still refining. You can turn them on or off anytime in Profile.
          </Text>

          <View style={s.betaCard}>
            <View style={s.betaCardLeft}>
              <View style={[s.betaIcon, { backgroundColor: colors.secondary + '15' }]}>
                <Ionicons name="footsteps-outline" size={22} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.betaTitle}>High Step Days</Text>
                <Text style={s.betaDesc}>Track your daily step count and celebrate big step days</Text>
              </View>
            </View>
            <Switch
              value={betaSteps}
              onValueChange={setBetaSteps}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor="#fff"
            />
          </View>

          <View style={s.betaCard}>
            <View style={s.betaCardLeft}>
              <View style={[s.betaIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="scale-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.betaTitle}>Weight Tracking</Text>
                <Text style={s.betaDesc}>Log your weight and track trends over time</Text>
              </View>
            </View>
            <Switch
              value={betaWeight}
              onValueChange={setBetaWeight}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={s.primaryBtn} onPress={handleBetaContinue}>
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ====================================
  //  PHASE: VERIFY EMAIL
  // ====================================

  if (phase === 'verify') {
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[s.slideIconWrap, { backgroundColor: colors.secondary + '15', alignSelf: 'flex-start' }]}>
              <Ionicons name="mail-outline" size={28} color={colors.secondary} />
            </View>
            <Text style={s.phaseSubtitle}>One last step</Text>
            <Text style={s.phaseTitle}>Verify your email</Text>
            <Text style={s.phaseDesc}>
              We sent a 6-digit code to your email. Enter it below to finish setting up your account.
            </Text>

            <View style={s.handleBox}>
              <TextInput
                style={s.verifyInput}
                value={verifyCode}
                onChangeText={text => {
                  setVerifyCode(text.replace(/\D/g, '').slice(0, 6));
                  setVerifyError('');
                }}
                placeholder="000000"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              {verifyError ? (
                <Text style={s.handleError}>{verifyError}</Text>
              ) : null}
              {resendSuccess ? (
                <Text style={s.verifyResent}>Code sent!</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={s.resendBtn}
              onPress={handleResendCode}
              disabled={resending}
            >
              <Text style={s.resendBtnText}>
                {resending ? 'Sending...' : "Didn't get the code? Resend"}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[s.primaryBtn, verifying && s.btnDisabled]}
            onPress={handleVerifyComplete}
            disabled={verifying}
          >
            <Text style={s.primaryBtnText}>{verifying ? 'Verifying...' : "Let's run"}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ====================================
  //  PHASE: HANDLE
  // ====================================

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.phaseSubtitle}>Almost there</Text>
          <Text style={s.phaseTitle}>Pick your handle</Text>
          <Text style={s.phaseDesc}>
            This is your unique identity on ZenRun. Friends will find you by this name.
          </Text>

          <View style={s.handleBox}>
            <View style={s.handleInputWrapper}>
              <Text style={s.handlePrefix}>@</Text>
              <TextInput
                style={s.handleInput}
                value={handle}
                onChangeText={text => {
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
              <Text style={s.handleError}>{handleError}</Text>
            ) : (
              <Text style={s.handleHint}>This can't be changed later</Text>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[s.primaryBtn, saving && s.btnDisabled]}
          onPress={handleHandleContinue}
          disabled={saving}
        >
          <Text style={s.primaryBtnText}>{saving ? 'Setting up...' : 'Continue'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ====================================
//  STYLES
// ====================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header (slides phase)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogo: { width: 28, height: 28, borderRadius: 6 },
  headerBrand: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  skipButton: { padding: spacing.sm },
  skipText: { color: colors.textSecondary, fontSize: typography.sizes.md },

  // Slides
  slide: {
    width,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    flex: 1,
  },
  slideContent: { paddingBottom: 60 },
  slideIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  slideDivider: { width: 32, height: 3, borderRadius: 2, marginBottom: spacing.lg },
  slideBody: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 26,
  },

  // Feature visuals
  featureVisual: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  fvRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm },
  fvChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  fvChipActive: { backgroundColor: colors.primary },
  fvChipText: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.textSecondary },
  fvChipTextActive: { color: '#fff' },
  fvTimerBox: { alignItems: 'center', marginTop: spacing.md },
  fvTimer: { fontSize: 32, fontWeight: typography.weights.bold, color: colors.text, letterSpacing: 2 },
  fvTimerLabel: { fontSize: typography.sizes.sm, color: colors.textLight, marginTop: 2 },
  fvWeekCol: { alignItems: 'center', gap: 4 },
  fvBar: { width: 20, borderRadius: 4, backgroundColor: colors.primary },
  fvWeekLabel: { fontSize: 10, color: colors.textLight },
  fvBadgeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  fvBadge: { backgroundColor: colors.secondary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  fvBadgeText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.secondary },
  fvAvatarRow: { flexDirection: 'row', justifyContent: 'center' },
  fvAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  fvAvatarText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
  fvCircleLabel: {
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.text, marginHorizontal: 3 },

  // Footer / buttons
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  btnDisabled: { opacity: 0.6 },

  // Shared phase layout
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  phaseSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  phaseTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  phaseDesc: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },

  // Level picker
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  levelEmoji: { fontSize: 32 },
  levelName: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
  levelTagline: { fontSize: typography.sizes.sm, color: colors.textSecondary, fontStyle: 'italic' },
  levelRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  levelDistances: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  levelDescription: { fontSize: typography.sizes.sm, color: colors.textSecondary, lineHeight: 20 },

  // Goals
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  recommendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  recommendedText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  goalRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  goalCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  goalCardLabel: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  goalCardInputRow: { flexDirection: 'row', alignItems: 'baseline' },
  goalCardInput: {
    flex: 1,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    padding: 0,
  },
  goalCardUnit: { fontSize: typography.sizes.md, color: colors.textSecondary, marginLeft: spacing.xs },
  tipBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipText: { fontSize: typography.sizes.sm, color: colors.textSecondary, lineHeight: 22 },

  // Beta opt-in
  betaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  betaCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, marginRight: spacing.md },
  betaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betaTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text },
  betaDesc: { fontSize: typography.sizes.sm, color: colors.textSecondary, lineHeight: 18, marginTop: 2 },

  // Handle
  handleBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  handleInputWrapper: { flexDirection: 'row', alignItems: 'center' },
  handlePrefix: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  handleInput: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    padding: 0,
  },
  handleError: { fontSize: typography.sizes.sm, color: colors.error, marginTop: spacing.xs },
  handleHint: { fontSize: typography.sizes.xs, color: colors.textLight, marginTop: spacing.xs },

  // Verify
  verifyInput: {
    fontSize: 32,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 8,
    padding: spacing.md,
  },
  verifyResent: {
    fontSize: typography.sizes.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  resendBtnText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
