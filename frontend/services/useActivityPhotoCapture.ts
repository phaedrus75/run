/**
 * useActivityPhotoCapture
 * =======================
 * React hook that opens the camera, persists the result into a per-activity
 * `photoSession` folder, and exposes a list of captured photos that the UI
 * can render directly. The hook is intentionally thin — all persistence,
 * upload, and Photos-library-archive logic lives in the photoSession /
 * photoUploader / photoArchiver services. The hook only:
 *
 *   1. Owns the in-progress sessionId (created lazily on the first capture).
 *   2. Calls the camera + manipulator to make a 2400px JPEG.
 *   3. Hands the resulting file to `photoSession.addPhoto`.
 *   4. Mirrors the manifest into React state for the active screen UI.
 *   5. Kicks the archiver (best-effort, non-blocking).
 *
 * Resolution choice: 1200px wide, JPEG quality 0.85. Lands at ~400–700 KB
 * binary / ~530–930 KB base64 per photo — small enough for snappy uploads on
 * cellular and many photos per activity, while still enough resolution for
 * the album grid + full-screen viewer at typical phone densities. The user's
 * full-resolution original is independently saved to their Photos library by
 * `photoArchiver` (writeOnly permission), so the canonical sharp copy is
 * always kept on-device regardless of what we upload.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import {
  ActivityKind,
  PhotoEntry,
  addPhoto,
  createSession,
  discardSession,
  loadManifest,
  readPhotos,
  removePhoto as removePhotoFromSession,
  updatePhoto,
} from './photoSession';
import { archivePhoto, getMediaPermissionState } from './photoArchiver';
import { WalkSnapshot } from './walkLocationTracker';
import { MAX_PHOTOS_PER_ACTIVITY } from '../constants/photos';

/** Width of the JPEG we resize to before saving + uploading. */
const UPLOAD_WIDTH_PX = 1200;
const UPLOAD_QUALITY = 0.85;

interface TrackerHandle {
  getSnapshot(): WalkSnapshot;
}

export interface UseActivityPhotoCaptureResult {
  /** Photos in the current session, in capture order. Re-reads the manifest
   *  after every mutation so this is always in sync with disk. */
  pendingPhotos: PhotoEntry[];
  /** True while the camera is open / manipulator is running — used to
   *  disable the camera button so we don't double-fire. */
  capturing: boolean;
  /** True if the user has denied "Add to Photos" permission. The UI uses
   *  this to surface the one-time banner with an Open Settings button. */
  photosDenied: boolean;
  /** Open the camera and add the captured photo to the session. */
  capturePhoto: () => Promise<void>;
  /** Drop a photo from the session (file moved to a `removed/` subdir). */
  removePhoto: (photoId: string) => Promise<void>;
  /** Update a photo's caption (locally only — server caption update happens
   *  via `photoApi.updateCaption` once the photo has a serverPhotoId). */
  setCaption: (photoId: string, caption: string | null) => Promise<void>;
  /** Reset the in-memory state. Optionally discard the on-disk session
   *  (used when the user explicitly aborts a recording). */
  clear: (opts?: { discard?: boolean }) => Promise<void>;
  /** The on-disk session id, or null until the first capture. */
  getSessionId: () => string | null;
}

export function useActivityPhotoCapture(
  tracker: TrackerHandle,
  kind: ActivityKind,
): UseActivityPhotoCaptureResult {
  const [pendingPhotos, setPendingPhotos] = useState<PhotoEntry[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [photosDenied, setPhotosDenied] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  // Re-read manifest after every change. Single source of truth on disk.
  const refresh = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) {
      setPendingPhotos([]);
      return;
    }
    const photos = await readPhotos(id);
    setPendingPhotos(photos);
  }, []);

  const allFullySynced =
    pendingPhotos.length > 0 &&
    pendingPhotos.every((p) => p.archive.status === 'done' && p.upload.status === 'done');

  const syncSignature = useMemo(
    () =>
      pendingPhotos.map((p) => `${p.id}:${p.archive.status}:${p.upload.status}`).join('|'),
    [pendingPhotos],
  );

  /** Re-read manifest while photos are still syncing (Photos library + server). */
  useEffect(() => {
    if (pendingPhotos.length === 0 || allFullySynced) return;
    const iv = setInterval(() => {
      void refresh();
    }, 1500);
    return () => clearInterval(iv);
  }, [syncSignature, allFullySynced, refresh, pendingPhotos.length]);

  // Clean up: if the screen unmounts with no captures and no in-flight
  // session, do nothing. If the screen unmounts mid-recording, the session
  // is left on disk for the summary screen to consume.
  useEffect(() => {
    return () => {
      // intentionally empty — no auto-discard. Summary screen will consume
      // the session via `getSessionId()`.
    };
  }, []);

  const ensureSession = async (): Promise<string> => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = await createSession(kind);
    }
    return sessionIdRef.current;
  };

  const capturePhoto = useCallback(async () => {
    if (capturing) return;
    if (pendingPhotos.length >= MAX_PHOTOS_PER_ACTIVITY) {
      Alert.alert(
        'Photo limit reached',
        `${MAX_PHOTOS_PER_ACTIVITY} photos is the limit per ${kind}. Save this one and start another for more.`,
      );
      return;
    }
    setCapturing(true);
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== 'granted') {
        Alert.alert(
          'Camera access needed',
          'ZenRun needs camera access to take scenic photos during your run. Allow it in Settings.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1.0,
        allowsEditing: false,
        // We keep EXIF off the manipulated copy because we don't need it
        // (we record GPS separately) and it can leak metadata if the
        // backend ever re-serves the file.
        exif: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

      const camAsset = result.assets[0];
      const originalUri = camAsset.uri;

      // Manipulate to the upload size. We could also store the original in
      // the session folder for backup, but the original goes to the user's
      // Photos library via the archiver — that's the canonical "full-res"
      // copy the user can rely on. The session folder is the upload
      // workspace, sized accordingly.
      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: UPLOAD_WIDTH_PX } }],
        {
          compress: UPLOAD_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const sessionId = await ensureSession();
      const snap = tracker.getSnapshot();
      const lastPt = snap.points.length > 0 ? snap.points[snap.points.length - 1] : null;

      const entry = await addPhoto(sessionId, {
        sourceUri: manipulated.uri,
        lat: lastPt?.lat ?? null,
        lng: lastPt?.lng ?? null,
        distanceKm: snap.distanceKm,
        capturedAt: Date.now(),
        width: manipulated.width,
        height: manipulated.height,
      });

      // Fire-and-forget archive of the FULL-RES original to Photos library.
      // Failures (denied permission) update the manifest and bubble to the
      // banner — never block the capture loop.
      void archivePhoto(sessionId, entry.id, originalUri).then((res) => {
        if (res === 'denied') setPhotosDenied(true);
      });

      await refresh();
    } catch (e) {
      console.warn('Photo capture failed', e);
    } finally {
      setCapturing(false);
    }
  }, [capturing, kind, pendingPhotos.length, refresh, tracker]);

  const removePhoto = useCallback(async (photoId: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    await removePhotoFromSession(id, photoId);
    await refresh();
  }, [refresh]);

  const setCaption = useCallback(async (photoId: string, caption: string | null) => {
    const id = sessionIdRef.current;
    if (!id) return;
    await updatePhoto(id, photoId, { caption });
    await refresh();
  }, [refresh]);

  const clear = useCallback(async (opts?: { discard?: boolean }) => {
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setPendingPhotos([]);
    if (opts?.discard && id) {
      await discardSession(id);
    }
  }, []);

  const getSessionId = useCallback(() => sessionIdRef.current, []);

  // Also poll the cached Photos permission state once on mount so the
  // banner can reflect a denial that happened in a previous session.
  useEffect(() => {
    let cancelled = false;
    void getMediaPermissionState().then((state) => {
      if (!cancelled && state === 'denied') setPhotosDenied(true);
    });
    return () => { cancelled = true; };
  }, []);

  return {
    pendingPhotos,
    capturing,
    photosDenied,
    capturePhoto,
    removePhoto,
    setCaption,
    clear,
    getSessionId,
  };
}

/** Re-export PhotoEntry so existing screens can keep importing from this
 *  module instead of reaching directly into photoSession. */
export type { PhotoEntry } from './photoSession';

/** Returns the current session manifest if one exists. Useful for screens
 *  that want to render previous-session photos when entering a summary. */
export async function loadCurrentManifest(sessionId: string) {
  return loadManifest(sessionId);
}
