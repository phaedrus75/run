/**
 * 👥 COMMUNITY HOME
 * =================
 *
 * Top-level landing for the Community tab. Mirrors `BRAND.md`'s "Two
 * scales of community":
 *   - The Neighbourhood: pseudonymous, location-based, photo-led discovery
 *   - Circles:           private, small, named groups of people you know
 *
 * For Build 35 only Circles is fully implemented; the Neighbourhood card
 * is a "coming soon" tile that explains the concept. Build 36 ships the
 * proper Neighbourhood feed (proximity, saves, "I ran this" signals).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { getToken } from '../services/auth';
import { API_BASE_URL } from '../services/config';

interface Props {
  navigation: any;
}

export function CommunityHomeScreen({ navigation }: Props) {
  const [circleCount, setCircleCount] = useState<number | null>(null);

  // Lightweight count fetch — full data lives on the Circles screen.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const token = await getToken();
          const res = await fetch(`${API_BASE_URL}/circles`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const list = await res.json();
            if (!cancelled) setCircleCount(Array.isArray(list) ? list.length : 0);
          }
        } catch {
          // non-fatal
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>
            Two scales — circles you choose, and the neighbourhood you live in.
          </Text>
        </View>

        {/* The Neighbourhood — coming soon */}
        <Pressable
          onPress={() => navigation.navigate('Neighbourhood')}
          style={({ pressed }) => [
            styles.card,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#7E57C2' + '18' }]}>
            <Ionicons name="leaf-outline" size={24} color="#7E57C2" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>The Neighbourhood</Text>
              <View style={styles.comingSoonPill}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>
              Pseudonymous album sharing with zenrunners near you.{'\n'}
              See where others have run. Save what inspires you. Rank places,
              never people.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </Pressable>

        {/* Circles — real */}
        <Pressable
          onPress={() => navigation.navigate('CirclesList')}
          style={({ pressed }) => [
            styles.card,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="people" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Circles</Text>
              {circleCount !== null && (
                <Text style={styles.countBadge}>
                  {circleCount} {circleCount === 1 ? 'circle' : 'circles'}
                </Text>
              )}
            </View>
            <Text style={styles.cardBody}>
              Private groups of people you know. Share runs, photos, and
              progress without going public.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </Pressable>

        {/* Brand strap — keeps the tab from feeling sparse before the
            Neighbourhood ships. */}
        <View style={styles.strap}>
          <Text style={styles.strapTitle}>The path and the album.</Text>
          <Text style={styles.strapBody}>
            Community in ZenRun is built around moments and places, not
            metrics or rankings. Where you ran. What you saw. Who you saw it
            with.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cardBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  comingSoonPill: {
    backgroundColor: '#7E57C2' + '22',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: '#7E57C2',
    letterSpacing: 0.5,
  },
  countBadge: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  strap: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  strapTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    fontStyle: 'italic',
  },
  strapBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
});
