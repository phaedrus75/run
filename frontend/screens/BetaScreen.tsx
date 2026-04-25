/**
 * 🧪 BETA SCREEN
 * ==============
 *
 * Hub for beta / power-user features: Circles (social), Gym (strength),
 * Weight tracking, and High Step Days.
 *
 * Keeps the main tab bar clean while still surfacing these features to
 * users who have them enabled (or who want to discover them).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
}

interface FeatureRow {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  description: string;
  screen?: string;
  betaKey?: 'beta_steps_enabled' | 'beta_weight_enabled' | 'beta_gym_enabled';
  alwaysVisible?: boolean;
}

const FEATURES: FeatureRow[] = [
  {
    key: 'circles',
    icon: 'people',
    iconColor: '#8B7EC7',
    label: 'Circles',
    description: 'Run with friends. Weekly streaks, group feed and reactions.',
    screen: 'CirclesList',
    alwaysVisible: true,
  },
  {
    key: 'gym',
    icon: 'barbell',
    iconColor: '#C9907A',
    label: 'Gym',
    description: 'Log strength sessions, track volume progression and PRs.',
    screen: 'HistoryMain',
    betaKey: 'beta_gym_enabled',
  },
  {
    key: 'weight',
    icon: 'scale',
    iconColor: '#7BAFA6',
    label: 'Weight',
    description: 'Track your weight journey toward your goal.',
    screen: 'StatsMain',
    betaKey: 'beta_weight_enabled',
  },
  {
    key: 'steps',
    icon: 'footsteps',
    iconColor: '#D4BF85',
    label: 'High Step Days',
    description: 'Log 15k, 20k or 25k+ step days and build the habit.',
    screen: 'HistoryMain',
    betaKey: 'beta_steps_enabled',
  },
];

export function BetaScreen({ navigation }: Props) {
  const { user } = useAuth();

  const go = useCallback(
    (screen?: string) => {
      if (!screen) return;
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      // Navigate via the parent navigator to the right tab
      navigation.navigate(screen);
    },
    [navigation],
  );

  const enabledFor = (f: FeatureRow) =>
    f.alwaysVisible || (f.betaKey ? !!user?.[f.betaKey] : true);

  const enabled = FEATURES.filter(enabledFor);
  const locked = FEATURES.filter((f) => !enabledFor(f));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Labs</Text>
          <Text style={styles.subtitle}>
            Extra features for the dedicated few.
          </Text>
        </View>

        {enabled.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>AVAILABLE</Text>
            {enabled.map((f) => (
              <FeatureCard key={f.key} feature={f} onPress={() => go(f.screen)} />
            ))}
          </>
        )}

        {locked.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
              COMING SOON
            </Text>
            {locked.map((f) => (
              <FeatureCard key={f.key} feature={f} locked />
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Ionicons name="flask-outline" size={16} color={colors.textLight} />
          <Text style={styles.footerText}>
            Beta features may change. Your feedback shapes what ships next.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({
  feature,
  onPress,
  locked = false,
}: {
  feature: FeatureRow;
  onPress?: () => void;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        locked && styles.cardLocked,
        !locked && pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: locked ? colors.surfaceAlt : feature.iconColor + '22' }]}>
        <Ionicons
          name={feature.icon}
          size={24}
          color={locked ? colors.textLight : feature.iconColor}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardLabel, locked && styles.cardLabelLocked]}>
            {feature.label}
          </Text>
          {locked && (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>Opt-in via Profile</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardDesc}>{feature.description}</Text>
      </View>
      {!locked && (
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  cardLocked: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cardLabelLocked: {
    color: colors.textSecondary,
  },
  lockedBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  cardDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  footerText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    lineHeight: 18,
  },
});
