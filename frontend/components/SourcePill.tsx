/**
 * 🏷  SourcePill
 * ─────────────────────────────────────────────────────────────────────
 * Small badge that signals where a Run / Walk record came from when it
 * wasn't tracked live by ZenRun. Currently used for HealthKit imports
 * ("Apple Health"); extensible to "Manual" or future integrations
 * (Strava, Garmin, etc.) by branching on the source string.
 *
 * The pill is intentionally subtle — calm grey background, single line,
 * sits just under the title or near the stats. We don't want to brand
 * imported runs as "lesser" — they count for stats, journeys, badges
 * just like live runs. The pill only exists for the "where did this
 * come from?" question users naturally ask after an import.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../theme/colors';

interface Props {
  source?: string | null;
  /** Optional override style — useful when sitting alongside other
   *  inline meta. */
  style?: any;
}

export function SourcePill({ source, style }: Props) {
  if (!source || source === 'live') return null;

  let label = 'Imported';
  let icon: keyof typeof Ionicons.glyphMap = 'cloud-download-outline';

  if (source === 'apple_health') {
    label = 'Apple Health';
    icon = 'heart';
  } else if (source === 'manual') {
    label = 'Logged manually';
    icon = 'pencil';
  }

  return (
    <View style={[styles.pill, style]}>
      <Ionicons name={icon} size={12} color={colors.textSecondary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});
