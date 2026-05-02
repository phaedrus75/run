/**
 * RetroactivePhotoPicker
 * ======================
 *
 * Modal for attaching photos from the Photos library to an existing workout.
 *
 * Trigger: "+ Add from library" button in `EditRunModal` / `EditWalkModal`.
 *
 * Flow:
 *   1. Mounting kicks off `findCandidatePhotos` which queries
 *      `expo-media-library` for assets in the workout's [start - 15min,
 *      end + 15min] window. Each candidate is annotated with an estimated
 *      `distance_marker_km` and a `nearRoute` flag.
 *   2. The grid shows thumbnails grouped by "near route" / "in window" /
 *      "wider window" so the user sees their most-likely photos first.
 *   3. Tap a thumbnail to toggle selection.
 *   4. Confirm — the component reads each picked asset, downsizes via
 *      ImageManipulator (matching the in-app capture), and calls the
 *      passed `uploadPhoto` callback for each one. Uses Promise.allSettled
 *      so a single failure doesn't lose successful uploads.
 *   5. On success, call `onComplete(addedCount)` and close.
 *
 * Permission handling: if Photos access is denied, the body shows a
 * single-button empty state directing the user to grant access.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
  Dimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, shadows } from '../theme/colors';
import {
  ensurePhotosPermission,
  findCandidatePhotos,
  readForUpload,
  type CandidatePhoto,
  type RouteForRetroactive,
} from '../services/retroactivePhotos';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = spacing.md;
const COLS = 3;
const TILE_GAP = 4;
const TILE_SIZE = Math.floor(
  (SCREEN_WIDTH - GRID_PADDING * 2 - TILE_GAP * (COLS - 1)) / COLS,
);

export interface RetroactivePhotoPickerProps {
  visible: boolean;
  activity: RouteForRetroactive;
  /**
   * Per-asset upload callback. Implementations dispatch to the right
   * backend endpoint (runs vs walks) and may include the EXIF GPS for
   * walks. Throwing causes the picker to flag that asset as failed but
   * keep the others; resolution is treated as success.
   */
  uploadPhoto: (input: {
    base64: string;
    distanceKm: number;
    lat: number | null;
    lng: number | null;
  }) => Promise<void>;
  onClose: () => void;
  /** Called after all uploads resolve (success or partial). */
  onComplete: (addedCount: number) => void;
}

type Bucket = 'near' | 'window' | 'loose';

interface BucketedCandidate extends CandidatePhoto {
  bucket: Bucket;
}

export function RetroactivePhotoPicker({
  visible,
  activity,
  uploadPhoto,
  onClose,
  onComplete,
}: RetroactivePhotoPickerProps) {
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<BucketedCandidate[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  // Reset every time the modal opens — the workout might be different from
  // the previous open, and we don't want stale candidates from a previous
  // session leaking in.
  useEffect(() => {
    if (!visible) return;
    setCandidates([]);
    setPicked(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const load = async () => {
    setLoading(true);
    try {
      const perm = await ensurePhotosPermission();
      setPermissionState(perm);
      if (perm !== 'granted') {
        return;
      }
      const found = await findCandidatePhotos(activity);
      setCandidates(found.map(bucketize));
    } catch (e) {
      console.warn('retroactive photos: load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    const byBucket: Record<Bucket, BucketedCandidate[]> = { near: [], window: [], loose: [] };
    for (const c of candidates) byBucket[c.bucket].push(c);
    return byBucket;
  }, [candidates]);

  const togglePicked = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (picked.size === 0 || uploading) return;
    setUploading(true);

    const toUpload = candidates.filter((c) => picked.has(c.id));
    const tasks = toUpload.map(async (c) => {
      const { base64 } = await readForUpload(c);
      await uploadPhoto({
        base64,
        distanceKm: c.distanceKm,
        lat: c.lat,
        lng: c.lng,
      });
    });

    const results = await Promise.allSettled(tasks);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    setUploading(false);

    if (failed > 0) {
      Alert.alert(
        'Some photos failed',
        `${succeeded} added · ${failed} could not be uploaded. Try again later.`,
      );
    }
    onComplete(succeeded);
    if (succeeded > 0) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add photos</Text>
          <Pressable
            onPress={handleConfirm}
            hitSlop={12}
            disabled={picked.size === 0 || uploading}
          >
            <Text
              style={[
                styles.headerAction,
                (picked.size === 0 || uploading) && styles.headerActionDisabled,
              ]}
            >
              {uploading ? 'Adding…' : picked.size > 0 ? `Add ${picked.size}` : 'Add'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.centerText}>Looking for photos…</Text>
          </View>
        ) : permissionState === 'denied' ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed" size={48} color={colors.textLight} />
            <Text style={styles.centerTitle}>Photos access needed</Text>
            <Text style={styles.centerText}>
              Allow ZenRun to access your Photos library so we can find shots
              from this workout.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : candidates.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="images-outline" size={48} color={colors.textLight} />
            <Text style={styles.centerTitle}>No photos in this window</Text>
            <Text style={styles.centerText}>
              We searched ±15 minutes around the workout but didn't find any
              photos in your library. Try in-workout capture next time.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {renderGroup('On the route', groups.near)}
            {renderGroup('During the workout', groups.window)}
            {renderGroup('Around the workout', groups.loose)}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  function renderGroup(label: string, items: BucketedCandidate[]) {
    if (items.length === 0) return null;
    return (
      <View style={styles.group} key={label}>
        <Text style={styles.groupTitle}>{label}</Text>
        <View style={styles.grid}>
          {items.map((c) => (
            <PhotoTile
              key={c.id}
              candidate={c}
              selected={picked.has(c.id)}
              onPress={() => togglePicked(c.id)}
            />
          ))}
        </View>
      </View>
    );
  }
}

function bucketize(c: CandidatePhoto): BucketedCandidate {
  let bucket: Bucket = 'loose';
  if (c.nearRoute) bucket = 'near';
  else if (c.withinWorkoutWindow) bucket = 'window';
  return { ...c, bucket };
}

interface PhotoTileProps {
  candidate: BucketedCandidate;
  selected: boolean;
  onPress: () => void;
}

function PhotoTile({ candidate, selected, onPress }: PhotoTileProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, selected && styles.tileSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image source={{ uri: candidate.uri }} style={styles.tileImage} />
      <View style={styles.tileOverlay}>
        <Text style={styles.tileBadge}>
          {candidate.distanceKm >= 1
            ? `${candidate.distanceKm.toFixed(1)} km`
            : `${Math.round(candidate.distanceKm * 1000)} m`}
        </Text>
        {selected ? (
          <View style={styles.tileCheck}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  headerCancel: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  headerAction: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  headerActionDisabled: {
    color: colors.textLight,
  },
  scroll: { paddingVertical: spacing.md, paddingHorizontal: GRID_PADDING },
  group: { marginBottom: spacing.lg },
  groupTitle: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  tileSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  tileImage: { width: '100%', height: '100%' },
  tileOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileBadge: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tileCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  centerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  centerText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
