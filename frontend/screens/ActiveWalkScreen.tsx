/**
 * 🚶 ACTIVE WALK SCREEN
 * =====================
 *
 * Live walk tracking screen.
 * - Shows the user's route on a map (expo-maps).
 * - Live distance, duration and pace.
 * - Pause / Resume / Finish controls.
 * - Auto-pause if the user stops moving (handled by walkLocationTracker).
 *
 * On finish, navigates to WalkSummaryScreen with the captured snapshot so the
 * user can add a mood / note / photos before saving.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

import { WalkMap } from '../components/WalkMap';
import {
  walkTracker,
  WalkSnapshot,
  formatDistanceKm,
  formatDurationHms,
  TrackedPoint,
} from '../services/walkLocationTracker';
import {
  getBackgroundTrackingEnabled,
  requestAlwaysLocationPermission,
  setBackgroundTrackingEnabled,
} from '../services/walkBackgroundTask';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
  route: any;
}

export function ActiveWalkScreen({ navigation, route }: Props) {
  const publicWalk = route?.params?.publicWalk; // optional: following a public walk
  const [snapshot, setSnapshot] = useState<WalkSnapshot>(walkTracker.getSnapshot());
  const [starting, setStarting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const startedOnceRef = useRef(false);

  // Subscribe to tracker updates.
  useEffect(() => {
    const unsub = walkTracker.subscribe(setSnapshot);
    return () => unsub();
  }, []);

  // Auto-start tracking on mount if we're not already tracking.
  useEffect(() => {
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;
    if (snapshot.isTracking) return;
    void startTracking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn user if they try to leave with an active walk.
  useFocusEffect(
    React.useCallback(() => {
      const sub = navigation.addListener('beforeRemove', (e: any) => {
        if (!walkTracker.getSnapshot().isTracking) return;
        e.preventDefault();
        Alert.alert(
          'Discard walk?',
          'You are still tracking. Leaving will discard this walk.',
          [
            { text: 'Keep tracking', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                await walkTracker.discard();
                navigation.dispatch(e.data.action);
              },
            },
          ],
        );
      });
      return sub;
    }, [navigation]),
  );

  // Drain any background-collected points whenever the app returns to the
  // foreground. This is the bridge between the headless TaskManager task and
  // the live snapshot the user sees in the UI.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void walkTracker.drainBackgroundQueue();
      }
    });
    return () => sub.remove();
  }, []);

  const startTracking = async () => {
    setStarting(true);
    setPermissionError(null);
    try {
      let useBackground = await getBackgroundTrackingEnabled();
      if (useBackground) {
        // Always permission may have been revoked since opt-in — re-check.
        const { granted } = await requestAlwaysLocationPermission();
        if (!granted) {
          useBackground = false;
          await setBackgroundTrackingEnabled(false);
        }
      }
      await walkTracker.start({ background: useBackground });
      setBackgroundEnabled(useBackground && walkTracker.isBackgroundEnabled());
    } catch (e: any) {
      setPermissionError(
        e?.message === 'Location permission denied'
          ? 'ZenRun needs location access to track your walk on the map.'
          : 'Could not start tracking. Try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const handlePauseResume = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (snapshot.isPaused) walkTracker.resume();
    else walkTracker.pause();
  };

  const handleFinish = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    if (snapshot.distanceKm < 0.05) {
      Alert.alert(
        'Walk too short',
        'You need to move a little before saving. Keep walking and try again.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert('Finish walk?', 'Save this walk?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await walkTracker.discard();
          navigation.goBack();
        },
      },
      {
        text: 'Save',
        onPress: async () => {
          const final = await walkTracker.stop();
          // Navigate to summary, replace so back goes to WalkScreen.
          navigation.replace('WalkSummary', {
            snapshot: serialiseSnapshot(final),
            publicWalkId: publicWalk?.id,
          });
        },
      },
    ]);
  };

  const lastPoint =
    snapshot.points.length > 0
      ? snapshot.points[snapshot.points.length - 1]
      : null;
  const center = lastPoint
    ? { lat: lastPoint.lat, lng: lastPoint.lng }
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.mapWrap}>
        <WalkMap
          style={styles.map}
          route={snapshot.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          centerOn={center}
          showUserLocation
          routeColor={colors.primary}
        />
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        {publicWalk && (
          <View style={styles.publicBadge}>
            <Ionicons name="map" size={14} color={colors.textOnPrimary} />
            <Text style={styles.publicBadgeText} numberOfLines={1}>
              Following: {publicWalk.name}
            </Text>
          </View>
        )}
        {backgroundEnabled && snapshot.isTracking && (
          <View style={[styles.publicBadge, styles.bgBadge, publicWalk && { top: 56 }]}>
            <Ionicons name="moon" size={12} color={colors.textOnPrimary} />
            <Text style={styles.publicBadgeText} numberOfLines={1}>
              Background tracking on
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <Stat
            label="Distance"
            value={formatDistanceKm(snapshot.distanceKm)}
            big
          />
          <View style={styles.divider} />
          <Stat label="Time" value={formatDurationHms(snapshot.durationSeconds)} big />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Pace" value={`${snapshot.currentPace} /km`} />
          <View style={styles.divider} />
          <Stat
            label="Status"
            value={
              starting
                ? 'Starting…'
                : !snapshot.isTracking
                  ? permissionError
                    ? 'Blocked'
                    : 'Idle'
                  : snapshot.isPaused
                    ? 'Paused'
                    : 'Tracking'
            }
            color={
              !snapshot.isTracking
                ? colors.textSecondary
                : snapshot.isPaused
                  ? colors.warning
                  : colors.success
            }
          />
        </View>

        {permissionError && (
          <Text style={styles.permissionError}>{permissionError}</Text>
        )}

        <View style={styles.controls}>
          {!snapshot.isTracking ? (
            <Pressable
              onPress={startTracking}
              style={({ pressed }) => [
                styles.primaryBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="play" size={20} color={colors.textOnPrimary} />
                  <Text style={styles.primaryBtnText}>Start walk</Text>
                </>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={handlePauseResume}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Ionicons
                  name={snapshot.isPaused ? 'play' : 'pause'}
                  size={20}
                  color={colors.text}
                />
                <Text style={styles.secondaryBtnText}>
                  {snapshot.isPaused ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleFinish}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Ionicons name="checkmark" size={20} color={colors.textOnPrimary} />
                <Text style={styles.primaryBtnText}>Finish</Text>
              </Pressable>
            </>
          )}
        </View>

        {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
          <Text style={styles.webHint}>
            Live walk tracking requires the iOS or Android app.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  big,
  color,
}: {
  label: string;
  value: string;
  big?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          big && styles.statValueBig,
          color ? { color } : null,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function serialiseSnapshot(snap: WalkSnapshot) {
  return {
    durationSeconds: snap.durationSeconds,
    distanceKm: snap.distanceKm,
    elevationGainM: snap.elevationGainM,
    startedAt: snap.startedAt,
    points: snap.points.map((p: TrackedPoint) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      altitude: p.altitude ?? null,
    })),
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  publicBadge: {
    position: 'absolute',
    top: spacing.md,
    left: 64,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows.small,
  },
  publicBadgeText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  bgBadge: {
    backgroundColor: colors.text,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    ...shadows.large,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statValueBig: {
    fontSize: typography.sizes.xxl,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadows.small,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  permissionError: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  webHint: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
