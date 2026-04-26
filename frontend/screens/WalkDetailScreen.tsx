/**
 * 🚶 WALK DETAIL SCREEN
 * =====================
 *
 * Shows a saved walk: route on a map, headline stats, mood, notes, photos.
 * Lets the user add scenic photos pinned to their location along the route,
 * delete photos and edit notes/mood via EditWalkModal.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

import { WalkMap, MapMarker } from '../components/WalkMap';
import { EditWalkModal } from '../components/EditWalkModal';
import {
  walkApi,
  walkPhotoApi,
  Walk,
  WalkPhoto,
} from '../services/api';
import {
  decodePolyline,
  formatDistanceKm,
  formatDurationHms,
  haversineMeters,
  paceFromDistance,
} from '../services/walkLocationTracker';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
  route: { params?: { walkId?: number; justSaved?: boolean } };
}

export function WalkDetailScreen({ navigation, route }: Props) {
  const walkId = route?.params?.walkId;
  const justSaved = route?.params?.justSaved;
  const [walk, setWalk] = useState<Walk | null>(null);
  const [photos, setPhotos] = useState<WalkPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  // Photo capture flow state
  const [photoStep, setPhotoStep] = useState<'idle' | 'caption'>('idle');
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<WalkPhoto | null>(null);

  // Full-screen map
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const load = useCallback(async () => {
    if (!walkId) return;
    setLoading(true);
    try {
      const [w, p] = await Promise.all([
        walkApi.get(walkId),
        walkPhotoApi.getForWalk(walkId).catch(() => []),
      ]);
      setWalk(w);
      setPhotos(p);
    } catch (e: any) {
      Alert.alert('Could not load walk', e?.message ?? 'Try again later.');
    } finally {
      setLoading(false);
    }
  }, [walkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const routePoints = useMemo(
    () => (walk?.route_polyline ? decodePolyline(walk.route_polyline) : []),
    [walk?.route_polyline],
  );

  const center =
    walk?.start_lat && walk?.start_lng
      ? { lat: walk.start_lat, lng: walk.start_lng }
      : routePoints[0];

  const photoMarkers: MapMarker[] = photos
    .filter((p) => p.lat != null && p.lng != null)
    .map((p, idx) => ({
      id: `photo-${p.id}`,
      lat: p.lat as number,
      lng: p.lng as number,
      title: p.caption ?? `Photo ${idx + 1}`,
      tintColor: colors.accent,
    }));

  /** Compute center + zoom that fits all route points in one view. */
  const routeCamera = useMemo(() => {
    if (!routePoints.length) {
      return center ? { center, zoom: 15 } : null;
    }
    const lats = routePoints.map((p) => p.lat);
    const lngs = routePoints.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const span = Math.max(maxLat - minLat, maxLng - minLng);
    let zoom = 15;
    if (span > 0.008) zoom = 14;
    if (span > 0.02) zoom = 13;
    if (span > 0.05) zoom = 12;
    if (span > 0.12) zoom = 11;
    if (span > 0.3) zoom = 10;
    return { center: { lat: centerLat, lng: centerLng }, zoom };
  }, [routePoints, center]);

  /**
   * Snap an arbitrary lat/lng to the nearest point along the route, returning
   * both the matched point and the distance from start in km.
   */
  const snapToRoute = (lat: number, lng: number) => {
    if (!routePoints.length) return null;
    let best = { idx: 0, dist: Infinity };
    routePoints.forEach((p, idx) => {
      const d = haversineMeters({ lat, lng }, p);
      if (d < best.dist) best = { idx, dist: d };
    });
    let cumulative = 0;
    for (let i = 1; i <= best.idx; i += 1) {
      cumulative += haversineMeters(routePoints[i - 1], routePoints[i]);
    }
    return {
      lat: routePoints[best.idx].lat,
      lng: routePoints[best.idx].lng,
      distance_marker_km: cumulative / 1000,
    };
  };

  const startPhotoFlow = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'ZenRun needs permission to attach photos to this walk.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    setPendingUri(manipulated.uri);
    setPendingBase64(manipulated.base64 ?? null);
    setPhotoStep('caption');
  };

  const cancelPhotoFlow = () => {
    setPhotoStep('idle');
    setPendingUri(null);
    setPendingBase64(null);
    setPendingCaption('');
  };

  const uploadPhoto = async () => {
    if (!walk || !pendingBase64) return;
    setUploading(true);
    try {
      const lastPoint =
        routePoints.length > 0 ? routePoints[routePoints.length - 1] : null;
      const snap =
        lastPoint != null
          ? snapToRoute(lastPoint.lat, lastPoint.lng)
          : null;
      const photo = await walkPhotoApi.upload(walk.id, {
        photo_data: pendingBase64,
        lat: snap?.lat ?? walk.end_lat ?? walk.start_lat ?? undefined,
        lng: snap?.lng ?? walk.end_lng ?? walk.start_lng ?? undefined,
        distance_marker_km: snap?.distance_marker_km,
        caption: pendingCaption.trim() || undefined,
      });
      setPhotos((prev) => [...prev, photo]);
      cancelPhotoFlow();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = (photo: WalkPhoto) => {
    if (!walk) return;
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await walkPhotoApi.delete(walk.id, photo.id);
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
            setLightbox(null);
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!walk) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Walk not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const startedAt = walk.started_at ? new Date(walk.started_at) : null;
  const dateLabel = startedAt
    ? startedAt.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const timeLabel = startedAt
    ? startedAt.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  const pace = paceFromDistance(walk.duration_seconds, walk.distance_km);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {dateLabel || 'Walk'}
        </Text>
        <Pressable onPress={() => setEditVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {justSaved && (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.savedText}>Walk saved</Text>
          </View>
        )}

        <Pressable style={styles.mapWrap} onPress={() => setMapFullscreen(true)}>
          <WalkMap
            style={styles.map}
            route={routePoints}
            markers={photoMarkers}
            centerOn={routeCamera?.center ?? center}
            zoom={routeCamera?.zoom ?? 15}
            showUserLocation={false}
          />
          <View style={styles.mapExpandHint}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </Pressable>

        {/* Full-screen map modal */}
        <Modal visible={mapFullscreen} animationType="slide" onRequestClose={() => setMapFullscreen(false)}>
          <View style={styles.mapFullContainer}>
            <WalkMap
              style={StyleSheet.absoluteFill}
              route={routePoints}
              markers={photoMarkers}
              centerOn={routeCamera?.center ?? center}
              zoom={routeCamera?.zoom ?? 15}
              showUserLocation={false}
            />
            <Pressable
              style={styles.mapFullClose}
              onPress={() => setMapFullscreen(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
        </Modal>

        <View style={styles.statsRow}>
          <Stat label="Distance" value={formatDistanceKm(walk.distance_km)} />
          <Stat label="Time" value={formatDurationHms(walk.duration_seconds)} />
          <Stat label="Pace" value={`${pace} /km`} />
          {walk.elevation_gain_m != null && (
            <Stat label="Elev." value={`${Math.round(walk.elevation_gain_m)} m`} />
          )}
        </View>

        <View style={styles.metaRow}>
          {timeLabel ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{timeLabel}</Text>
            </View>
          ) : null}
          {walk.mood ? (
            <View style={styles.metaItem}>
              <Ionicons name="happy-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{walk.mood}</Text>
            </View>
          ) : null}
          {walk.category ? (
            <View style={styles.metaItem}>
              <Ionicons name="leaf-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{walk.category}</Text>
            </View>
          ) : null}
        </View>

        {walk.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{walk.notes}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionHint}>
              {photos.length === 0
                ? 'Add scenic photos to remember this walk'
                : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setLightbox(p)}
                style={styles.photoTile}
              >
                <Image
                  source={{
                    uri: p.photo_data.startsWith('data:')
                      ? p.photo_data
                      : `data:image/jpeg;base64,${p.photo_data}`,
                  }}
                  style={styles.photoImage}
                />
                {p.caption ? (
                  <Text style={styles.photoCaption} numberOfLines={2}>
                    {p.caption}
                  </Text>
                ) : null}
                {p.distance_marker_km != null ? (
                  <Text style={styles.photoMarker}>
                    {p.distance_marker_km.toFixed(2)} km
                  </Text>
                ) : null}
              </Pressable>
            ))}

            <Pressable onPress={startPhotoFlow} style={styles.addPhotoTile}>
              <Ionicons name="add" size={28} color={colors.primary} />
              <Text style={styles.addPhotoText}>Add photo</Text>
            </Pressable>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Caption modal for new photo */}
      <Modal
        visible={photoStep === 'caption'}
        transparent
        animationType="slide"
        onRequestClose={cancelPhotoFlow}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={cancelPhotoFlow} />
          <View style={styles.captionSheet}>
            {pendingUri && (
              <Image source={{ uri: pendingUri }} style={styles.captionPreview} />
            )}
            <TextInput
              value={pendingCaption}
              onChangeText={setPendingCaption}
              placeholder="Caption (optional)"
              placeholderTextColor={colors.textLight}
              style={styles.captionInput}
              maxLength={120}
              autoFocus
            />
            <View style={styles.captionRow}>
              <Pressable onPress={cancelPhotoFlow} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={uploadPhoto}
                disabled={uploading}
                style={({ pressed }) => [
                  styles.saveBtn,
                  uploading && { opacity: 0.6 },
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.saveBtnText}>Save photo</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lightbox */}
      <Modal
        visible={!!lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <View style={styles.lightboxOverlay}>
          {lightbox && (
            <>
              <Image
                source={{
                  uri: lightbox.photo_data.startsWith('data:')
                    ? lightbox.photo_data
                    : `data:image/jpeg;base64,${lightbox.photo_data}`,
                }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              {lightbox.caption ? (
                <Text style={styles.lightboxCaption}>{lightbox.caption}</Text>
              ) : null}
              <View style={styles.lightboxControls}>
                <TouchableOpacity
                  onPress={() => setLightbox(null)}
                  style={styles.lightboxBtn}
                >
                  <Ionicons name="close" size={22} color={colors.textOnPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deletePhoto(lightbox)}
                  style={[styles.lightboxBtn, { backgroundColor: colors.error }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      <EditWalkModal
        visible={editVisible}
        walk={walk}
        onClose={() => setEditVisible(false)}
        onSaved={(updated) => setWalk(updated)}
        onDeleted={() => navigation.popToTop()}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.success + '20',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  savedText: {
    color: colors.success,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  mapWrap: {
    height: 300,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  map: { flex: 1 },
  mapExpandHint: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFullContainer: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  mapFullClose: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  notesText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoTile: {
    width: 140,
    marginRight: spacing.sm,
  },
  photoImage: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  photoCaption: {
    marginTop: 4,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  photoMarker: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textLight,
    fontWeight: typography.weights.semibold,
  },
  addPhotoTile: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  captionSheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  captionPreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  captionInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  captionRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '70%',
  },
  lightboxCaption: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  lightboxControls: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  lightboxBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
