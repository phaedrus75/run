/**
 * 🟢 GoButton
 * ===========
 *
 * Beautiful centre tab-bar button that pops an action sheet with
 * "Start a Walk" and "Log Run" options. Rendered as a custom tabBarButton
 * so it floats above the tab bar with a shadow halo.
 *
 * Usage in Tab.Navigator:
 *   <Tab.Screen name="Go" component={GoPlaceholder}
 *     options={{ tabBarButton: (props) => <GoButton {...props} navigation={nav} /> }}
 *   />
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface GoButtonProps {
  navigation: any;
  // passed through from tabBarButton props (we forward them to keep RN nav happy)
  [key: string]: any;
}

interface Action {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  onPress: () => void;
}

export function GoButton({ navigation, ...rest }: GoButtonProps) {
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(200)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const openSheet = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    pulse();
    setOpen(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
    ]).start();
  };

  const closeSheet = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 200, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      cb?.();
    });
  };

  const navigate = (screen: string, params?: object) => {
    closeSheet(() => {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      navigation.navigate(screen, params);
    });
  };

  const actions: Action[] = [
    {
      key: 'walk',
      icon: 'walk',
      label: 'Start a Walk',
      sublabel: 'GPS route · distance · photos',
      color: colors.secondary,
      bg: colors.secondary + '18',
      onPress: () => navigate('Walk', { screen: 'ActiveWalk' }),
    },
    {
      key: 'run',
      icon: 'fitness',
      label: 'Log a Run',
      sublabel: 'Time a distance or add past run',
      color: colors.primary,
      bg: colors.primary + '18',
      onPress: () => navigate('Run'),
    },
  ];

  return (
    <>
      {/* ── Centre tab button ── */}
      <Pressable
        {...rest}
        onPress={openSheet}
        style={styles.buttonWrap}
        accessibilityLabel="Go"
        accessibilityRole="button"
      >
        <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
          <Text style={styles.buttonLabel}>GO</Text>
        </Animated.View>
      </Pressable>

      {/* ── Action sheet modal ── */}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => closeSheet()}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>What's the move?</Text>

          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={a.onPress}
              style={({ pressed }) => [
                styles.actionRow,
                { backgroundColor: pressed ? a.bg : colors.surface },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={26} color={a.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionSub}>{a.sublabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </Pressable>
          ))}

          <Pressable style={styles.cancelBtn} onPress={() => closeSheet()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    // crisp white ring
    borderWidth: 3,
    borderColor: '#fff',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    paddingTop: 12,
    ...shadows.medium,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  actionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});
