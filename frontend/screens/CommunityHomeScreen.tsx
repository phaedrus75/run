/**
 * 👥 COMMUNITY HOME
 * =================
 *
 * Top-level landing for the Community tab. Mirrors `BRAND.md`'s "Two
 * scales of community":
 *   - The Neighbourhood: pseudonymous, location-based, photo-led discovery
 *   - Circles:           private, small, named groups of people you know
 *
 * Neighbourhood: city-level feed (opt-in, @handle, saves, loves).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { AppHeader } from '../components/AppHeader';
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
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>
            Two scales — circles you choose, and the neighbourhood you live in.
          </Text>
        </View>

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
            </View>
            <Text style={styles.cardBody}>
              See scenic runs in your city from fellow zenrunners.{'\n'}
              Save them for later or love the ones that move you.
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
              Share runs, photos, and progress with your friends — small
              private groups, no leaderboards.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </Pressable>

        <View style={styles.strap}>
          <Text style={styles.strapTitle}>The path and the album.</Text>
          <Text style={styles.strapBody}>
            ZenRun is built around places, scenic runs, and walks.
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
