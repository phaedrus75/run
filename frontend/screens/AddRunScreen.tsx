/**
 * ➕ ADD RUN SCREEN
 * ==================
 * 
 * Add a past run with a custom date.
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { RunTypeButton } from '../components/RunTypeButton';
import { runApi } from '../services/api';

const RUN_TYPES = ['3k', '5k', '10k', '15k', '18k', '21k'];

interface AddRunScreenProps {
  navigation: any;
}

export function AddRunScreen({ navigation }: AddRunScreenProps) {
  const [runType, setRunType] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Date state - default to today
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Quick date options
  const getQuickDates = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return [
      { label: 'Today', date: today },
      { label: 'Yesterday', date: yesterday },
      { label: '2 days ago', date: twoDaysAgo },
      { label: '3 days ago', date: threeDaysAgo },
      { label: '1 week ago', date: oneWeekAgo },
    ];
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const isDateSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };
  
  const handleSave = async () => {
    if (!runType) {
      Alert.alert('Select Distance', 'Please select a run distance');
      return;
    }
    
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    const durationSeconds = mins * 60 + secs;
    
    if (durationSeconds === 0) {
      Alert.alert('Enter Duration', 'Please enter how long the run took');
      return;
    }
    
    setSaving(true);
    try {
      await runApi.create({
        run_type: runType,
        duration_seconds: durationSeconds,
        notes: notes || undefined,
        completed_at: selectedDate.toISOString(),
      });
      
      Alert.alert(
        '✅ Run Added!',
        `${runType.toUpperCase()} run on ${formatDate(selectedDate)} saved.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Failed to save run. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Past Run</Text>
          <Text style={styles.subtitle}>Record a run from a previous day</Text>
        </View>
        
        {/* Date Selection */}
        <Text style={styles.label}>When did you run?</Text>
        <View style={styles.dateGrid}>
          {getQuickDates().map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateButton,
                isDateSelected(item.date) && styles.dateButtonSelected,
              ]}
              onPress={() => setSelectedDate(item.date)}
            >
              <Text style={[
                styles.dateButtonLabel,
                isDateSelected(item.date) && styles.dateButtonLabelSelected,
              ]}>
                {item.label}
              </Text>
              <Text style={[
                styles.dateButtonDate,
                isDateSelected(item.date) && styles.dateButtonDateSelected,
              ]}>
                {formatDate(item.date)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Custom Date Input */}
        <View style={styles.customDateContainer}>
          <Text style={styles.customDateLabel}>Or enter a custom date:</Text>
          <View style={styles.customDateRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="MM"
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(month) => {
                const m = parseInt(month);
                if (m >= 1 && m <= 12) {
                  const newDate = new Date(selectedDate);
                  newDate.setMonth(m - 1);
                  setSelectedDate(newDate);
                }
              }}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="DD"
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(day) => {
                const d = parseInt(day);
                if (d >= 1 && d <= 31) {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(d);
                  setSelectedDate(newDate);
                }
              }}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={[styles.dateInput, { width: 70 }]}
              placeholder="YYYY"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(year) => {
                const y = parseInt(year);
                if (y >= 2020 && y <= 2030) {
                  const newDate = new Date(selectedDate);
                  newDate.setFullYear(y);
                  setSelectedDate(newDate);
                }
              }}
            />
          </View>
        </View>
        
        {/* Run Type Selection */}
        <Text style={styles.label}>Distance</Text>
        <View style={styles.typeRow}>
          {RUN_TYPES.map(type => (
            <RunTypeButton
              key={type}
              type={type}
              size="medium"
              selected={runType === type}
              onPress={() => setRunType(type)}
            />
          ))}
        </View>
        
        {/* Duration Input */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationRow}>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.input}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={3}
            />
            <Text style={styles.durationLabel}>min</Text>
          </View>
          <Text style={styles.colon}>:</Text>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.input}
              value={seconds}
              onChangeText={setSeconds}
              keyboardType="number-pad"
              placeholder="00"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>sec</Text>
          </View>
        </View>
        
        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How did the run feel?"
          multiline
          numberOfLines={3}
        />
        
        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, shadows.medium, (!runType || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!runType || saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : '💾 Save Run'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  dateButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    margin: spacing.xs,
    minWidth: '30%',
    flex: 1,
    ...shadows.small,
  },
  dateButtonSelected: {
    backgroundColor: colors.primary,
  },
  dateButtonLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  dateButtonLabelSelected: {
    color: colors.textOnPrimary,
  },
  dateButtonDate: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  dateButtonDateSelected: {
    color: colors.textOnPrimary,
    opacity: 0.8,
  },
  customDateContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  customDateLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: 50,
    textAlign: 'center',
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  dateSeparator: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationInput: {
    alignItems: 'center',
  },
  colon: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.xl,
    color: colors.text,
    textAlign: 'center',
    minWidth: 80,
    ...shadows.small,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    fontSize: typography.sizes.md,
    textAlign: 'left',
  },
  saveButton: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
});
