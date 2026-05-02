/**
 * PhotoRecoveryScreen
 * ===================
 *
 * Last-resort recovery UI for in-run photos that didn't make it to the user's
 * Photos library because the Build 29 backup feature silently failed when the
 * over-broad full-library permission was declined.
 *
 * Surfaces orphaned image files from the app's cache directories with their
 * on-disk timestamps, lets the user multi-select, and saves them to Photos via
 * write-only permission.
 *
 * Lives under Labs → "Recover Lost Photos".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  scanOrphanedPhotos,
  saveRecoveredPhotos,
  formatTotalSize,
  type RecoverablePhoto,
  type ScanResult,
} from '../services/photoRecovery';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
}

const TILE_SIZE = 96;

export function PhotoRecoveryScreen({ navigation }: Props) {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setResult(null);
    setSelected(new Set());
    try {
      const r = await scanOrphanedPhotos();
      setResult(r);
      // Default: all photos selected so the user can save with one tap
      setSelected(new Set(r.photos.map((p) => p.uri)));
    } catch (e) {
      Alert.alert('Scan failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const photos = result?.photos ?? [];
  const selectedPhotos = useMemo(
    () => photos.filter((p) => selected.has(p.uri)),
    [photos, selected],
  );

  const toggle = (uri: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(photos.map((p) => p.uri)));
  const selectNone = () => setSelected(new Set());

  const onSave = async () => {
    if (selectedPhotos.length === 0) return;
    setSaving(true);
    try {
      const r = await saveRecoveredPhotos(selectedPhotos);
      if (r.saved > 0 && r.failed === 0) {
        Alert.alert(
          'Photos saved',
          `${r.saved} photo${r.saved > 1 ? 's' : ''} saved to your Photos library (look in the ZenRun album or Recents).`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else if (r.saved > 0 && r.failed > 0) {
        Alert.alert(
          'Partial success',
          `${r.saved} saved, ${r.failed} could not be saved. The successful ones are in your Photos library now.`,
        );
        await runScan();
      } else if (r.failed > 0) {
        const detail = r.errors[0]?.includes('Permission')
          ? 'Photos access is required. Tap "Open Settings" to grant "Add Photos Only".'
          : r.errors.slice(0, 3).join('\n');
        Alert.alert('Could not save photos', detail, [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Nothing to save', 'No photos were selected.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Recover Lost Photos</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>What this is</Text>
          <Text style={styles.introBody}>
            Some in-run photos may not have made it to your Photos library because
            of a permission scope bug we shipped earlier. This screen scans the
            app's cache for those originals and lets you save them now. iOS may
            have already cleaned some of them up — recovery is best-effort and
            time-sensitive.
          </Text>
        </View>

        {scanning ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Scanning cache…</Text>
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="archive-outline"
              size={48}
              color={colors.textLight}
            />
            <Text style={styles.emptyTitle}>No orphaned photos found</Text>
            <Text style={styles.muted}>
              Either everything is already in your Photos library, or iOS has
              already swept the cache. Going forward, the new permission flow
              (Build 32+) will save originals automatically.
            </Text>
            <Pressable onPress={runScan} style={styles.secondaryBtn}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>Scan again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {photos.length} photo{photos.length > 1 ? 's' : ''} found ·{' '}
                {formatTotalSize(photos)}
              </Text>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAll} hitSlop={6}>
                  <Text style={styles.linkText}>All</Text>
                </Pressable>
                <Text style={styles.muted}>·</Text>
                <Pressable onPress={selectNone} hitSlop={6}>
                  <Text style={styles.linkText}>None</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.grid}>
              {photos.map((p) => (
                <PhotoTile
                  key={p.uri}
                  photo={p}
                  selected={selected.has(p.uri)}
                  onPress={() => toggle(p.uri)}
                />
              ))}
            </View>
          </>
        )}

        {result && result.scannedDirs.length > 0 && (
          <View style={styles.diag}>
            <Text style={styles.diagLabel}>Scanned</Text>
            {result.scannedDirs.map((d) => (
              <Text key={d} style={styles.diagPath} numberOfLines={1}>
                {d}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {photos.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            onPress={onSave}
            disabled={saving || selectedPhotos.length === 0}
            style={({ pressed }) => [
              styles.primaryBtn,
              (saving || selectedPhotos.length === 0) && { opacity: 0.6 },
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Save {selectedPhotos.length || ''} to Photos
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function PhotoTile({
  photo,
  selected,
  onPress,
}: {
  photo: RecoverablePhoto;
  selected: boolean;
  onPress: () => void;
}) {
  const dateLabel = useMemo(() => {
    if (!photo.modificationTime) return '';
    const d = new Date(photo.modificationTime * 1000);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [photo.modificationTime]);

  return (
    <Pressable onPress={onPress} style={styles.tileWrap}>
      <View style={styles.tile}>
        <Image source={{ uri: photo.uri }} style={styles.tileImg} />
        {selected && (
          <View style={styles.tileSelected}>
            <Ionicons name="checkmark-circle" size={26} color="#fff" />
          </View>
        )}
      </View>
      {dateLabel ? <Text style={styles.tileMeta}>{dateLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  intro: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  introTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  introBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  muted: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statsText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  selectActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  linkText: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tileWrap: { width: TILE_SIZE, alignItems: 'center' },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },
  tileSelected: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 144, 226, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  diag: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  diagLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  diagPath: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'Courier',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
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
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
