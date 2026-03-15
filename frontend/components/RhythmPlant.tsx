import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

interface RhythmPlantProps {
  weeks: number;
  paused?: boolean;
  size?: 'small' | 'large';
}

interface StageInfo {
  emoji: string;
  label: string;
  glowColor?: string;
}

function getStage(weeks: number, paused: boolean): StageInfo {
  if (paused) return { emoji: '🍂', label: 'Resting' };
  if (weeks >= 26) return { emoji: '🌲', label: 'Mighty Oak', glowColor: colors.primary };
  if (weeks >= 16) return { emoji: '🍂', label: 'Through Seasons', glowColor: colors.primary };
  if (weeks >= 12) return { emoji: '🌳', label: 'Deep Roots', glowColor: colors.primary };
  if (weeks >= 8)  return { emoji: '🍀', label: 'Growing Strong' };
  if (weeks >= 6)  return { emoji: '🌾', label: 'Sapling' };
  if (weeks >= 4)  return { emoji: '🌴', label: 'Young Tree' };
  if (weeks >= 3)  return { emoji: '🌿', label: 'Sprout' };
  if (weeks >= 2)  return { emoji: '🌱', label: 'Seedling' };
  if (weeks >= 1)  return { emoji: '🌱', label: 'First Sprout' };
  return { emoji: '🌰', label: 'Planted' };
}

export function RhythmPlant({ weeks, paused = false, size = 'large' }: RhythmPlantProps) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const stage = getStage(weeks, paused);
  const isSmall = size === 'small';
  const emojiSize = isSmall ? 20 : 36;
  const containerSize = isSmall ? 32 : 56;

  useEffect(() => {
    scaleAnim.setValue(0.7);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [weeks, paused]);

  useEffect(() => {
    if (stage.glowColor) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [stage.glowColor]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.25],
  });

  return (
    <Animated.View style={[
      styles.container,
      { width: containerSize, height: containerSize, borderRadius: containerSize / 2 },
      { transform: [{ scale: scaleAnim }] },
    ]}>
      {stage.glowColor && (
        <Animated.View style={[
          styles.glow,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: stage.glowColor,
            opacity: glowOpacity,
          },
        ]} />
      )}
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 4 }}>
        {stage.emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
  },
});
