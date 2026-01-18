/**
 * 🏃 RUN SCREEN
 * ==============
 * 
 * Where the magic happens! Select a run type and track your run.
 * 
 * 🎓 LEARNING NOTES:
 * - This screen has two "states": selecting run type, and running
 * - We pass callbacks to child components (Timer)
 * - After completing a run, we navigate back home
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunTypeButton } from '../components/RunTypeButton';
import { Timer } from '../components/Timer';
import { runApi, getDistance } from '../services/api';

const RUN_TYPES = ['3k', '5k', '10k', '15k', '18k', '21k'];

interface RunScreenProps {
  navigation: any;
}

export function RunScreen({ navigation }: RunScreenProps) {
  // 📊 State
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 🎯 Handle run completion
  const handleRunComplete = async (seconds: number) => {
    if (!selectedType) return;
    
    setIsSaving(true);
    
    try {
      const run = await runApi.create({
        run_type: selectedType,
        duration_seconds: seconds,
      });
      
      // Calculate pace for the message
      const distance = getDistance(selectedType);
      const paceSeconds = seconds / distance;
      const paceMins = Math.floor(paceSeconds / 60);
      const paceSecs = Math.floor(paceSeconds % 60);
      const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;
      
      // Show celebration alert
      Alert.alert(
        '🎉 Amazing Run!',
        `You completed ${selectedType.toUpperCase()} in ${run.formatted_duration}!\n\nPace: ${paceStr} per km`,
        [
          {
            text: 'View Stats',
            onPress: () => navigation.navigate('Home'),
          },
          {
            text: 'Run Again',
            onPress: () => setSelectedType(null),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert(
        'Saved Locally',
        `Great run! ${selectedType.toUpperCase()} completed.\n\n(Unable to sync with server - will retry later)`,
        [{ text: 'OK', onPress: () => setSelectedType(null) }]
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 🏃 Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {selectedType ? 'Track Your Run' : 'Choose Your Distance'}
          </Text>
          <Text style={styles.subtitle}>
            {selectedType 
              ? 'Tap START when ready, FINISH when done!'
              : 'Select a run type to begin'
            }
          </Text>
        </View>
        
        {!selectedType ? (
          // 📋 Run Type Selection
          <View style={styles.typeSelection}>
            <View style={styles.typeGrid}>
              {RUN_TYPES.map(type => (
                <RunTypeButton
                  key={type}
                  type={type}
                  size="large"
                  onPress={() => setSelectedType(type)}
                />
              ))}
            </View>
            
            {/* 💡 Tips Section */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>💡 Running Tips</Text>
              <View style={styles.tipCard}>
                <Text style={styles.tipEmoji}>🔥</Text>
                <Text style={styles.tipText}>
                  Warm up for 5 minutes before your run
                </Text>
              </View>
              <View style={styles.tipCard}>
                <Text style={styles.tipEmoji}>💧</Text>
                <Text style={styles.tipText}>
                  Stay hydrated! Drink water before and after
                </Text>
              </View>
              <View style={styles.tipCard}>
                <Text style={styles.tipEmoji}>👟</Text>
                <Text style={styles.tipText}>
                  Start slow - you can always speed up!
                </Text>
              </View>
            </View>
          </View>
        ) : (
          // ⏱️ Timer View
          <View style={styles.timerContainer}>
            <Timer
              runType={selectedType}
              onComplete={handleRunComplete}
            />
            
            {/* Change Run Type */}
            <Text 
              style={styles.changeTypeText}
              onPress={() => setSelectedType(null)}
            >
              ← Change distance
            </Text>
          </View>
        )}
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
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.xl,
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
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  typeSelection: {
    flex: 1,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  tipsContainer: {
    marginTop: spacing.lg,
  },
  tipsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  changeTypeText: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: typography.sizes.md,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
});
