/**
 * LOG RUN SCREEN
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { MAX_PHOTOS_PER_ACTIVITY } from '../constants/photos';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunTypeButton } from '../components/RunTypeButton';
import { Timer } from '../components/Timer';
import { runApi, photoApi, getDistance, levelApi } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ALL_RUN_TYPES = ['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'];
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
  { text: "Another run in the books. The rhythm continues.", author: "ZenRun" },
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
  runId: number;
  distance: string;
  category: string;
  formattedDuration: string;
  pace: string;
  celebrations: any[];
}

export function RunScreen({ navigation }: RunScreenProps) {
  const [availableTypes, setAvailableTypes] = useState<string[]>(ALL_RUN_TYPES);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('outdoor');
  const [useTimer, setUseTimer] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [quote, setQuote] = useState(getRandomQuote());
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [scenicPhotos, setScenicPhotos] = useState<Array<{ marker: number; uri: string; caption: string }>>([]);
  const [showPhotoFlow, setShowPhotoFlow] = useState(false);
  const [photoStep, setPhotoStep] = useState<'pick' | 'marker' | 'caption'>('pick');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const [pendingMarker, setPendingMarker] = useState<number | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const breatheAnim = useRef(new Animated.Value(0.85)).current;
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    levelApi.get().then(data => {
      if (data?.distances) setAvailableTypes(data.distances);
    }).catch(() => {});
  }, []);

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
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0.85, duration: 3000, useNativeDriver: true }),
      ]),
    ).start();
  };

  const closeCelebration = async (action: 'done' | 'another') => {
    if (runResult?.runId && (selectedMood || reflection.trim())) {
      try {
        const updateData: any = {};
        if (selectedMood) updateData.mood = selectedMood;
        if (reflection.trim()) updateData.notes = reflection.trim();
        await runApi.update(runResult.runId, updateData);
      } catch {}
    }

    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCelebration(false);
      setSelectedMood(null);
      setReflection('');
      setScenicPhotos([]);
      setShowPhotoFlow(false);
      setPhotoStep('pick');
      setPendingPhotoUri(null);
      setPendingPhotoBase64(null);
      setPendingMarker(null);
      setPendingCaption('');
      if (action === 'done') {
        navigation.navigate('Home', {
          celebrations: runResult?.celebrations || [],
        });
      } else {
        setSelectedType(null);
        setMinutes('');
        setSeconds('');
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
      runId: run.id,
      distance: runType.toUpperCase(),
      category: category === 'treadmill' ? 'Treadmill' : 'Outdoor',
      formattedDuration: run.formatted_duration,
      pace: paceStr,
      celebrations: run.celebrations || [],
    });
  };

  const getDistanceMarkers = (distanceKm: number): number[] => {
    const markers: number[] = [];
    for (let km = 1; km <= distanceKm; km++) {
      markers.push(km);
    }
    return markers;
  };

  const pickPhoto = async () => {
    if (scenicPhotos.length >= MAX_PHOTOS_PER_ACTIVITY) {
      Alert.alert(
        'Photo limit reached',
        `${MAX_PHOTOS_PER_ACTIVITY} photos is the limit per run.`,
      );
      return;
    }
    // Wrap so any picker / manipulator failure (permission, OOM on large
    // HEIC, etc.) surfaces as an alert instead of crashing the app.
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setPendingPhotoUri(manipulated.uri);
      setPendingPhotoBase64(base64);
      setPhotoStep('marker');
    } catch (e: any) {
      console.warn('Photo pick failed', e);
      Alert.alert(
        'Could not attach photo',
        e?.message ?? 'Try a different photo.',
      );
    }
  };

  const handleSelectMarker = (km: number) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setPendingMarker(km);
    setPhotoStep('caption');
  };

  const handleUploadPhoto = async () => {
    if (!runResult?.runId || !pendingPhotoBase64 || !pendingMarker) return;

    setUploadingPhoto(true);
    try {
      await photoApi.upload(runResult.runId, {
        photo_data: pendingPhotoBase64,
        distance_marker_km: pendingMarker,
        caption: pendingCaption.trim() || undefined,
      });

      setScenicPhotos(prev => [...prev, {
        marker: pendingMarker,
        uri: pendingPhotoUri || '',
        caption: pendingCaption.trim(),
      }]);

      setPendingPhotoUri(null);
      setPendingPhotoBase64(null);
      setPendingMarker(null);
      setPendingCaption('');
      setPhotoStep('pick');
    } catch (e) {
      console.error('Photo upload failed:', e);
      Alert.alert('Upload Failed', 'Could not upload photo. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
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
            {availableTypes.map(type => {
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
                <View style={styles.breatheContainer}>
                  <Animated.View style={[styles.breatheCircle, { transform: [{ scale: breatheAnim }] }]} />
                  <Text style={styles.celebrationEmoji}>🌿</Text>
                </View>
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

                {/* Mood picker */}
                <View style={styles.moodSection}>
                  <Text style={styles.moodLabel}>How did it feel?</Text>
                  <View style={styles.moodRow}>
                    {[
                      { id: 'easy', emoji: '😌', label: 'Easy' },
                      { id: 'good', emoji: '😊', label: 'Good' },
                      { id: 'tough', emoji: '😤', label: 'Tough' },
                      { id: 'great', emoji: '🤩', label: 'Great' },
                    ].map(m => (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          haptic(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedMood(selectedMood === m.id ? null : m.id);
                        }}
                        style={({ pressed }) => [
                          styles.moodChip,
                          selectedMood === m.id && styles.moodChipActive,
                          { transform: [{ scale: pressed ? 0.92 : 1 }] },
                        ]}
                      >
                        <Text style={styles.moodEmoji}>{m.emoji}</Text>
                        <Text style={[
                          styles.moodText,
                          selectedMood === m.id && styles.moodTextActive,
                        ]}>{m.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* One-line reflection */}
                <TextInput
                  style={styles.reflectionInput}
                  placeholder="Any thoughts on the run?"
                  placeholderTextColor={colors.textLight}
                  value={reflection}
                  onChangeText={setReflection}
                  maxLength={100}
                  returnKeyType="done"
                />

                {/* Scenic Photos - outdoor runs only */}
                {runResult.category === 'Outdoor' && !showPhotoFlow && (
                  <TouchableOpacity
                    style={styles.scenicButton}
                    onPress={() => {
                      haptic(Haptics.ImpactFeedbackStyle.Medium);
                      setShowPhotoFlow(true);
                      pickPhoto();
                    }}
                  >
                    <Text style={styles.scenicButtonEmoji}>📸</Text>
                    <Text style={styles.scenicButtonText}>Add scenic photos</Text>
                  </TouchableOpacity>
                )}

                {showPhotoFlow && (
                  <View style={styles.photoFlowContainer}>
                    {/* Uploaded photos thumbnails */}
                    {scenicPhotos.length > 0 && (
                      <View style={styles.photoThumbnails}>
                        {scenicPhotos.map((p, i) => (
                          <View key={i} style={styles.thumbnailWrap}>
                            <Image source={{ uri: p.uri }} style={styles.thumbnail} />
                            <Text style={styles.thumbnailMarker}>{p.marker}K</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {photoStep === 'pick' && !pendingPhotoUri && (
                      <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
                        <Text style={styles.addPhotoBtnText}>
                          {scenicPhotos.length > 0 ? '+ Add another photo' : '📷 Pick a photo'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {photoStep === 'marker' && pendingPhotoUri && (
                      <View style={styles.markerSection}>
                        <Image source={{ uri: pendingPhotoUri }} style={styles.previewImage} />
                        <Text style={styles.markerLabel}>Where was this taken?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.markerScroll}>
                          <View style={styles.markerRow}>
                            {getDistanceMarkers(getDistance(runResult.distance.toLowerCase())).map(km => (
                              <TouchableOpacity
                                key={km}
                                style={[
                                  styles.markerChip,
                                  pendingMarker === km && styles.markerChipActive,
                                ]}
                                onPress={() => handleSelectMarker(km)}
                              >
                                <Text style={[
                                  styles.markerChipText,
                                  pendingMarker === km && styles.markerChipTextActive,
                                ]}>{km}K</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    {photoStep === 'caption' && (
                      <View style={styles.captionSection}>
                        <Image source={{ uri: pendingPhotoUri! }} style={styles.previewImageSmall} />
                        <Text style={styles.captionMarkerTag}>📍 At the {pendingMarker}K mark</Text>
                        <TextInput
                          style={styles.captionInput}
                          placeholder="Add a caption (optional)"
                          placeholderTextColor={colors.textLight}
                          value={pendingCaption}
                          onChangeText={setPendingCaption}
                          maxLength={80}
                          returnKeyType="done"
                        />
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={handleUploadPhoto}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <ActivityIndicator color={colors.textOnPrimary} />
                          ) : (
                            <Text style={styles.uploadBtnText}>Save photo</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.closePhotoFlow}
                      onPress={() => {
                        setShowPhotoFlow(false);
                        setPhotoStep('pick');
                        setPendingPhotoUri(null);
                        setPendingPhotoBase64(null);
                        setPendingMarker(null);
                        setPendingCaption('');
                      }}
                    >
                      <Text style={styles.closePhotoFlowText}>
                        {scenicPhotos.length > 0 ? 'Done adding photos' : 'Skip photos'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!showPhotoFlow && (
                  <>
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
                  </>
                )}
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
  breatheContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  breatheCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondary + '20',
  },
  celebrationEmoji: {
    fontSize: 36,
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
  moodSection: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  moodLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  moodEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  moodText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  moodTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  reflectionInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
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

  // Scenic photo styles
  scenicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.textLight + '60',
    borderStyle: 'dashed',
  },
  scenicButtonEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  scenicButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  photoFlowContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  photoThumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  thumbnailWrap: {
    position: 'relative',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  thumbnailMarker: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.primary,
    color: colors.textOnPrimary,
    fontSize: 9,
    fontWeight: typography.weights.bold as any,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  addPhotoBtn: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    marginBottom: spacing.sm,
  },
  addPhotoBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  markerSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  markerLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  markerScroll: {
    maxHeight: 44,
  },
  markerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  markerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.textLight,
  },
  markerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  markerChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  markerChipTextActive: {
    color: colors.textOnPrimary,
  },
  captionSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewImageSmall: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  captionMarkerTag: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.sm,
  },
  captionInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 140,
  },
  uploadBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  closePhotoFlow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  closePhotoFlowText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
