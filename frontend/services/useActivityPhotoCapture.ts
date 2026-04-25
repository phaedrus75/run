/**
 * useActivityPhotoCapture
 * =======================
 * Shared hook for taking in-activity photos during a GPS-tracked walk or run.
 *
 * Usage:
 *   const { pendingPhotos, capturing, capturePhoto, clearPhotos } =
 *     useActivityPhotoCapture(() => tracker.getSnapshot().distanceKm, tracker);
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { WalkSnapshot } from './walkLocationTracker';

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

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
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
    } catch (e) {
      console.warn('Photo capture failed', e);
    } finally {
      setCapturing(false);
    }
  };

  const clearPhotos = () => setPendingPhotos([]);

  return { pendingPhotos, capturing, capturePhoto, clearPhotos };
}
