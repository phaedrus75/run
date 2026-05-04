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
import { LinearGradient } from 'expo-linear-gradient';
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
      {/* The tab bar button itself — a raised 3D pill that floats above the
          bar. Composed of a soft outer glow, a hard outer shadow, a gradient
          fill, and a thin inner highlight to give it a tactile look. */}
      <View style={styles.wrapper}>
        {/* Soft halo behind the button (suggests a lifted object). */}
        <View style={styles.halo} pointerEvents="none" />

        <Animated.View style={[styles.btnShadow, { transform: [{ scale: pulseAnim }] }]}>
          <Pressable
            onPress={open}
            style={({ pressed }) => [
              styles.btnPressable,
              { transform: [{ scale: pressed ? 0.93 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={['#FFB36B', '#F97316', '#D85B0F']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.btnGradient}
            >
              {/* Thin top-edge highlight to catch the eye like a glossy
                  surface. */}
              <View style={styles.btnHighlight} pointerEvents="none" />
              <Ionicons name="add" size={36} color="#fff" />
            </LinearGradient>
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

const BTN_SIZE = 68;
const HALO_SIZE = BTN_SIZE + 28;
const GO_ORANGE = '#F97316';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -26,
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: GO_ORANGE,
    opacity: 0.14,
    top: -14,
  },
  btnShadow: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    // Strong, slightly downward-offset shadow so the button reads as
    // floating above the tab bar.
    shadowColor: '#9A3D0A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 10,
  },
  btnPressable: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
  },
  btnGradient: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Hairline white border on top of the gradient — the "rim" of a 3D
    // button.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnHighlight: {
    // A small bright sliver at the top-left to suggest a light source above
    // and a glossy surface.
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    height: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.20)',
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
