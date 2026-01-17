/**
 * ⏱️ TIMER COMPONENT
 * ===================
 * 
 * The heart of the run tracking - a beautiful, animated timer.
 * 
 * 🎓 LEARNING NOTES:
 * - useState manages component state (data that can change)
 * - useEffect handles side effects (like starting intervals)
 * - useRef persists values between renders without causing re-renders
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

interface TimerProps {
  onComplete: (seconds: number) => void;
  runType: string;
}

export function Timer({ onComplete, runType }: TimerProps) {
  // 📊 State - values that change and trigger re-renders
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // 🔧 Refs - values that persist but don't trigger re-renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✨ Animation value for the pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // 🎬 Start the pulsing animation when running
  useEffect(() => {
    if (isRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning, pulseAnim]);
  
  // ⏰ Timer logic
  useEffect(() => {
    if (isRunning) {
      // Start the interval - runs every 1000ms (1 second)
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    
    // 🧹 Cleanup function - runs when component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);
  
  // 🎯 Format time for display
  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // 🎮 Handle button press
  const handlePress = () => {
    if (isComplete) {
      // Reset
      setSeconds(0);
      setIsComplete(false);
      setIsRunning(false);
    } else if (isRunning) {
      // Stop and complete
      setIsRunning(false);
      setIsComplete(true);
      onComplete(seconds);
    } else {
      // Start
      setIsRunning(true);
    }
  };
  
  // 🎨 Get button styling based on state
  const getButtonStyle = () => {
    if (isComplete) return { backgroundColor: colors.success };
    if (isRunning) return { backgroundColor: colors.error };
    return { backgroundColor: colors.primary };
  };
  
  const getButtonText = () => {
    if (isComplete) return '🎉 RUN AGAIN';
    if (isRunning) return '⏹️ FINISH';
    return '▶️ START RUN';
  };
  
  const typeColor = colors.runTypes[runType] || colors.primary;
  
  return (
    <View style={styles.container}>
      {/* 🏃 Run Type Badge */}
      <View style={[styles.badge, { backgroundColor: typeColor }]}>
        <Text style={styles.badgeText}>{runType.toUpperCase()} RUN</Text>
      </View>
      
      {/* ⏱️ Timer Display */}
      <Animated.View 
        style={[
          styles.timerCircle,
          { 
            borderColor: isRunning ? typeColor : colors.textLight,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={[styles.timerText, isRunning && { color: typeColor }]}>
          {formatTime(seconds)}
        </Text>
        {isRunning && (
          <Text style={styles.runningText}>Running...</Text>
        )}
      </Animated.View>
      
      {/* 🎮 Control Button */}
      <TouchableOpacity
        style={[styles.button, getButtonStyle(), shadows.medium]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{getButtonText()}</Text>
      </TouchableOpacity>
      
      {/* 💡 Hint Text */}
      {!isRunning && !isComplete && (
        <Text style={styles.hintText}>
          Tap START when you begin running
        </Text>
      )}
      {isRunning && (
        <Text style={styles.hintText}>
          Tap FINISH when you complete {runType}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  badge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.xl,
  },
  badgeText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
    letterSpacing: 2,
  },
  timerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
    ...shadows.large,
  },
  timerText: {
    fontSize: 56,
    fontWeight: typography.weights.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'], // Monospace numbers for stability
  },
  runningText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  button: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  hintText: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
});
