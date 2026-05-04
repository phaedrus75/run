/**
 * 🏃 RUN SUMMARY SCREEN
 * =====================
 *
 * Shown after a GPS-tracked outdoor run finishes. The active screen hands
 * us a `sessionId` (already on disk via `photoSession`) — we don't pass
 * heavy photo arrays through navigation params any more.
 *
 * Save flow:
 *   1. Create the run via runApi.
 *   2. Stamp the run id + distance into the photo session manifest so the
 *      uploader can attribute uploads to the right run.
 *   3. Kick the uploader (fire-and-forget — UI doesn't wait).
 *   4. Pop back to the run history.
 *
 * If the run create call fails (auth expired, network down) we enqueue a
 * draft that references the session (no base64 inline). The drainer in
 * pendingPhoneActivities re-tries the create + link on the next launch
 * with valid auth, and the photo uploader picks up where it left off.
 *
 * Photo review: a "Photos (N)" tile that opens the review screen for
 * captioning / deletion before save. Optional — users can save straight
 * through if they want.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { WalkMap } from '../components/WalkMap';
import {
  formatDistanceKm,
  formatDurationHms,
  paceFromDistance,
  encodePolyline,
  TrackedPoint,
} from '../services/walkLocationTracker';
import { runApi } from '../services/api';
import {
  PhotoEntry,
  linkActivityId,
  loadManifest,
  discardSession,
} from '../services/photoSession';
import { drainSession } from '../services/photoUploader';
import { enqueueRunDraft } from '../services/pendingPhoneActivities';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

const RUN_ACCENT = '#F97316';

interface SerialisedSnapshot {
  durationSeconds: number;
  distanceKm: number;
  elevationGainM: number;
  startedAt: number | null;
  points: { lat: number; lng: number; timestamp: number; altitude: number | null }[];
}

interface Props {
  navigation: any;
  route: {
    params?: {
      snapshot?: SerialisedSnapshot;
      sessionId?: string | null;
    };
  };
}

const MOODS = [
  { id: 'strong',     emoji: '💪', label: 'Strong'   },
  { id: 'easy',       emoji: '😌', label: 'Easy'     },
  { id: 'tough',      emoji: '😤', label: 'Tough'    },
  { id: 'zen',        emoji: '🌿', label: 'Zen'      },
];

// GPS-tracked runs have a synthetic run_type derived from actual distance.
function distanceToRunType(km: number): string {
  const buckets = [1, 2, 3, 5, 8, 10, 15, 18, 21];
  for (const b of buckets) {
    if (km <= b + 0.5) return `${b}k`;
  }
  return '21k';
}

export function RunSummaryScreen({ navigation, route }: Props) {
  const snapshot = route?.params?.snapshot;
  const sessionId = route?.params?.sessionId ?? null;
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);

  // Re-read the session whenever this screen gets focus (e.g. coming back
  // from the review screen with caption / delete edits).
  useEffect(() => {
    let cancelled = false;
    const reload = async () => {
      if (!sessionId) {
        setPhotos([]);
        return;
      }
      const m = await loadManifest(sessionId);
      if (cancelled) return;
      setPhotos(m?.photos ?? []);
    };
    void reload();
    const unsub = navigation.addListener('focus', reload);
    return () => { cancelled = true; unsub(); };
  }, [navigation, sessionId]);

  const pace = useMemo(
    () => snapshot ? paceFromDistance(snapshot.durationSeconds, snapshot.distanceKm) : '--:--',
    [snapshot],
  );

  const routePoints = snapshot?.points ?? [];

  const handleSave = async () => {
    if (!snapshot) return;
    setSaving(true);
    try {
      const points = snapshot.points;
      const start = points[0];
      const end = points[points.length - 1];
      const polylineStr = encodePolyline(points as TrackedPoint[]);
      const runType = distanceToRunType(snapshot.distanceKm);

      const savedDistanceKm = Number(snapshot.distanceKm.toFixed(3));

      const run = await runApi.create({
        run_type: runType,
        duration_seconds: Math.max(1, Math.round(snapshot.durationSeconds)),
        distance_km: savedDistanceKm,
        category: 'outdoor',
        started_at: snapshot.startedAt ? new Date(snapshot.startedAt).toISOString() : undefined,
        completed_at: new Date().toISOString(),
        route_polyline: polylineStr || undefined,
        start_lat: start?.lat,
        start_lng: start?.lng,
        end_lat: end?.lat,
        end_lng: end?.lng,
        elevation_gain_m: snapshot.elevationGainM
          ? Number(snapshot.elevationGainM.toFixed(1))
          : undefined,
        notes: note.trim() || undefined,
        mood: mood || undefined,
      });

      // Stamp the manifest so the uploader can attribute photos.
      if (sessionId) {
        await linkActivityId(sessionId, run.id, savedDistanceKm);
        // Kick the uploader for this session immediately. Don't await —
        // the user shouldn't sit here while photos churn over the wire.
        // Failed photos will be retried by the global drainer on next
        // launch.
        void drainSession(sessionId);
      }

      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

      navigation.replace('ActivityHome');
    } catch (e: any) {
      // Save failed before the run was created. The session (with photos
      // safely on disk) becomes a draft that retries from boot.
      const draftId = await enqueueRunDraft({
        snapshot,
        sessionId: sessionId ?? null,
        photos: [],
        mood: mood || undefined,
        note: note.trim() || undefined,
      });
      if (draftId) {
        Alert.alert(
          'Saved as draft',
          `Could not save right now (${e?.message ?? 'unknown error'}). Your run and photos are safe — we'll auto-retry next time you open the app while signed in.`,
          [{ text: 'OK', onPress: () => navigation.replace('ActivityHome') }],
        );
      } else {
        Alert.alert('Could not save run', e?.message ?? 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard run?',
      photos.length > 0
        ? `You will lose this recorded run and ${photos.length} captured photo${photos.length > 1 ? 's' : ''}.`
        : 'You will lose this recorded run.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (sessionId) await discardSession(sessionId);
            navigation.popToTop();
          },
        },
      ],
    );
  };

  const goReviewPhotos = () => {
    if (!sessionId || photos.length === 0) return;
    navigation.navigate('PhotoReview', { sessionId, accentColor: RUN_ACCENT });
  };

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No run to summarise.</Text>
          <Pressable onPress={() => navigation.popToTop()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Great run.</Text>
          <Text style={styles.subtitle}>
            {formatDistanceKm(snapshot.distanceKm)} ·{' '}
            {formatDurationHms(snapshot.durationSeconds)} · {pace} /km
            {photos.length > 0 ? ` · 📸 ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
          </Text>

          <View style={styles.mapWrap}>
            <WalkMap
              style={styles.map}
              route={routePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
              centerOn={routePoints.length > 0 ? { lat: routePoints[0].lat, lng: routePoints[0].lng } : undefined}
              showUserLocation={false}
              routeColor={RUN_ACCENT}
            />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Distance" value={formatDistanceKm(snapshot.distanceKm)} />
            <Stat label="Time"     value={formatDurationHms(snapshot.durationSeconds)} />
            <Stat label="Pace"     value={pace} />
            <Stat label="Elevation" value={`${Math.round(snapshot.elevationGainM || 0)} m`} />
          </View>

          {photos.length > 0 && (
            <Pressable onPress={goReviewPhotos} style={styles.photoSummary}>
              <View style={styles.photoSummaryThumbs}>
                {photos.slice(0, 3).map((p) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.uri }}
                    style={styles.photoSummaryThumb}
                  />
                ))}
                {photos.length > 3 && (
                  <View style={[styles.photoSummaryThumb, styles.photoSummaryMore]}>
                    <Text style={styles.photoSummaryMoreText}>+{photos.length - 3}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoSummaryTitle}>
                  {photos.length} photo{photos.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.photoSummarySubtitle}>
                  Tap to review, caption, or remove
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          )}

          <Text style={styles.section}>How did it feel?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setMood(mood === m.id ? null : m.id);
                }}
                style={({ pressed }) => [
                  styles.moodChip,
                  mood === m.id && styles.moodChipActive,
                  { transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, mood === m.id && styles.moodLabelActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A line about the run…"
            placeholderTextColor={colors.textLight}
            style={styles.noteInput}
            maxLength={300}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={handleDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryBtn,
              saving && { opacity: 0.6 },
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Save run</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  mapWrap: {
    height: 220,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  map: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  photoSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  photoSummaryThumbs: {
    flexDirection: 'row',
  },
  photoSummaryThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceAlt,
  },
  photoSummaryMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RUN_ACCENT + '22',
  },
  photoSummaryMoreText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: RUN_ACCENT,
  },
  photoSummaryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  photoSummarySubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  moodRow: { flexDirection: 'row', gap: spacing.sm },
  moodChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.small,
  },
  moodChipActive: {
    borderColor: RUN_ACCENT,
    backgroundColor: RUN_ACCENT + '15',
  },
  moodEmoji: { fontSize: 22, marginBottom: 2 },
  moodLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  moodLabelActive: { color: RUN_ACCENT, fontWeight: typography.weights.bold },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    color: colors.text,
    fontSize: typography.sizes.sm,
    textAlignVertical: 'top',
    ...shadows.small,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RUN_ACCENT,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadows.small,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  discardBtn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.md },
});
