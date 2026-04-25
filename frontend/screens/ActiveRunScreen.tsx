/**
 * 🏃 ACTIVE RUN SCREEN
 * ====================
 *
 * Live GPS-tracked outdoor run. Mirrors ActiveWalkScreen but uses the
 * runTracker singleton (higher speed ceiling, longer auto-pause window)
 * and an orange accent colour.
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
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

import { WalkMap } from '../components/WalkMap';
import {
  runTracker,
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
import { useActivityPhotoCapture, PendingPhoto } from '../services/useActivityPhotoCapture';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

const RUN_ACCENT = '#F97316'; // orange

interface Props {
  navigation: any;
  route: any;
}

export function ActiveRunScreen({ navigation, route }: Props) {
  const [snapshot, setSnapshot] = useState<WalkSnapshot>(runTracker.getSnapshot());
  const [starting, setStarting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const { pendingPhotos, capturing, capturePhoto } = useActivityPhotoCapture(runTracker);
  const startedOnceRef = useRef(false);

  useEffect(() => {
    const unsub = runTracker.subscribe(setSnapshot);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;
    if (snapshot.isTracking) return;
    void startTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const sub = navigation.addListener('beforeRemove', (e: any) => {
        if (!runTracker.getSnapshot().isTracking) return;
        e.preventDefault();
        Alert.alert(
          'Discard run?',
          'You are still tracking. Leaving will discard this run.',
          [
            { text: 'Keep tracking', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                await runTracker.discard();
                navigation.dispatch(e.data.action);
              },
            },
          ],
        );
      });
      return sub;
    }, [navigation]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void runTracker.drainBackgroundQueue();
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
        const { granted } = await requestAlwaysLocationPermission();
        if (!granted) {
          useBackground = false;
          await setBackgroundTrackingEnabled(false);
        }
      }
      await runTracker.start({ background: useBackground });
    } catch (e: any) {
      setPermissionError(
        e?.message === 'Location permission denied'
          ? 'ZenRun needs location access to track your run on the map.'
          : 'Could not start tracking. Try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const handlePauseResume = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (snapshot.isPaused) runTracker.resume();
    else runTracker.pause();
  };

  const handleFinish = () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    if (snapshot.distanceKm < 0.05) {
      Alert.alert('Run too short', 'Move a little further before saving.');
      return;
    }
    const photoNote = pendingPhotos.length > 0
      ? `\n\n${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''} will be saved with the run.`
      : '';
    Alert.alert('Finish run?', `Save this run?${photoNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await runTracker.discard();
          navigation.goBack();
        },
      },
      {
        text: 'Save',
        onPress: async () => {
          const final = await runTracker.stop();
          navigation.replace('RunSummary', {
            snapshot: serialiseSnapshot(final),
            pendingPhotos,
          });
        },
      },
    ]);
  };

  const lastPoint = snapshot.points.length > 0 ? snapshot.points[snapshot.points.length - 1] : null;
  const center = lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.mapWrap}>
        <WalkMap
          style={styles.map}
          route={snapshot.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          centerOn={center}
          showUserLocation
          routeColor={RUN_ACCENT}
        />
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.typeBadge}>
          <Ionicons name="walk" size={14} color="#fff" />
          <Text style={styles.typeBadgeText}>Outdoor Run</Text>
        </View>
      </View>

      <View style={styles.statsCard}>
        {pendingPhotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            contentContainerStyle={styles.photoStripContent}
          >
            {pendingPhotos.map((p) => (
              <View key={p.capturedAt} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Text style={styles.thumbDist}>{p.distanceKm.toFixed(1)} km</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.statsRow}>
          <Stat label="Distance" value={formatDistanceKm(snapshot.distanceKm)} big />
          <View style={styles.divider} />
          <Stat label="Time" value={formatDurationHms(snapshot.durationSeconds)} big />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Pace" value={`${snapshot.currentPace} /km`} />
          <View style={styles.divider} />
          <Stat
            label="Status"
            value={
              starting ? 'Starting…'
                : !snapshot.isTracking ? (permissionError ? 'Blocked' : 'Idle')
                : snapshot.isPaused ? 'Paused'
                : 'Running'
            }
            color={
              !snapshot.isTracking ? colors.textSecondary
                : snapshot.isPaused ? colors.warning
                : colors.success
            }
          />
        </View>

        {permissionError && <Text style={styles.permissionError}>{permissionError}</Text>}

        <View style={styles.controls}>
          {!snapshot.isTracking ? (
            <Pressable
              onPress={startTracking}
              style={({ pressed }) => [styles.primaryBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Start run</Text>
                </>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={handlePauseResume}
                style={({ pressed }) => [styles.secondaryBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <Ionicons name={snapshot.isPaused ? 'play' : 'pause'} size={20} color={colors.text} />
                <Text style={styles.secondaryBtnText}>{snapshot.isPaused ? 'Resume' : 'Pause'}</Text>
              </Pressable>

              <Pressable
                onPress={capturePhoto}
                disabled={capturing}
                style={({ pressed }) => [
                  styles.cameraBtn,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                  capturing && { opacity: 0.6 },
                ]}
              >
                {capturing ? (
                  <ActivityIndicator color={RUN_ACCENT} size="small" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color={RUN_ACCENT} />
                    {pendingPhotos.length > 0 && (
                      <View style={styles.photoBadge}>
                        <Text style={styles.photoBadgeText}>{pendingPhotos.length}</Text>
                      </View>
                    )}
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={handleFinish}
                style={({ pressed }) => [styles.primaryBtn, styles.finishBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Finish</Text>
              </Pressable>
            </>
          )}
        </View>

        {Platform.OS !== 'ios' && Platform.OS !== 'android' && (
          <Text style={styles.webHint}>Live run tracking requires the iOS or Android app.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, big, color }: { label: string; value: string; big?: boolean; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, big && styles.statValueBig, color ? { color } : null]}>{value}</Text>
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
  typeBadge: {
    position: 'absolute',
    top: spacing.md,
    left: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RUN_ACCENT,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows.small,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    ...shadows.large,
  },
  photoStrip: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.lg,
  },
  photoStripContent: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    flexDirection: 'row',
  },
  thumbWrap: { alignItems: 'center', gap: 3 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  thumbDist: { fontSize: 10, color: colors.textSecondary },
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
  statValueBig: { fontSize: typography.sizes.xxl },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: { width: 1, height: 40, backgroundColor: colors.border },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RUN_ACCENT,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadows.small,
  },
  finishBtn: { flex: 1 },
  primaryBtnText: {
    color: '#fff',
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
  cameraBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: RUN_ACCENT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: RUN_ACCENT + '40',
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RUN_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
