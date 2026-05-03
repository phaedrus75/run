/**
 * 🚶 WALK SUMMARY SCREEN
 * ======================
 *
 * Shown right after a walk finishes. Lets the user:
 * - Review distance / time / pace / map
 * - Pick a mood
 * - Add a short note
 * - Save (POST /walks)
 *
 * Photos can be added on the WalkDetailScreen after save.
 *
 * Apple Watch saves use the same walkApi.create path via ../services/watchBridge
 * (registered from App.tsx when the user is authenticated).
 */

import React, { useMemo, useState } from 'react';
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
import { walkApi } from '../services/api';
import {
  PhotoEntry,
  linkActivityId,
  loadManifest,
  discardSession,
} from '../services/photoSession';
import { drainSession } from '../services/photoUploader';
import { enqueueWalkDraft } from '../services/pendingPhoneActivities';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

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
      publicWalkId?: number;
      sessionId?: string | null;
    };
  };
}

const MOODS = [
  { id: 'peaceful', emoji: '🌿', label: 'Peaceful' },
  { id: 'energising', emoji: '⚡', label: 'Energising' },
  { id: 'scenic', emoji: '🌄', label: 'Scenic' },
  { id: 'tough', emoji: '😤', label: 'Tough' },
];

export function WalkSummaryScreen({ navigation, route }: Props) {
  const snapshot = route?.params?.snapshot;
  const publicWalkId = route?.params?.publicWalkId;
  const sessionId = route?.params?.sessionId ?? null;
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);

  React.useEffect(() => {
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
    () =>
      snapshot
        ? paceFromDistance(snapshot.durationSeconds, snapshot.distanceKm)
        : '--:--',
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
      const polyline = encodePolyline(points as TrackedPoint[]);
      const savedDistanceKm = Number(snapshot.distanceKm.toFixed(3));

      const walk = await walkApi.create({
        duration_seconds: Math.max(1, Math.round(snapshot.durationSeconds)),
        distance_km: savedDistanceKm,
        started_at: snapshot.startedAt
          ? new Date(snapshot.startedAt).toISOString()
          : undefined,
        ended_at: new Date().toISOString(),
        route_polyline: polyline || undefined,
        start_lat: start?.lat,
        start_lng: start?.lng,
        end_lat: end?.lat,
        end_lng: end?.lng,
        elevation_gain_m: snapshot.elevationGainM
          ? Number(snapshot.elevationGainM.toFixed(1))
          : undefined,
        notes: note.trim() || undefined,
        mood: mood || undefined,
        category: 'outdoor',
        public_walk_id: publicWalkId,
      });

      if (sessionId) {
        await linkActivityId(sessionId, walk.id, savedDistanceKm);
        // Fire-and-forget — the uploader runs in the background and the
        // user is taken straight to the walk detail.
        void drainSession(sessionId);
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      navigation.replace('WalkDetail', { walkId: walk.id, justSaved: true });
    } catch (e: any) {
      // Save failed mid-flight. Persist as a draft so the walk is not lost —
      // `drainPendingPhoneActivities` retries on the next auth-ready boot.
      // Photos are already on disk in the photo session; the draft only
      // needs to remember the sessionId.
      const draftId = await enqueueWalkDraft({
        snapshot,
        sessionId: sessionId ?? null,
        photos: [],
        mood: mood || undefined,
        note: note.trim() || undefined,
        publicWalkId,
      });
      if (draftId) {
        Alert.alert(
          'Saved as draft',
          `Could not save right now (${e?.message ?? 'unknown error'}). Your walk and photos are safe — we'll auto-retry next time you open the app while signed in.`,
          [{ text: 'OK', onPress: () => navigation.popToTop() }],
        );
      } else {
        Alert.alert('Could not save walk', e?.message ?? 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard walk?',
      photos.length > 0
        ? `You will lose this recorded walk and ${photos.length} captured photo${photos.length > 1 ? 's' : ''}.`
        : 'You will lose this recorded walk.',
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
    navigation.navigate('PhotoReview', { sessionId, accentColor: '#10B981' });
  };

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No walk to summarise.</Text>
          <Pressable
            onPress={() => navigation.popToTop()}
            style={styles.primaryBtn}
          >
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
          <Text style={styles.title}>Nice walk.</Text>
          <Text style={styles.subtitle}>
            {formatDistanceKm(snapshot.distanceKm)} ·{' '}
            {formatDurationHms(snapshot.durationSeconds)} · {pace} /km
            {photos.length > 0 ? ` · 📸 ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
          </Text>

          <View style={styles.mapWrap}>
            <WalkMap
              style={styles.map}
              route={routePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
              centerOn={
                routePoints.length > 0
                  ? { lat: routePoints[0].lat, lng: routePoints[0].lng }
                  : undefined
              }
              showUserLocation={false}
            />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Distance" value={formatDistanceKm(snapshot.distanceKm)} />
            <Stat label="Time" value={formatDurationHms(snapshot.durationSeconds)} />
            <Stat label="Pace" value={`${pace}`} />
            <Stat
              label="Elevation"
              value={`${Math.round(snapshot.elevationGainM || 0)} m`}
            />
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
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setMood(mood === m.id ? null : m.id);
                }}
                style={({ pressed }) => [
                  styles.moodChip,
                  mood === m.id && styles.moodChipActive,
                  { transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    mood === m.id && styles.moodLabelActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A line about the walk…"
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
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.textOnPrimary} />
                <Text style={styles.primaryBtnText}>Save walk</Text>
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
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
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
  photoSummaryThumbs: { flexDirection: 'row' },
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
    backgroundColor: '#10B981' + '22',
  },
  photoSummaryMoreText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#10B981',
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
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  moodEmoji: { fontSize: 22, marginBottom: 2 },
  moodLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  moodLabelActive: { color: colors.primary, fontWeight: typography.weights.bold },
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
});
