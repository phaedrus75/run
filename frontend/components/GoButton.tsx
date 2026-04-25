/**
 * GoButton
 * ========
 *
 * Central tab bar button. Pressing it opens a bottom sheet with three
 * activity options:
 *   🚶  Start Walk   → ActiveWalkScreen
 *   🏃  Start Run    → ActiveRunScreen
 *   ✏️  Log Run      → RunScreen (manual entry)
 *
 * Used as tabBarButton for the centre tab slot in MainTabs.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

const ACCENT = '#F97316'; // orange accent for run options
const WALK_COLOR = '#10B981'; // green for walk

interface Option {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
  onPress: (nav: any) => void;
}

const OPTIONS: Option[] = [
  {
    icon: 'walk',
    label: 'Start a Walk',
    sub: 'GPS map · distance · photos',
    color: WALK_COLOR,
    onPress: (nav) => nav.navigate('Walks', { screen: 'ActiveWalk' }),
  },
  {
    icon: 'fitness',
    label: 'Start a Run',
    sub: 'GPS tracked outdoor run',
    color: ACCENT,
    onPress: (nav) => nav.navigate('Runs', { screen: 'ActiveRun' }),
  },
  {
    icon: 'pencil',
    label: 'Log a Run',
    sub: 'Manual entry · time · distance type',
    color: colors.primary,
    onPress: (nav) => nav.navigate('Runs', { screen: 'RunScreen' }),
  },
];

export function GoButton() {
  const navigation = useNavigation<any>();
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Gentle idle pulse on the button
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const open = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const close = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 200, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0,   duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      slideAnim.setValue(200);
      cb?.();
    });
  };

  const pick = (opt: Option) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    close(() => opt.onPress(navigation));
  };

  return (
    <>
      {/* The tab bar button itself */}
      <View style={styles.wrapper}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={open}
            style={({ pressed }) => [
              styles.btn,
              { transform: [{ scale: pressed ? 0.93 : 1 }] },
            ]}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Bottom sheet modal */}
      <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => close()} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          pointerEvents="box-none"
        >
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>What would you like to do?</Text>

          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={() => pick(opt)}
              style={({ pressed }) => [
                styles.option,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <View style={[styles.optIcon, { backgroundColor: opt.color + '18', borderColor: opt.color + '40' }]}>
                <Ionicons name={opt.icon} size={24} color={opt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optLabel}>{opt.label}</Text>
                <Text style={styles.optSub}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </Pressable>
          ))}

          <Pressable onPress={() => close()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -20,
  },
  btn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
    ...shadows.large,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  optIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  optLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  optSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
});
