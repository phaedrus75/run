/**
 * ✏️ EDIT RUN MODAL
 * ==================
 * 
 * A modal for editing past runs.
 * Outdoor runs can add/view/delete scenic photos tagged to distance markers.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { RunTypeButton } from './RunTypeButton';
import { WalkMap } from './WalkMap';
import { photoApi, levelApi, type Run, type RunPhoto } from '../services/api';
import { decodePolyline } from '../services/walkLocationTracker';

const ALL_RUN_TYPES = ['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'];

interface EditRunModalProps {
  visible: boolean;
  run: Run | null;
  onClose: () => void;
  onSave: (id: number, data: { run_type?: string; duration_seconds?: number; notes?: string; category?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function EditRunModal({ visible, run, onClose, onSave, onDelete }: EditRunModalProps) {
  const [availableTypes, setAvailableTypes] = useState<string[]>(ALL_RUN_TYPES);
  const [runType, setRunType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('outdoor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      levelApi.get().then(data => {
        if (data?.distances) setAvailableTypes(data.distances);
      }).catch(() => {});
    }
  }, [visible]);

  // Scenic photo state
  const [photos, setPhotos] = useState<RunPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoStep, setPhotoStep] = useState<'idle' | 'marker' | 'caption'>('idle');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const [pendingMarker, setPendingMarker] = useState<number | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<RunPhoto | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const routePoints = useMemo(
    () => (run?.route_polyline ? decodePolyline(run.route_polyline) : []),
    [run?.route_polyline],
  );

  /** Center + zoom that fits the whole route on screen. */
  const routeCamera = useMemo(() => {
    if (routePoints.length === 0) return null;
    const lats = routePoints.map((p) => p.lat);
    const lngs = routePoints.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const span = Math.max(maxLat - minLat, maxLng - minLng);
    let zoom = 15;
    if (span > 0.008) zoom = 14;
    if (span > 0.02) zoom = 13;
    if (span > 0.05) zoom = 12;
    if (span > 0.12) zoom = 11;
    if (span > 0.3) zoom = 10;
    return {
      center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
      zoom,
    };
  }, [routePoints]);

  useEffect(() => {
    if (run) {
      setRunType(run.run_type);
      const mins = Math.floor(run.duration_seconds / 60);
      const secs = run.duration_seconds % 60;
      setMinutes(mins.toString());
      setSeconds(secs.toString());
      setNotes(run.notes || '');
      setCategory(run.category || 'outdoor');
      resetPhotoFlow();
    }
  }, [run]);

  useEffect(() => {
    if (visible && run && (run.category || 'outdoor') === 'outdoor') {
      fetchPhotos();
    }
  }, [visible, run]);

  const fetchPhotos = async () => {
    if (!run) return;
    setLoadingPhotos(true);
    try {
      // Fetch full photo data so we can actually render thumbnails. The previous
      // `thumbnails_only: true` was a half-finished optimization — the server omitted
      // photo_data but the UI never rendered an <Image>, so every photo appeared as a
      // text-only placeholder ("📍2.347K") and looked corrupted to the user.
      const data = await photoApi.getForRun(run.id);
      setPhotos(data);
    } catch {
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const resetPhotoFlow = () => {
    setPhotoStep('idle');
    setPendingPhotoUri(null);
    setPendingPhotoBase64(null);
    setPendingMarker(null);
    setPendingCaption('');
  };

  const getDistanceMarkers = (): number[] => {
    if (!run) return [];
    const markers: number[] = [];
    for (let km = 1; km <= run.distance_km; km++) {
      markers.push(km);
    }
    return markers;
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setPendingPhotoUri(manipulated.uri);
      setPendingPhotoBase64(manipulated.base64 || null);
      setPhotoStep('marker');
    }
  };

  const handleSelectMarker = (km: number) => {
    setPendingMarker(km);
    setPhotoStep('caption');
  };

  const handleUploadPhoto = async () => {
    if (!run || !pendingPhotoBase64 || !pendingMarker) return;
    setUploading(true);
    try {
      await photoApi.upload(run.id, {
        photo_data: pendingPhotoBase64,
        distance_marker_km: pendingMarker,
        caption: pendingCaption.trim() || undefined,
      });
      resetPhotoFlow();
      fetchPhotos();
    } catch {
      Alert.alert('Upload Failed', 'Could not upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (!run) return;
    Alert.alert('Delete Photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await photoApi.delete(run.id, photoId);
            setPhotos(prev => prev.filter(p => p.id !== photoId));
          } catch {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!run) return;
    setSaving(true);
    try {
      const durationSeconds = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
      await onSave(run.id, {
        run_type: runType,
        duration_seconds: durationSeconds,
        notes: notes || undefined,
        category: category,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!run) return;
    Alert.alert(
      'Delete Run?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(run.id);
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete run');
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    resetPhotoFlow();
    onClose();
  };

  if (!run) return null;

  const isOutdoor = category === 'outdoor';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Run</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Route map (outdoor GPS-tracked runs only) */}
          {isOutdoor && routePoints.length > 0 && routeCamera && (
            <Pressable
              style={styles.mapWrap}
              onPress={() => setMapFullscreen(true)}
            >
              <WalkMap
                style={styles.map}
                route={routePoints}
                centerOn={routeCamera.center}
                zoom={routeCamera.zoom}
                showUserLocation={false}
                routeColor="#F97316"
              />
              <View style={styles.mapExpandHint}>
                <Text style={styles.mapExpandHintText}>⤢</Text>
              </View>
            </Pressable>
          )}

          {/* Run Type Selection */}
          <Text style={styles.label}>Distance</Text>
          <View style={styles.typeRow}>
            {availableTypes.map(type => (
              <RunTypeButton
                key={type}
                type={type}
                size="small"
                selected={runType === type}
                onPress={() => setRunType(type)}
              />
            ))}
          </View>

          {/* Duration */}
          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <TextInput
                style={styles.input}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                placeholder="0"
                maxLength={3}
              />
              <Text style={styles.durationLabel}>min</Text>
            </View>
            <Text style={styles.colon}>:</Text>
            <View style={styles.durationInput}>
              <TextInput
                style={styles.input}
                value={seconds}
                onChangeText={setSeconds}
                keyboardType="number-pad"
                placeholder="00"
                maxLength={2}
              />
              <Text style={styles.durationLabel}>sec</Text>
            </View>
          </View>

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.categoryButton, category === 'outdoor' && styles.categoryButtonActive]}
              onPress={() => setCategory('outdoor')}
            >
              <Text style={styles.categoryEmoji}>🌳</Text>
              <Text style={[styles.categoryText, category === 'outdoor' && styles.categoryTextActive]}>Outdoor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, category === 'treadmill' && styles.categoryButtonActive]}
              onPress={() => setCategory('treadmill')}
            >
              <Text style={styles.categoryEmoji}>🏃</Text>
              <Text style={[styles.categoryText, category === 'treadmill' && styles.categoryTextActive]}>Treadmill</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did the run feel?"
            multiline
            numberOfLines={3}
          />

          {/* Scenic Photos - outdoor only */}
          {isOutdoor && (
            <View style={styles.photosSection}>
              <Text style={styles.label}>📸 Scenic Photos</Text>

              {loadingPhotos ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
              ) : (
                <>
                  {/* Existing photos */}
                  {photos.length > 0 && (
                    <View style={styles.photosGrid}>
                      {photos.map((photo) => {
                        const km = Math.round(photo.distance_marker_km * 10) / 10;
                        return (
                          <View key={photo.id} style={styles.photoThumbWrap}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => setLightboxPhoto(photo)}
                              style={styles.photoThumb}
                            >
                              {photo.photo_data ? (
                                <Image
                                  source={{ uri: `data:image/jpeg;base64,${photo.photo_data}` }}
                                  style={styles.photoThumbImage}
                                />
                              ) : (
                                <View style={[styles.photoThumbImage, styles.photoThumbPlaceholder]}>
                                  <Text style={styles.photoThumbPlaceholderText}>📍{km}K</Text>
                                </View>
                              )}
                              <View style={styles.photoMarkerBadge}>
                                <Text style={styles.photoMarkerBadgeText}>{km}K</Text>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoDeleteBtn}
                              onPress={() => handleDeletePhoto(photo.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.photoDeleteText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Photo flow: idle -> pick -> marker -> caption -> upload */}
                  {photoStep === 'idle' && (
                    <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
                      <Text style={styles.addPhotoBtnText}>
                        {photos.length > 0 ? '+ Add another photo' : '+ Add a scenic photo'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {photoStep === 'marker' && pendingPhotoUri && (
                    <View style={styles.flowSection}>
                      <Image source={{ uri: pendingPhotoUri }} style={styles.previewImage} />
                      <Text style={styles.flowLabel}>Where was this taken?</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.markerRow}>
                          {getDistanceMarkers().map(km => (
                            <TouchableOpacity
                              key={km}
                              style={[styles.markerChip, pendingMarker === km && styles.markerChipActive]}
                              onPress={() => handleSelectMarker(km)}
                            >
                              <Text style={[styles.markerChipText, pendingMarker === km && styles.markerChipTextActive]}>
                                {km}K
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <TouchableOpacity style={styles.flowCancelBtn} onPress={resetPhotoFlow}>
                        <Text style={styles.flowCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {photoStep === 'caption' && pendingPhotoUri && (
                    <View style={styles.flowSection}>
                      <View style={styles.captionRow}>
                        <Image source={{ uri: pendingPhotoUri }} style={styles.previewSmall} />
                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                          <Text style={styles.captionMarkerTag}>📍 At the {pendingMarker}K mark</Text>
                          <TextInput
                            style={styles.captionInput}
                            placeholder="Caption (optional)"
                            placeholderTextColor={colors.textLight}
                            value={pendingCaption}
                            onChangeText={setPendingCaption}
                            maxLength={80}
                            returnKeyType="done"
                          />
                        </View>
                      </View>
                      <View style={styles.flowButtons}>
                        <TouchableOpacity style={styles.flowCancelBtn} onPress={resetPhotoFlow}>
                          <Text style={styles.flowCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={handleUploadPhoto}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <ActivityIndicator size="small" color={colors.textOnPrimary} />
                          ) : (
                            <Text style={styles.uploadBtnText}>Save photo</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Delete Button */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>🗑️ Delete Run</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Full-screen map */}
        <Modal
          visible={mapFullscreen}
          animationType="slide"
          onRequestClose={() => setMapFullscreen(false)}
        >
          <View style={styles.mapFullContainer}>
            {routeCamera && (
              <WalkMap
                style={StyleSheet.absoluteFill}
                route={routePoints}
                centerOn={routeCamera.center}
                zoom={routeCamera.zoom}
                showUserLocation={false}
                routeColor="#F97316"
              />
            )}
            <Pressable
              style={styles.mapFullClose}
              onPress={() => setMapFullscreen(false)}
              hitSlop={12}
            >
              <Text style={styles.mapFullCloseText}>✕</Text>
            </Pressable>
          </View>
        </Modal>

        {/* Photo lightbox */}
        <Modal
          visible={lightboxPhoto !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxPhoto(null)}
        >
          <Pressable
            style={styles.lightboxOverlay}
            onPress={() => setLightboxPhoto(null)}
          >
            {lightboxPhoto?.photo_data && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${lightboxPhoto.photo_data}` }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            )}
            {lightboxPhoto && (
              <View style={styles.lightboxInfo}>
                <Text style={styles.lightboxMarker}>
                  📍 {Math.round(lightboxPhoto.distance_marker_km * 10) / 10}K mark
                </Text>
                {lightboxPhoto.caption ? (
                  <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
                ) : null}
                <Text style={styles.lightboxHint}>Tap anywhere to close</Text>
              </View>
            )}
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cancelButton: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  saveButton: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationInput: {
    alignItems: 'center',
  },
  colon: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.xl,
    color: colors.text,
    textAlign: 'center',
    minWidth: 80,
    ...shadows.small,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
    fontSize: typography.sizes.md,
    textAlign: 'left',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.small,
  },
  categoryButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  categoryTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  deleteButton: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.medium,
  },

  // Map (outdoor GPS-tracked runs)
  mapWrap: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  map: { flex: 1 },
  mapExpandHint: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  mapExpandHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  mapFullContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapFullClose: {
    position: 'absolute',
    top: 50,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  mapFullCloseText: { fontSize: 18, fontWeight: '700', color: colors.text },

  // Scenic photo styles
  photosSection: {
    marginTop: spacing.sm,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoThumbWrap: {
    width: 100,
    position: 'relative',
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  photoThumbPlaceholder: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  photoThumbPlaceholderText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  photoMarkerBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoMarkerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  lightboxImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: '70%',
    borderRadius: radius.md,
  },
  lightboxInfo: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  lightboxMarker: {
    color: '#fff',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  lightboxCaption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: typography.sizes.md,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  lightboxHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: typography.sizes.xs,
    marginTop: spacing.xl,
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDeleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoThumbCaption: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 3,
  },
  addPhotoBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  addPhotoBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  flowSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  flowLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  markerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  markerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.textLight,
  },
  markerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  markerChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  markerChipTextActive: {
    color: colors.textOnPrimary,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewSmall: {
    width: 70,
    height: 70,
    borderRadius: radius.md,
  },
  captionMarkerTag: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  captionInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  flowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flowCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  flowCancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 120,
  },
  uploadBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
