/**
 * Slide-out drawer (Oura-style hamburger). Non-critical nav + tools live here.
 * Uses a Modal + slide animation — no @react-navigation/drawer dependency.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from '../navigationRef';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { isAdminUser } from '../constants/admin';

const DRAWER_W = Math.min(Dimensions.get('window').width * 0.86, 340);

interface Props {
  visible: boolean;
  onClose: () => void;
}

function goHomeScreen(screen: string, params?: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Home', { screen, params });
}

export function AppDrawer({ visible, onClose }: Props) {
  const { user, logout, deleteAccount } = useAuth();
  const slide = useRef(new Animated.Value(-DRAWER_W)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : -DRAWER_W,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const pick = (fn: () => void) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
    setTimeout(fn, 80);
  };

  const row = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    sub?: string,
    iconColor: string = colors.primary,
  ) => (
    <Pressable
      onPress={() => pick(onPress)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={styles.overlay} />
        </Pressable>

        <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name || 'ZenRunner'}</Text>
                {(user as unknown as { handle?: string } | null)?.handle ? (
                  <Text style={styles.handle}>@{(user as unknown as { handle: string }).handle}</Text>
                ) : (
                  <Text style={styles.handleMuted}>Set a handle in Profile</Text>
                )}
              </View>
            </View>

            <Text style={styles.section}>Account</Text>
            {row('person-outline', 'Profile', () => goHomeScreen('Profile'), 'Privacy, level, handle')}
            {row('flag-outline', 'Goals', () => goHomeScreen('Profile', { scrollTo: 'goals' }))}
            {row('ribbon-outline', 'Honors', () => goHomeScreen('Honors'), 'PRs & achievements')}

            <Text style={styles.section}>Runs & walks</Text>
            {row('bar-chart-outline', 'Run statistics', () => goHomeScreen('RunStats'), 'Charts, pace, rhythm', colors.primary)}
            {row('analytics-outline', 'Walk statistics', () => goHomeScreen('WalkStats'), 'Averages & totals', colors.secondary)}

            <Text style={styles.section}>Reviews</Text>
            {row('calendar-outline', 'Month & quarter in review', () => goHomeScreen('Reviews'), 'Wrapped summaries', '#7BAFA6')}

            <Text style={styles.section}>Tools</Text>
            {row('barbell-outline', 'Gym', () => goHomeScreen('GymTab'), 'Strength sessions', '#C9907A')}
            {row('scale-outline', 'Weight', () => goHomeScreen('WeightTab'), 'Track weight', '#7BAFA6')}
            {row('footsteps-outline', 'High step days', () => goHomeScreen('StepsTab'), '15k / 20k / 25k days', '#D4BF85')}
            {isAdminUser(user?.email) ? (
              <>
                {row(
                  'watch-outline',
                  'Apple Watch sync',
                  () => goHomeScreen('WatchDiagnostics'),
                  'Diagnostics & queue',
                  '#8C9EC9',
                )}
                {row(
                  'images-outline',
                  'Recover lost photos',
                  () => goHomeScreen('PhotoRecovery'),
                  'From app cache',
                  '#E8A87C',
                )}
              </>
            ) : null}

            <Text style={styles.section}>ZenRun</Text>
            {row('chatbubble-outline', 'Feedback', () => Linking.openURL('https://zenrun.featurebase.app'), 'Tell us what you think')}
            {row('leaf-outline', 'About', () => goHomeScreen('About'), 'The path and the album')}

            <Pressable
              onPress={() =>
                pick(() => {
                  Alert.alert('Log out', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log out', style: 'destructive', onPress: () => void logout() },
                  ]);
                })
              }
              style={styles.dangerRow}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.dangerText}>Log out</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                pick(() => {
                  Alert.alert(
                    'Delete account',
                    'This permanently removes your data. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void deleteAccount(),
                      },
                    ],
                  );
                })
              }
              style={styles.dangerRow}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={styles.dangerText}>Delete account</Text>
            </Pressable>

            <Text style={styles.version}>ZenRun v1.6.0</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: colors.surface,
    paddingTop: 52,
    ...shadows.large,
  },
  scroll: { paddingBottom: spacing.xxl },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  userName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  handle: { fontSize: typography.sizes.sm, color: colors.primary, marginTop: 2 },
  handleMuted: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  section: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.textLight,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text },
  rowSub: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  dangerText: { fontSize: typography.sizes.md, color: colors.error, fontWeight: typography.weights.semibold },
  version: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xl,
  },
});
