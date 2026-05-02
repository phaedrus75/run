/**
 * useActivityPhotoCapture
 * =======================
 * Shared hook for taking in-activity photos during a GPS-tracked walk or run.
 *
 * Usage:
 *   const { pendingPhotos, capturing, capturePhoto, clearPhotos } =
 *     useActivityPhotoCapture(() => tracker.getSnapshot().distanceKm, tracker);
 *
 * Photos are also saved to the user's iPhone Photos library (when permission
 * is granted) into a "ZenRun" album, so the user keeps the originals even if
 * the app's upload to the backend fails.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { WalkSnapshot } from './walkLocationTracker';

const ZENRUN_ALBUM_NAME = 'ZenRun';

/** Cached so we only ask for media-library permission once per app session. */
let mediaLibraryPermissionState: 'unknown' | 'granted' | 'denied' = 'unknown';

/**
 * Save a photo file (from `result.assets[0].uri`) to the user's Photos library
 * inside a "ZenRun" album. Best-effort — never throws, returns whether it
 * succeeded so the caller can log/notify if interesting.
 *
 * Permission strategy: request *write-only* access (the friendly "Allow ZenRun
 * to add to your Photos?" single-button prompt). The previous version asked
 * for full read+write access, which a reasonable user declines, silently
 * disabling the photo backup for the rest of the session. After Build 32 we
 * never ask for read access here — we don't need it.
 */
async function saveOriginalToPhotos(uri: string): Promise<boolean> {
  try {
    if (mediaLibraryPermissionState === 'unknown') {
      const existing = await MediaLibrary.getPermissionsAsync(true);
      if (existing.granted) {
        mediaLibraryPermissionState = 'granted';
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync(true);
        mediaLibraryPermissionState = perm.granted ? 'granted' : 'denied';
      }
    }
    if (mediaLibraryPermissionState !== 'granted') return false;

    const asset = await MediaLibrary.createAssetAsync(uri);
    try {
      const album = await MediaLibrary.getAlbumAsync(ZENRUN_ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ZENRUN_ALBUM_NAME, asset, false);
      }
    } catch (albumErr) {
      // Asset is still saved to Photos at the top level — album is a
      // nice-to-have that requires read access we may not have under the
      // writeOnly scope.
      console.warn('Could not file photo into ZenRun album:', albumErr);
    }
    return true;
  } catch (e) {
    console.warn('Failed to save photo to Photos library:', e);
    return false;
  }
}

export interface PendingPhoto {
  uri: string;
  base64: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number;
  capturedAt: number;
}

/** Minimal interface the hook needs from any tracker singleton. */
interface TrackerHandle {
  getSnapshot(): WalkSnapshot;
}

/**
 * @param tracker  The activity tracker (walkTracker or runTracker) to read
 *                 GPS position + distance from at capture time.
 */
export function useActivityPhotoCapture(tracker: TrackerHandle) {
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [capturing, setCapturing] = useState(false);

  const capturePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

      const originalUri = result.assets[0].uri;

      // Fire-and-forget: archive the full-resolution original to the user's
      // Photos library so they keep a copy regardless of upload success.
      // Done in parallel with the manipulator so the user feels no extra delay.
      const photoSaveTask = saveOriginalToPhotos(originalUri);

      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );

      const snap = tracker.getSnapshot();
      const lastPt = snap.points.length > 0 ? snap.points[snap.points.length - 1] : null;

      const photo: PendingPhoto = {
        uri: manipulated.uri,
        base64: manipulated.base64 ?? '',
        lat: lastPt?.lat ?? null,
        lng: lastPt?.lng ?? null,
        distanceKm: snap.distanceKm,
        capturedAt: Date.now(),
      };

      setPendingPhotos((prev) => [...prev, photo]);
      await photoSaveTask;
    } catch (e) {
      console.warn('Photo capture failed', e);
    } finally {
      setCapturing(false);
    }
  };

  const clearPhotos = () => setPendingPhotos([]);

  return { pendingPhotos, capturing, capturePhoto, clearPhotos };
}
