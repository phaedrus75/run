/**
 * ✏️ EDIT RUN MODAL
 * ==================
 *
 * Manual / non-GPS runs: edit distance, duration, category, notes, photos.
 * GPS runs (polyline present): read-only distance/time/category; route map
 * with photo pins, pinch/pan; notes + add/delete photos only.
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
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
  Switch,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { RunTypeButton } from './RunTypeButton';
import { WalkMap, type MapMarker } from './WalkMap';
import { RetroactivePhotoPicker } from './RetroactivePhotoPicker';
import { PhotoHeroCarousel } from './PhotoHeroCarousel';
import {
  photoApi,
  levelApi,
  neighbourhoodApi,
  runApi,
  type Run,
  type RunPhoto,
  type NeighbourhoodMe,
} from '../services/api';
import { albumCache } from '../services/albumCache';
import { MAX_PHOTOS_PER_ACTIVITY } from '../constants/photos';
import { decodePolyline, pointAlongRouteAtKm, formatDistanceKm } from '../services/walkLocationTracker';
import type { RouteForRetroactive } from '../services/retroactivePhotos';

const ALL_RUN_TYPES = ['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'];

interface EditRunModalProps {
  visible: boolean;
  run: Run | null;
  onClose: () => void;
  onSave: (
    id: number,
    data: { run_type?: string; duration_seconds?: number; notes?: string; category?: string },
  ) => Promise<void>;
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
  /** Full-resolution base64 for the photo currently in the lightbox; fetched
   *  on demand because the list response only carries thumbnails. */
  const [lightboxFull, setLightboxFull] = useState<string | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  // Retroactive photo picker state — opens a sheet that pulls photos from
  // the user's library matching the run's [started_at - 15min, completed_at +
  // 15min] window. Used for both watch-recorded runs (no in-workout camera)
  // and as an upgrade path on iPhone-led runs where the user took photos
  // on their phone but didn't use the in-app camera.
  const [retroPickerVisible, setRetroPickerVisible] = useState(false);

  const [nbMe, setNbMe] = useState<NeighbourhoodMe | null>(null);
  const [nbShareBusy, setNbShareBusy] = useState(false);
  const [localNeighbourhoodShare, setLocalNeighbourhoodShare] = useState(false);

  // Circles share is opt-OUT (default true). We mirror it locally so the
  // toggle feels instant; the network call updates the row in the
  // background.
  const [circlesShareBusy, setCirclesShareBusy] = useState(false);
  const [localCirclesShare, setLocalCirclesShare] = useState(true);

  useEffect(() => {
    if (!visible || !run) return;
    neighbourhoodApi.getMe().then(setNbMe).catch(() => setNbMe(null));
    setLocalNeighbourhoodShare((run.neighbourhood_visibility || 'off') === 'neighbourhood');
    setLocalCirclesShare(run.circles_share !== false);
  }, [visible, run?.id, run?.neighbourhood_visibility, run?.circles_share]);

  const routePoints = useMemo(
    () => (run?.route_polyline ? decodePolyline(run.route_polyline) : []),
    [run?.route_polyline],
  );

  /** Activity descriptor for the retroactive photo picker. The picker uses
   *  these fields to query the Photos library and compute distance markers. */
  const retroActivity = useMemo<RouteForRetroactive>(
    () => ({
      startedAt: run?.started_at ?? null,
      endedAt: run?.completed_at ?? null,
      totalDistanceKm: run?.distance_km ?? 0,
      routePoints,
    }),
    [run?.started_at, run?.completed_at, run?.distance_km, routePoints],
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

  const gpsTracked = routePoints.length > 0;

  const photoMarkers = useMemo((): MapMarker[] => {
    if (!gpsTracked) return [];
    const out: MapMarker[] = [];
    for (const p of photos) {
      const pt = pointAlongRouteAtKm(routePoints, p.distance_marker_km);
      if (!pt) continue;
      const km = Math.round(p.distance_marker_km * 10) / 10;
      out.push({
        id: `run-photo-${p.id}`,
        lat: pt.lat,
        lng: pt.lng,
        title: `${km} km`,
        tintColor: colors.accent,
      });
    }
    return out;
  }, [gpsTracked, photos, routePoints]);

  /** Tap a photo marker on the map → open the same lightbox the grid uses. */
  const handleMarkerPress = useCallback(
    (markerId: string) => {
      if (!markerId.startsWith('run-photo-')) return;
      const photoId = Number(markerId.slice('run-photo-'.length));
      const found = photos.find((p) => p.id === photoId);
      if (found) setLightboxPhoto(found);
    },
    [photos],
  );

  const [mapZoom, setMapZoom] = useState(15);

  useEffect(() => {
    if (routeCamera) setMapZoom(routeCamera.zoom);
  }, [run?.id, routeCamera?.zoom]);

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
    // Watch-recorded runs (category='watch') also keep route + photos, so
    // they get the same photo section as outdoor iPhone-led runs.
    const cat = run?.category || 'outdoor';
    if (visible && run && (cat === 'outdoor' || cat === 'watch')) {
      fetchPhotos();
    }
  }, [visible, run]);

  // When the lightbox opens, fetch the full-res photo on demand. The list
  // response only carries thumbnails — full-res is only paid for when the
  // user actually wants to look closely.
  useEffect(() => {
    setLightboxFull(null);
    if (!lightboxPhoto || !run) return;
    let cancelled = false;
    photoApi
      .getRunPhotoFull(run.id, lightboxPhoto.id)
      .then((p) => {
        if (cancelled) return;
        if (p?.photo_data) setLightboxFull(p.photo_data);
      })
      .catch(() => {
        // Non-fatal — the thumb stays visible.
      });
    return () => {
      cancelled = true;
    };
  }, [lightboxPhoto, run]);

  const fetchPhotos = async () => {
    if (!run) return;
    setLoadingPhotos(true);
    try {
      // Default response carries `thumb_data` only — small + fast even for
      // photo-heavy runs. The lightbox upgrades to full-res on demand.
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
    if (photos.length >= MAX_PHOTOS_PER_ACTIVITY) {
      Alert.alert(
        'Photo limit reached',
        `${MAX_PHOTOS_PER_ACTIVITY} photos is the limit per run. Remove one to add another.`,
      );
      return;
    }
    // Wrap to surface failures (denied permission, OOM on large HEIC, etc.)
    // as a friendly alert. Reading base64 from disk after the manipulator
    // writes the resized JPEG avoids holding both the decoded original and
    // the encoded base64 in memory simultaneously.
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setPendingPhotoUri(manipulated.uri);
      setPendingPhotoBase64(base64);
      setPhotoStep('marker');
    } catch (e: any) {
      console.warn('Photo pick failed', e);
      Alert.alert(
        'Could not attach photo',
        e?.message ?? 'Try a different photo.',
      );
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
      albumCache.invalidate();
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
            albumCache.invalidate();
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
      if (gpsTracked) {
        await onSave(run.id, { notes: notes.trim() || undefined });
      } else {
        const durationSeconds = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
        await onSave(run.id, {
          run_type: runType,
          duration_seconds: durationSeconds,
          notes: notes.trim() || undefined,
          category,
        });
      }
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
  const isWatch = category === 'watch';
  const showsPhotoSection = isOutdoor || isWatch;
  const hasRouteForRetro =
    !!run.started_at && !!run.completed_at && (run.distance_km ?? 0) > 0;

  const canNeighbourhoodShare =
    isOutdoor &&
    (!!run.route_polyline || (run.start_lat != null && run.start_lng != null)) &&
    !!nbMe?.opted_in &&
    !!(nbMe?.home_city || '').trim() &&
    !!nbMe?.handle;

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
          <Text style={styles.title}>{gpsTracked ? 'Run' : 'Edit Run'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero carousel for all outdoor/watch runs with photos (GPS and manual). */}
          {showsPhotoSection && photos.length > 0 && (
            <PhotoHeroCarousel
              photos={photos}
              onPress={(p) => setLightboxPhoto(p as RunPhoto)}
            />
          )}

          {gpsTracked && (
            <View style={styles.readOnlyStats}>
              <Text style={styles.readOnlyTitle}>GPS summary</Text>
              <Text style={styles.readOnlyLine}>
                {run.run_type} · {formatDistanceKm(run.distance_km)} · {run.formatted_duration}
              </Text>
              <Text style={styles.readOnlyHint}>
                Distance, duration and category come from your GPS recording and cannot be changed here.
              </Text>
            </View>
          )}

          {/* Route map — outdoor / watch with a polyline */}
          {showsPhotoSection && routePoints.length > 0 && routeCamera && (
            <View style={styles.mapSection}>
              <Text style={styles.label}>Route</Text>
              <View style={styles.mapWrap}>
                <WalkMap
                  style={styles.map}
                  route={routePoints}
                  markers={photoMarkers.length ? photoMarkers : undefined}
                  centerOn={routeCamera.center}
                  zoom={mapZoom}
                  showUserLocation={false}
                  routeColor="#F97316"
                  interactive
                  onMarkerPress={handleMarkerPress}
                />
                <View style={styles.mapZoomBar} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.mapZoomBtn}
                    onPress={() => setMapZoom((z) => Math.min(18, z + 1))}
                    accessibilityLabel="Zoom in"
                  >
                    <Text style={styles.mapZoomBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mapZoomBtn}
                    onPress={() => setMapZoom((z) => Math.max(10, z - 1))}
                    accessibilityLabel="Zoom out"
                  >
                    <Text style={styles.mapZoomBtnText}>−</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.mapFsBtn}
                  onPress={() => setMapFullscreen(true)}
                  hitSlop={8}
                  accessibilityLabel="Fullscreen map"
                >
                  <Text style={styles.mapFsBtnText}>⤢</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!gpsTracked && (
            <>
              <Text style={styles.label}>Distance</Text>
              <View style={styles.typeRow}>
                {availableTypes.map((type) => (
                  <RunTypeButton
                    key={type}
                    type={type}
                    size="small"
                    selected={runType === type}
                    onPress={() => setRunType(type)}
                  />
                ))}
              </View>

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
            </>
          )}

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

          {canNeighbourhoodShare && (
            <View style={styles.nbRow}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.label}>Share to neighbourhood</Text>
                <Text style={styles.nbHint}>
                  Visible in {nbMe?.home_city} under @{nbMe?.handle}. You can turn this off anytime.
                </Text>
              </View>
              <Switch
                value={localNeighbourhoodShare}
                disabled={nbShareBusy}
                onValueChange={async (on) => {
                  if (!run) return;
                  setNbShareBusy(true);
                  try {
                    if (on) await neighbourhoodApi.shareRun(run.id);
                    else await neighbourhoodApi.unshareRun(run.id);
                    setLocalNeighbourhoodShare(on);
                  } catch (e: any) {
                    Alert.alert('Neighbourhood', e?.message || 'Could not update sharing');
                  } finally {
                    setNbShareBusy(false);
                  }
                }}
              />
            </View>
          )}

          {/* Circles share is opt-OUT — runs are visible to circle members
              by default. The toggle is always shown so the user can flip
              an album private even if they're not in any circles yet. */}
          <View style={styles.nbRow}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.label}>Share with my circles</Text>
              <Text style={styles.nbHint}>
                On by default. Turn off to hide this run from every circle you're a member of.
              </Text>
            </View>
            <Switch
              value={localCirclesShare}
              disabled={circlesShareBusy}
              onValueChange={async (on) => {
                if (!run) return;
                setLocalCirclesShare(on);
                setCirclesShareBusy(true);
                try {
                  if (on) await runApi.shareCircles(run.id);
                  else await runApi.unshareCircles(run.id);
                } catch (e: any) {
                  setLocalCirclesShare(!on);
                  Alert.alert('Circles', e?.message || 'Could not update sharing');
                } finally {
                  setCirclesShareBusy(false);
                }
              }}
            />
          </View>

          {/* Scenic Photos — shown for outdoor iPhone-led AND watch-recorded runs.
              Watch runs only get the retroactive (library) flow since the watch
              has no camera; outdoor runs get both that and the existing single-
              photo manual-marker flow. */}
          {showsPhotoSection && (
            <View style={styles.photosSection}>
              <Text style={styles.label}>{gpsTracked ? 'Photos on route' : '📸 Scenic Photos'}</Text>

              {loadingPhotos ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
              ) : (
                <>
                  {gpsTracked && photos.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.photoKmRow}
                    >
                      {photos.map((photo) => {
                        const km = Math.round(photo.distance_marker_km * 10) / 10;
                        return (
                          <TouchableOpacity
                            key={photo.id}
                            style={styles.photoKmChip}
                            onPress={() => setLightboxPhoto(photo)}
                          >
                            <Text style={styles.photoKmChipText}>📍 {km}K</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  {!gpsTracked && photos.length > 0 && (
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
                              {(() => {
                                const src = photo.thumb_data ?? photo.photo_data;
                                return src ? (
                                  <Image
                                    source={{ uri: `data:image/jpeg;base64,${src}` }}
                                    style={styles.photoThumbImage}
                                  />
                                ) : (
                                  <View style={[styles.photoThumbImage, styles.photoThumbPlaceholder]}>
                                    <Text style={styles.photoThumbPlaceholderText}>📍{km}K</Text>
                                  </View>
                                );
                              })()}
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
                    <View style={{ gap: spacing.sm }}>
                      {hasRouteForRetro && (
                        <TouchableOpacity
                          style={styles.addPhotoBtn}
                          onPress={() => setRetroPickerVisible(true)}
                        >
                          <Text style={styles.addPhotoBtnText}>
                            ✨ Add from Photos library
                          </Text>
                        </TouchableOpacity>
                      )}
                      {(isOutdoor || isWatch) && (
                        <TouchableOpacity
                          style={[styles.addPhotoBtn, hasRouteForRetro && styles.addPhotoBtnSecondary]}
                          onPress={pickPhoto}
                        >
                          <Text
                            style={[
                              styles.addPhotoBtnText,
                              hasRouteForRetro && styles.addPhotoBtnTextSecondary,
                            ]}
                          >
                            {photos.length > 0
                              ? '+ Add another photo (manual marker)'
                              : '+ Add a scenic photo (manual marker)'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                style={StyleSheet.absoluteFill as ViewStyle}
                route={routePoints}
                markers={photoMarkers.length ? photoMarkers : undefined}
                centerOn={routeCamera.center}
                zoom={mapZoom}
                showUserLocation={false}
                routeColor="#F97316"
                interactive
                onMarkerPress={(id) => {
                  // Close the fullscreen map first so the lightbox shows on top.
                  setMapFullscreen(false);
                  handleMarkerPress(id);
                }}
              />
            )}
            <View style={styles.mapFullZoomBar} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.mapZoomBtn}
                onPress={() => setMapZoom((z) => Math.min(18, z + 1))}
              >
                <Text style={styles.mapZoomBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapZoomBtn}
                onPress={() => setMapZoom((z) => Math.max(10, z - 1))}
              >
                <Text style={styles.mapZoomBtnText}>−</Text>
              </TouchableOpacity>
            </View>
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
            {(() => {
              const src =
                lightboxFull ??
                lightboxPhoto?.photo_data ??
                lightboxPhoto?.thumb_data ??
                null;
              return src ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${src}` }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              ) : null;
            })()}
            {lightboxPhoto && (
              <View style={styles.lightboxInfo}>
                <Text style={styles.lightboxMarker}>
                  📍 {Math.round(lightboxPhoto.distance_marker_km * 10) / 10}K mark
                </Text>
                {lightboxPhoto.caption ? (
                  <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
                ) : null}
                {gpsTracked && (
                  <TouchableOpacity
                    style={styles.lightboxDelete}
                    onPress={() => {
                      const id = lightboxPhoto.id;
                      setLightboxPhoto(null);
                      handleDeletePhoto(id);
                    }}
                  >
                    <Text style={styles.lightboxDeleteText}>Delete photo</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.lightboxHint}>Tap outside the image to close</Text>
              </View>
            )}
          </Pressable>
        </Modal>

        {/* Retroactive photo picker — pulls from Photos library and uploads
            to the same /runs/:id/photos endpoint as the in-app camera. */}
        <RetroactivePhotoPicker
          visible={retroPickerVisible}
          activity={retroActivity}
          uploadPhoto={async ({ base64, distanceKm }) => {
            await photoApi.upload(run.id, {
              photo_data: base64,
              distance_marker_km: distanceKm,
            });
            albumCache.invalidate();
          }}
          onClose={() => setRetroPickerVisible(false)}
          onComplete={() => fetchPhotos()}
        />
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
  readOnlyStats: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  readOnlyTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  readOnlyLine: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  readOnlyHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  mapSection: {
    marginBottom: spacing.md,
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
  nbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  nbHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
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

  // Map (GPS-tracked runs)
  mapWrap: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  map: { flex: 1 },
  mapZoomBar: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.md,
    gap: 6,
  },
  mapZoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  mapZoomBtnText: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: colors.text,
    lineHeight: 24,
  },
  mapFsBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  mapFsBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mapFullContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapFullZoomBar: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 120,
    gap: 8,
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

  photoKmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoKmChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoKmChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },

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
  lightboxDelete: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  lightboxDeleteText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
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
  /** When the retroactive picker button is shown above, the manual-marker
   *  capture button is demoted to a secondary action. */
  addPhotoBtnSecondary: {
    borderColor: colors.textLight + '60',
  },
  addPhotoBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  addPhotoBtnTextSecondary: {
    color: colors.textSecondary,
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
