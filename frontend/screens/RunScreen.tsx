/**
 * 📝 LOG RUN SCREEN
 * ==================
 * 
 * Log a run with distance, category (outdoor/treadmill), duration.
 * Timer is optional - most users track time elsewhere.
 * 
 * 🎓 LEARNING NOTES:
 * - This screen focuses on logging completed runs
 * - Timer is available but optional
 * - Category helps distinguish outdoor vs treadmill runs
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunTypeButton } from '../components/RunTypeButton';
import { Timer } from '../components/Timer';
import { runApi, getDistance } from '../services/api';

const RUN_TYPES = ['3k', '5k', '10k', '15k', '18k', '21k'];
const CATEGORIES = [
  { id: 'outdoor', label: '🌳 Outdoor', emoji: '🌳' },
  { id: 'treadmill', label: '🏃 Treadmill', emoji: '🏃' },
];

interface RunScreenProps {
  navigation: any;
}

export function RunScreen({ navigation }: RunScreenProps) {
  // 📊 State
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('outdoor');
  const [useTimer, setUseTimer] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // 🎯 Handle manual run save
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
      
      // Calculate pace for the message
      const distance = getDistance(selectedType);
      const paceSeconds = totalSeconds / distance;
      const paceMins = Math.floor(paceSeconds / 60);
      const paceSecs = Math.floor(paceSeconds % 60);
      const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;
      
      // Check for celebrations
      const celebrations = run.celebrations || [];
      const hasCelebration = celebrations.length > 0;
      
      // Build celebration message
      let celebrationText = '';
      if (hasCelebration) {
        celebrationText = '\n\n' + celebrations.map(c => `${c.title}`).join('\n');
      }
      
      // Determine alert title
      let alertTitle = '🎉 Run Logged!';
      if (celebrations.length > 0) {
        alertTitle = celebrations[0].title;
      }
      
      Alert.alert(
        alertTitle,
        `${selectedType.toUpperCase()} ${category === 'treadmill' ? '(Treadmill)' : '(Outdoor)'}\n\nTime: ${run.formatted_duration}\nPace: ${paceStr} per km${celebrationText}`,
        [
          {
            text: hasCelebration ? 'Celebrate! 🎉' : 'Done',
            onPress: () => navigation.navigate('Home', { 
              celebrations: celebrations,
            }),
          },
          {
            text: 'Log Another',
            onPress: () => {
              setSelectedType(null);
              setMinutes('');
              setSeconds('');
              setNotes('');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 🎯 Handle timer completion
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
      
      const distance = getDistance(selectedType);
      const paceSeconds = totalSeconds / distance;
      const paceMins = Math.floor(paceSeconds / 60);
      const paceSecs = Math.floor(paceSeconds % 60);
      const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;
      
      // Check for celebrations
      const celebrations = run.celebrations || [];
      const hasCelebration = celebrations.length > 0;
      
      // Build celebration message
      let celebrationText = '';
      if (hasCelebration) {
        celebrationText = '\n\n' + celebrations.map(c => `${c.title}`).join('\n');
      }
      
      // Determine alert title
      let alertTitle = '🎉 Run Logged!';
      if (celebrations.length > 0) {
        alertTitle = celebrations[0].title;
      }
      
      Alert.alert(
        alertTitle,
        `${selectedType.toUpperCase()} ${category === 'treadmill' ? '(Treadmill)' : '(Outdoor)'}\n\nTime: ${run.formatted_duration}\nPace: ${paceStr} per km${celebrationText}`,
        [
          {
            text: hasCelebration ? 'Celebrate! 🎉' : 'Done',
            onPress: () => navigation.navigate('Home', { 
              celebrations: celebrations,
            }),
          },
          {
            text: 'Log Another',
            onPress: () => {
              setSelectedType(null);
              setUseTimer(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Show timer view
  if (useTimer && selectedType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.timerContainer}>
          <Timer
            runType={selectedType}
            onComplete={handleTimerComplete}
          />
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
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 🏃 Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📝 Log a Run</Text>
            <Text style={styles.subtitle}>
              Record your completed run
            </Text>
          </View>
          
          {/* 📏 Distance Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distance</Text>
            <View style={styles.typeGrid}>
              {RUN_TYPES.map(type => (
                <RunTypeButton
                  key={type}
                  type={type}
                  size="small"
                  selected={selectedType === type}
                  onPress={() => setSelectedType(type)}
                />
              ))}
            </View>
          </View>
          
          {/* 🏃 Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive,
                  ]}>
                    {cat.id === 'outdoor' ? 'Outdoor' : 'Treadmill'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* ⏱️ Duration Input */}
          <View style={styles.section}>
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
            
            {/* Timer Option */}
            <TouchableOpacity
              style={styles.timerOption}
              onPress={() => {
                if (!selectedType) {
                  Alert.alert('Select Distance', 'Please select a distance first');
                  return;
                }
                setUseTimer(true);
              }}
            >
              <Text style={styles.timerOptionText}>⏱️ Use Timer Instead</Text>
            </TouchableOpacity>
          </View>
          
          {/* 📝 Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="How did your run feel?"
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
          
          {/* 💾 Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveRun}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : '✓ Log Run'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.small,
  },
  categoryButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  categoryEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  categoryText: {
    fontSize: typography.sizes.md,
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
    width: 80,
    height: 60,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    ...shadows.small,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  durationSeparator: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.md,
  },
  timerOption: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  timerOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    ...shadows.small,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
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
});
