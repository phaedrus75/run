/**
 * 🌅 JOURNEY ACTIVE CARD
 * =======================
 *
 * Renders a quiet progress card for the user's active Journey on Home.
 * Renders nothing when no journey is active — the surface stays clean
 * until the user opts in.
 *
 * The card states a single number (km accumulated of target), a soft
 * progress bar, and a tap-through to the journey detail screen. It
 * never shouts.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Journey, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  /** Tap handler. The host navigates to the journey detail screen. */
  onPress: (journey: Journey) => void;
  /** Optional refresh tick — bumping this re-fetches active journey. */
  refreshKey?: number;
}

export function JourneyActiveCard({ onPress, refreshKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const j = await journeyApi.getActive();
        if (!cancelled) setJourney(j);
      } catch {
        if (!cancelled) setJourney(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color={colors.textLight} size="small" />
      </View>
    );
  }

  if (!journey) return null;

  const pct = Math.max(0, Math.min(100, journey.progress_percent || 0));
  return (
    <Pressable
      onPress={() => onPress(journey)}
      style={({ pressed }) => [
        styles.card,
        { transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons name="compass-outline" size={14} color={colors.primary} />
        <Text style={styles.label}>Your slow ultra</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{journey.tier}</Text>
        </View>
      </View>
      <Text style={styles.name}>{journey.name}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {journey.accumulated_km.toFixed(1)} of {journey.target_distance_km.toFixed(0)} km
        </Text>
        <Text style={styles.metaTextSecondary}>
          {journey.activity_count} activit{journey.activity_count === 1 ? 'y' : 'ies'}
          {' · '}
          {journey.days_active} day{journey.days_active === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.small,
  },
  cardLoading: {
    backgroundColor: colors.surfaceAlt,
    borderLeftColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  metaTextSecondary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
