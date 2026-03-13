/**
 * LOG RUN SCREEN
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunTypeButton } from '../components/RunTypeButton';
import { Timer } from '../components/Timer';
import { runApi, getDistance } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RUN_TYPES = ['3k', '5k', '10k', '15k', '18k', '21k'];
const CATEGORIES = [
  { id: 'outdoor', label: '🌳 Outdoor', emoji: '🌳' },
  { id: 'treadmill', label: '🏃 Treadmill', emoji: '🏃' },
];

const QUOTES = [
  { text: "The only opponent you have to beat is yourself, the way you used to be.", author: "Haruki Murakami" },
  { text: "It is only necessary that he runs and runs. Then one day he will see order and law and love.", author: "George Sheehan" },
  { text: "Trust your body and keep things simple.", author: "Christopher McDougall" },
  { text: "All I do is keep on running in my own cozy, homemade void. And this is a pretty wonderful thing.", author: "Haruki Murakami" },
  { text: "The real purpose of running isn't to win a race. It's to test the limits of the human heart.", author: "Bill Bowerman" },
  { text: "Every morning in Africa, a gazelle wakes up. It knows it must outrun the fastest lion or it will be killed. It doesn't matter whether you are the lion or a gazelle — when the sun comes up, you'd better be running.", author: "Born to Run" },
  { text: "Running is the greatest metaphor for life, because you get out of it what you put into it.", author: "Oprah Winfrey" },
  { text: "Exerting yourself to the fullest within your individual limits: that's the essence of running.", author: "Haruki Murakami" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", author: "John Bingham" },
  { text: "You showed up. That's what matters.", author: "ZenRun" },
  { text: "Another run in the books. The streak continues.", author: "ZenRun" },
  { text: "You didn't run to be fast. You ran to feel alive.", author: "ZenRun" },
  { text: "Consistency is the only metric that matters. You're building it.", author: "ZenRun" },
];

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

interface RunScreenProps {
  navigation: any;
}

interface RunResult {
  distance: string;
  category: string;
  formattedDuration: string;
  pace: string;
  celebrations: any[];
}

export function RunScreen({ navigation }: RunScreenProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('outdoor');
  const [useTimer, setUseTimer] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [quote, setQuote] = useState(getRandomQuote());
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const confettiRef = useRef<any>(null);

  const openCelebration = (result: RunResult) => {
    setRunResult(result);
    setQuote(getRandomQuote());
    setShowCelebration(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start(() => {
      confettiRef.current?.start();
    });
  };

  const closeCelebration = (action: 'done' | 'another') => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCelebration(false);
      if (action === 'done') {
        navigation.navigate('Home', {
          celebrations: runResult?.celebrations || [],
        });
      } else {
        setSelectedType(null);
        setMinutes('');
        setSeconds('');
        setNotes('');
      }
    });
  };

  const processRunResult = (run: any, totalSeconds: number, runType: string) => {
    const distance = getDistance(runType);
    const paceSeconds = totalSeconds / distance;
    const paceMins = Math.floor(paceSeconds / 60);
    const paceSecs = Math.floor(paceSeconds % 60);
    const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;

    openCelebration({
      distance: runType.toUpperCase(),
      category: category === 'treadmill' ? 'Treadmill' : 'Outdoor',
      formattedDuration: run.formatted_duration,
      pace: paceStr,
      celebrations: run.celebrations || [],
    });
  };

  const handleSaveRun = async () => {
    if (!selectedType) {
      Alert.alert('Select Distance', 'Please select a run distance');
      return;
    }

    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    const totalSeconds = mins * 60 + secs;

    if (totalSeconds <= 0) {
      Alert.alert('Enter Duration', 'Please enter how long your run took');
      return;
    }

    setIsSaving(true);

    try {
      const run = await runApi.create({
        run_type: selectedType,
        duration_seconds: totalSeconds,
        notes: notes || undefined,
        category: category,
      });
      processRunResult(run, totalSeconds, selectedType);
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimerComplete = async (totalSeconds: number) => {
    if (!selectedType) return;

    setIsSaving(true);

    try {
      const run = await runApi.create({
        run_type: selectedType,
        duration_seconds: totalSeconds,
        notes: notes || undefined,
        category: category,
      });
      processRunResult(run, totalSeconds, selectedType);
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (useTimer && selectedType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.timerContainer}>
          <Timer runType={selectedType} onComplete={handleTimerComplete} />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setUseTimer(false)}
          >
            <Text style={styles.backButtonText}>← Back to Manual Entry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const haptic = (style: Haptics.ImpactFeedbackStyle) => {
    try { Haptics.impactAsync(style); } catch {}
  };

  const handleDistancePress = (type: string) => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedType(type);
  };

  const handleCategoryPress = (id: string) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setCategory(id);
  };

  const handleSavePress = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    handleSaveRun();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body}>
          {/* Header */}
          <Text style={styles.title}>Log a Run</Text>

          {/* Distance */}
          <Text style={styles.sectionTitle}>Distance</Text>
          <View style={styles.typeGrid}>
            {RUN_TYPES.map(type => {
              const typeColor = colors.runTypes[type] || colors.primary;
              const isSelected = selectedType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => handleDistancePress(type)}
                  style={({ pressed }) => [
                    styles.distanceChip,
                    {
                      backgroundColor: isSelected ? typeColor : colors.surface,
                      borderColor: typeColor,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                    isSelected && shadows.small,
                  ]}
                >
                  <Text style={[
                    styles.distanceChipText,
                    { color: isSelected ? '#fff' : typeColor },
                  ]}>
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Category */}
          <View style={styles.categoryRow}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.id}
                onPress={() => handleCategoryPress(cat.id)}
                style={({ pressed }) => [
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonActive,
                  { transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[
                  styles.categoryText,
                  category === cat.id && styles.categoryTextActive,
                ]}>
                  {cat.id === 'outdoor' ? 'Outdoor' : 'Treadmill'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Duration */}
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <TextInput
                style={styles.durationField}
                placeholder="00"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={3}
                value={minutes}
                onChangeText={setMinutes}
              />
              <Text style={styles.durationLabel}>min</Text>
            </View>
            <Text style={styles.durationSeparator}>:</Text>
            <View style={styles.durationInput}>
              <TextInput
                style={styles.durationField}
                placeholder="00"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={2}
                value={seconds}
                onChangeText={setSeconds}
              />
              <Text style={styles.durationLabel}>sec</Text>
            </View>
          </View>

          {/* Notes - compact inline */}
          <TextInput
            style={styles.notesInput}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textLight}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Pinned bottom button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleSavePress}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : '✓ Log Run'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Celebration Modal */}
      <Modal
        visible={showCelebration}
        transparent
        animationType="none"
        onRequestClose={() => closeCelebration('done')}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => closeCelebration('done')}
          />
          <Animated.View
            style={[
              styles.celebrationSheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.sheetHandle} />

            {runResult && (
              <View style={styles.celebrationContent}>
                <Text style={styles.celebrationEmoji}>🏃</Text>
                <Text style={styles.celebrationTitle}>Run logged.</Text>

                <View style={styles.runSummary}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{runResult.distance}</Text>
                      <Text style={styles.summaryLabel}>{runResult.category}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{runResult.formattedDuration}</Text>
                      <Text style={styles.summaryLabel}>Time</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{runResult.pace}</Text>
                      <Text style={styles.summaryLabel}>per km</Text>
                    </View>
                  </View>
                </View>

                {runResult.celebrations.length > 0 && (
                  <View style={styles.achievementBanner}>
                    {runResult.celebrations.map((c, i) => (
                      <Text key={i} style={styles.achievementText}>{c.title}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.quoteContainer}>
                  <Text style={styles.quoteText}>"{quote.text}"</Text>
                  <Text style={styles.quoteAuthor}>— {quote.author}</Text>
                </View>

                <View style={styles.celebrationButtons}>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => closeCelebration('done')}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.anotherButton}
                    onPress={() => closeCelebration('another')}
                  >
                    <Text style={styles.anotherButtonText}>Log Another</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>

          {showCelebration && (
            <ConfettiCannon
              ref={confettiRef}
              count={80}
              origin={{ x: Dimensions.get('window').width / 2, y: -20 }}
              fadeOut
              autoStart={false}
              fallSpeed={2500}
              explosionSpeed={300}
              colors={[colors.primary, colors.secondary, colors.accent, '#FF8E8E', '#7EDDD6']}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceChipText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  categoryTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationInput: {
    alignItems: 'center',
  },
  durationField: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: 76,
    height: 56,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    ...shadows.small,
  },
  durationLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  durationSeparator: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginTop: spacing.md,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    padding: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },

  // Celebration modal
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  celebrationSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingBottom: 40,
    ...shadows.large,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.textLight,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  celebrationContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  runSummary: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.textLight + '40',
  },
  achievementBanner: {
    width: '100%',
    backgroundColor: colors.accent + '30',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  achievementText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  quoteContainer: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  quoteText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  celebrationButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.small,
  },
  doneButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  anotherButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  anotherButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
