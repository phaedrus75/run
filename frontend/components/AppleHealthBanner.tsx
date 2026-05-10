/**
 * 🍎 AppleHealthBanner
 * ─────────────────────────────────────────────────────────────────────
 * Small dismissable card that surfaces "X new workouts on your Apple
 * Watch" on screens where the user is browsing their activity history.
 *
 * Why a banner (not a toast or push):
 *  - Toast: too transient — easy to miss, can't action it later.
 *  - Push notification: requires another permission and feels heavy
 *    for what is effectively a UI sync hint.
 *  - Banner stays put until the user dismisses it OR imports the
 *    workouts. It's quiet, opt-in, and shares space with content.
 *
 * Behaviour:
 *  - Hidden on Android / non-iOS.
 *  - Hidden when HK is unavailable (simulator, ancient iOS, etc.).
 *  - Hidden when the user has dismissed it for the same set of
 *    workouts already (we hash the IDs and skip if unchanged).
 *  - Re-checks on screen focus (the user may have just synced their
 *    watch by walking back in range of the phone).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors, radius, spacing, typography, shadows } from '../theme/colors';
import {
  isApplePlatform,
  getAvailability,
  listImportableWorkouts,
} from '../services/appleHealth';

const DISMISS_HASH_KEY = '@zenrun/apple_health_banner_dismissed_hash';

interface Props {
  /** Where this banner is rendered, for analytics + screen-aware
   *  navigation. `activity` lands on the ActivityStack's
   *  `AppleHealthImport`, `home` lands on the HomeStack's. */
  surface?: 'activity' | 'home';
  /** Optional override style applied to the outer container. Useful
   *  when embedding inside cards that already have padding. */
  style?: any;
}

export function AppleHealthBanner({ surface = 'activity', style }: Props) {
  const navigation = useNavigation<any>();
  const [count, setCount] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastChecked = useRef<number>(0);

  // ── Probe HK on mount + re-probe periodically ──────────────────────
  const probe = useCallback(async () => {
    if (!isApplePlatform() || !getAvailability()) return;
    // Throttle: don't hammer HK on every screen focus. 60s is fine —
    // watch syncs typically take a minute or two anyway.
    const now = Date.now();
    if (now - lastChecked.current < 60_000) return;
    lastChecked.current = now;

    try {
      const ws = await listImportableWorkouts({ sinceDays: 30, limit: 30 });
      const ids = ws.map((w) => w.uuid).sort();
      const newHash = ids.join('|');

      // Compare with the user's last dismissal — if they've already
      // said "not now" for this exact set, stay quiet until something
      // new appears.
      const dismissedHash = await AsyncStorage.getItem(DISMISS_HASH_KEY);
      if (dismissedHash && dismissedHash === newHash) {
        setDismissed(true);
        setCount(ws.length);
        setHash(newHash);
        return;
      }

      setDismissed(false);
      setCount(ws.length);
      setHash(newHash);
    } catch {
      // Probe failures are silent — banner just stays hidden.
    }
  }, []);

  useEffect(() => {
    probe();
    // Re-probe when the screen becomes focused again (covers
    // background → foreground after a fresh watch workout).
    const unsub = navigation.addListener?.('focus', () => {
      lastChecked.current = 0; // force a re-probe on focus
      probe();
    });
    return unsub;
  }, [navigation, probe]);

  const onDismiss = useCallback(async () => {
    setDismissed(true);
    if (hash) {
      try {
        await AsyncStorage.setItem(DISMISS_HASH_KEY, hash);
      } catch {}
    }
  }, [hash]);

  const onReview = useCallback(() => {
    navigation.navigate?.('AppleHealthImport');
  }, [navigation]);

  if (!isApplePlatform() || !getAvailability()) return null;
  if (count === 0 || dismissed) return null;

  return (
    <Pressable style={[styles.banner, style]} onPress={onReview}>
      <View style={styles.iconWrap}>
        <Ionicons name="watch" size={20} color={colors.textOnPrimary} />
      </View>
      <View style={styles.copyWrap}>
        <Text style={styles.title}>
          {count} new {count === 1 ? 'workout' : 'workouts'} on your Watch
        </Text>
        <Text style={styles.subtitle}>Tap to review and add to ZenRun</Text>
      </View>
      <Pressable
        hitSlop={12}
        onPress={onDismiss}
        style={styles.dismissBtn}
      >
        <Ionicons name="close" size={18} color={colors.textOnPrimary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadows.small,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  copyWrap: {
    flex: 1,
  },
  title: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  subtitle: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: typography.sizes.xs,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
