/**
 * 📸 PHOTO REVIEW SCREEN
 * ======================
 *
 * The "between" screen that sits between Active and Save (and is also
 * reachable from the run/walk summary photo tile, the run/walk detail
 * screen, and the failed-uploads inbox). Operates on a `photoSession`
 * sessionId — runs and walks share this UI, the session manifest knows
 * which kind it is.
 *
 * Two modes, switched by a small footer toggle:
 *   - **Grid** (default): 3-column thumbnail grid with status dots.
 *     Tap to open detail; long-press for quick delete.
 *   - **Detail**: full-bleed photo, caption editor, distance marker,
 *     delete + retry buttons, archived-to-Photos status.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  ArchiveStatus,
  PhotoEntry,
  UploadStatus,
  loadManifest,
  removePhoto as removeFromSession,
  updatePhoto as updateInSession,
} from '../services/photoSession';
import { retryPhoto } from '../services/photoUploader';
import { photoApi, walkPhotoApi } from '../services/api';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 4;
const GRID_TILE = (SCREEN_W - GRID_GAP * (GRID_COLS + 1)) / GRID_COLS;

interface Props {
  navigation: any;
  route: {
    params?: {
      sessionId?: string;
      accentColor?: string;
      /** When opened from a saved activity's detail screen, the photos
       *  already exist on the server. The screen still operates on the
       *  session manifest if present, but the "save" actions become
       *  caption-update + delete-from-server rather than only-local. */
      activityId?: number;
      activityKind?: 'run' | 'walk';
    };
  };
}

const DEFAULT_ACCENT = '#F97316';

export function PhotoReviewScreen({ navigation, route }: Props) {
  const sessionId = route?.params?.sessionId;
  const accent = route?.params?.accentColor ?? DEFAULT_ACCENT;
  const activityId = route?.params?.activityId;
  const activityKind = route?.params?.activityKind;

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!sessionId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const m = await loadManifest(sessionId);
    setPhotos(m?.photos ?? []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void reload();
    const unsub = navigation.addListener('focus', reload);
    return unsub;
  }, [navigation, reload]);

  const selected = useMemo(
    () => photos.find((p) => p.id === selectedId) ?? null,
    [photos, selectedId],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <ActivityIndicator color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!sessionId || photos.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="Photos" accent={accent} onClose={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={48} color={colors.textLight} />
          <Text style={styles.emptyText}>No photos in this session.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = (entry: PhotoEntry) => {
    Alert.alert(
      'Delete photo?',
      'The photo will be removed from this run. Your camera roll backup is unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
            // If the photo has already been uploaded to the server, also
            // delete it from the server. We do this best-effort — if the
            // server delete fails, we still remove from the local manifest
            // and the next drain will reconcile.
            if (entry.upload.serverPhotoId && activityId && activityKind) {
              try {
                if (activityKind === 'run') {
                  await photoApi.delete(activityId, entry.upload.serverPhotoId);
                } else {
                  await walkPhotoApi.delete(activityId, entry.upload.serverPhotoId);
                }
              } catch {
                // surface but don't block local deletion
              }
            }
            await removeFromSession(sessionId, entry.id);
            setSelectedId(null);
            await reload();
          },
        },
      ],
    );
  };

  const handleSetCaption = async (entry: PhotoEntry, caption: string) => {
    const trimmed = caption.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    await updateInSession(sessionId, entry.id, { caption: next });
    // Push to server if already uploaded.
    if (entry.upload.serverPhotoId && activityId && activityKind) {
      try {
        if (activityKind === 'run') {
          await photoApi.updateCaption(activityId, entry.upload.serverPhotoId, next);
        } else {
          await walkPhotoApi.updateCaption(activityId, entry.upload.serverPhotoId, next);
        }
      } catch {
        // Caption stays local until the next sync — non-fatal.
      }
    }
    await reload();
  };

  const handleRetry = async (entry: PhotoEntry) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    await retryPhoto(sessionId, entry.id);
    await reload();
  };

  if (selected) {
    return (
      <DetailView
        navigation={navigation}
        accent={accent}
        entry={selected}
        index={photos.findIndex((p) => p.id === selected.id)}
        total={photos.length}
        onClose={() => setSelectedId(null)}
        onPrev={() => {
          const idx = photos.findIndex((p) => p.id === selected.id);
          if (idx > 0) setSelectedId(photos[idx - 1].id);
        }}
        onNext={() => {
          const idx = photos.findIndex((p) => p.id === selected.id);
          if (idx < photos.length - 1) setSelectedId(photos[idx + 1].id);
        }}
        onDelete={() => handleDelete(selected)}
        onCaption={(caption) => handleSetCaption(selected, caption)}
        onRetry={() => handleRetry(selected)}
      />
    );
  }

  // Grid view
  const completedUploads = photos.filter((p) => p.upload.status === 'done').length;
  const failedUploads = photos.filter((p) => p.upload.status === 'failed').length;
  const archived = photos.filter((p) => p.archive.status === 'done').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header
        title={`Photos (${photos.length})`}
        accent={accent}
        onClose={() => navigation.goBack()}
      />
      <View style={styles.statusBar}>
        <StatusPill
          icon="cloud-done"
          label={`${completedUploads}/${photos.length} uploaded`}
          color={completedUploads === photos.length ? colors.success : colors.textSecondary}
        />
        <StatusPill
          icon="image"
          label={`${archived}/${photos.length} in Photos`}
          color={archived === photos.length ? colors.success : colors.textSecondary}
        />
        {failedUploads > 0 && (
          <StatusPill
            icon="alert-circle"
            label={`${failedUploads} failed`}
            color={colors.error}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.gridScroll}>
        <View style={styles.grid}>
          {photos.map((entry) => (
            <Pressable
              key={entry.id}
              style={styles.tile}
              onPress={() => setSelectedId(entry.id)}
              onLongPress={() => handleDelete(entry)}
            >
              <Image source={{ uri: entry.uri }} style={styles.tileImage} />
              <View style={styles.tileOverlay}>
                <Text style={styles.tileDist}>{entry.distanceKm.toFixed(1)} km</Text>
                <View style={styles.tileDots}>
                  <Dot status={entry.upload.status} />
                  <ArchiveDot status={entry.archive.status} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.helper}>
          Long-press a photo to delete it. Tap to caption or retry failed
          uploads.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────────────

interface DetailProps {
  navigation: any;
  accent: string;
  entry: PhotoEntry;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
  onCaption: (caption: string) => void;
  onRetry: () => void;
}

function DetailView({
  accent,
  entry,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onDelete,
  onCaption,
  onRetry,
}: DetailProps) {
  const [caption, setCaption] = useState(entry.caption ?? '');

  useEffect(() => {
    setCaption(entry.caption ?? '');
  }, [entry.id, entry.caption]);

  const commitCaption = () => {
    if ((caption || '').trim() === (entry.caption ?? '').trim()) return;
    onCaption(caption);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.detailHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.detailTitle}>
            Photo {index + 1} of {total}
          </Text>
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.detailScroll}>
          <Image source={{ uri: entry.uri }} style={styles.detailImage} />

          <View style={styles.detailMeta}>
            <Text style={styles.detailMetaLabel}>At</Text>
            <Text style={styles.detailMetaValue}>{entry.distanceKm.toFixed(2)} km</Text>
          </View>

          <View style={styles.detailStatuses}>
            <StatusRow
              icon="cloud-upload"
              accent={accent}
              status={entry.upload.status}
              archive={false}
              attempts={entry.upload.attempts}
              error={entry.upload.error}
            />
            <StatusRow
              icon="image"
              accent={accent}
              archive
              archiveStatus={entry.archive.status}
              error={entry.archive.error}
            />
          </View>

          <Text style={styles.detailSection}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            onBlur={commitCaption}
            placeholder="Add a line about this moment…"
            placeholderTextColor={colors.textLight}
            style={styles.captionInput}
            maxLength={200}
            multiline
          />

          {entry.upload.status === 'failed' && (
            <Pressable
              onPress={onRetry}
              style={[styles.retryBtn, { backgroundColor: accent }]}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryText}>Retry upload</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.detailNav}>
          <Pressable
            onPress={onPrev}
            disabled={index === 0}
            style={[styles.detailNavBtn, index === 0 && styles.detailNavBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={onNext}
            disabled={index === total - 1}
            style={[styles.detailNavBtn, index === total - 1 && styles.detailNavBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function Header({ title, accent, onClose }: { title: string; accent: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={10}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function StatusPill({ icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + '40' }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function Dot({ status }: { status: UploadStatus }) {
  const color =
    status === 'done' ? colors.success
      : status === 'failed' ? colors.error
      : status === 'uploading' ? colors.warning
      : colors.textLight;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function ArchiveDot({ status }: { status: ArchiveStatus }) {
  const color =
    status === 'done' ? '#3B82F6'
      : status === 'failed' ? colors.error
      : status === 'denied' ? colors.warning
      : colors.textLight;
  return <View style={[styles.dot, { backgroundColor: color, borderWidth: 1, borderColor: '#fff' }]} />;
}

function StatusRow({
  icon,
  accent,
  status,
  archive,
  archiveStatus,
  attempts,
  error,
}: {
  icon: any;
  accent: string;
  status?: UploadStatus;
  archive?: boolean;
  archiveStatus?: ArchiveStatus;
  attempts?: number;
  error?: string;
}) {
  let label = '';
  let color = colors.textSecondary;
  if (archive) {
    switch (archiveStatus) {
      case 'done': label = 'Saved to Photos'; color = colors.success; break;
      case 'pending': label = 'Saving to Photos…'; color = colors.warning; break;
      case 'denied': label = 'Photos access denied'; color = colors.warning; break;
      case 'failed': label = 'Could not save to Photos'; color = colors.error; break;
      default: label = 'Saved to Photos'; break;
    }
  } else {
    switch (status) {
      case 'done': label = 'Uploaded'; color = colors.success; break;
      case 'pending': label = 'Waiting to upload'; color = colors.textSecondary; break;
      case 'uploading': label = 'Uploading…'; color = accent; break;
      case 'failed':
        label = attempts && attempts >= 12
          ? 'Upload failed (max retries)'
          : `Upload failed${attempts ? ` (attempt ${attempts})` : ''}`;
        color = colors.error;
        break;
    }
  }
  return (
    <View style={styles.statusRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.statusRowText, { color }]}>{label}</Text>
      {error && <Text style={styles.statusRowError} numberOfLines={1}>{error}</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: typography.weights.semibold },
  gridScroll: { paddingHorizontal: GRID_GAP, paddingTop: GRID_GAP, paddingBottom: spacing.xl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: GRID_TILE,
    height: GRID_TILE,
    margin: GRID_GAP / 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  tileImage: { width: '100%', height: '100%' },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tileDist: { color: '#fff', fontSize: 11, fontWeight: typography.weights.semibold },
  tileDots: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  helper: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.md },

  // Detail
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  detailScroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  detailMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  detailMetaLabel: { color: colors.textSecondary, fontSize: typography.sizes.sm },
  detailMetaValue: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  detailStatuses: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.small,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusRowText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  statusRowError: {
    flex: 1,
    fontSize: 11,
    color: colors.textLight,
    marginLeft: 4,
  },
  detailSection: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  captionInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    color: colors.text,
    fontSize: typography.sizes.sm,
    textAlignVertical: 'top',
    ...shadows.small,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  retryText: { color: '#fff', fontWeight: typography.weights.bold, fontSize: typography.sizes.sm },
  detailNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailNavBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailNavBtnDisabled: { opacity: 0.4 },
});
