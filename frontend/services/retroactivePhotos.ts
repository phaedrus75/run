/**
 * Retroactive photo attach
 * ========================
 *
 * Lets the user attach photos from their iPhone Photos library to a workout
 * after it's saved — i.e. the workflow when:
 *   - The watch was the recorder (no in-app camera during the workout).
 *   - The user took photos on their phone during a phone-recorded workout
 *     but didn't use the in-app camera.
 *
 * Strategy ("loose + GPS-aware" per the design discussion):
 *   1. Query Photos library for assets in [started_at - 15min, ended_at + 15min]
 *      so off-by-a-few-minutes clock skew and "wind-down" shots both count.
 *   2. For each candidate, compute `distance_marker_km` by linearly
 *      interpolating the photo's creationTime against the workout's
 *      [started_at, ended_at] window and the route's total distance.
 *   3. If EXIF GPS is available (the user has Photos location grant), check
 *      whether the asset's lat/lng is within ~150m of any decoded route
 *      point. Photos near the route get a `nearRoute=true` flag the picker
 *      uses to surface them above off-route candidates.
 *
 * Upload uses the same `photoApi.upload` / `walkPhotoApi.upload` endpoints
 * the in-app camera flow uses — the backend doesn't care whether the photo
 * came from the camera or from the Photos library, only that it has a
 * `distance_marker_km` (clamped here, same as `RunSummaryScreen`).
 */

import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { haversineMeters } from './walkLocationTracker';

/** ±15min window per the design discussion. */
const TIME_WINDOW_MS = 15 * 60 * 1000;
/** Photos within this many metres of the route polyline are "near". */
const NEAR_ROUTE_M = 150;
/** Don't fetch more than this many candidates — keeps the picker snappy
 *  even if the library is huge. Most workouts will have far fewer. */
const MAX_CANDIDATES = 200;

export interface RouteForRetroactive {
  /** ISO string. */
  startedAt: string | null;
  /** ISO string. */
  endedAt: string | null;
  /** Total recorded distance, used as the upper bound for `distance_marker_km`. */
  totalDistanceKm: number;
  /** Decoded polyline points; no timestamps required. */
  routePoints: Array<{ lat: number; lng: number }>;
}

export interface CandidatePhoto {
  /** PHAsset id from MediaLibrary. */
  id: string;
  /** Local URI we can show in <Image source={{ uri }} />. */
  uri: string;
  /** ms epoch — when the photo was taken. */
  creationTime: number;
  /** Linear-interpolated guess for `distance_marker_km`, already clamped. */
  distanceKm: number;
  /** True if the photo's `creationTime` falls inside the workout window
   *  (before applying the ±15min loose-window). */
  withinWorkoutWindow: boolean;
  /** True iff EXIF GPS exists AND it's within `NEAR_ROUTE_M` of any
   *  point on the decoded polyline. Use this to rank/highlight in the UI. */
  nearRoute: boolean;
  /** Asset width/height — useful for the picker's grid layout. */
  width: number;
  height: number;
  /** EXIF GPS, if available. We send these along on walk uploads since the
   *  walk-photos endpoint stores them. Run-photos endpoint ignores them. */
  lat: number | null;
  lng: number | null;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/**
 * Ask for Photos library permission. Returns the resolved state. Safe to call
 * multiple times — MediaLibrary handles the "don't re-prompt" logic.
 */
export async function ensurePhotosPermission(): Promise<PermissionState> {
  const cur = await MediaLibrary.getPermissionsAsync();
  if (cur.granted) return 'granted';
  if (!cur.canAskAgain) return cur.granted ? 'granted' : 'denied';
  const next = await MediaLibrary.requestPermissionsAsync();
  return next.granted ? 'granted' : (next.canAskAgain ? 'undetermined' : 'denied');
}

/**
 * Find candidate photos for retroactive attach. Returns up to
 * `MAX_CANDIDATES` items sorted by creationTime ascending (earliest first,
 * so the picker reads naturally as a timeline of the workout).
 */
export async function findCandidatePhotos(
  activity: RouteForRetroactive,
): Promise<CandidatePhoto[]> {
  const startedAtMs = activity.startedAt ? Date.parse(activity.startedAt) : NaN;
  const endedAtMs = activity.endedAt ? Date.parse(activity.endedAt) : NaN;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return [];
  }

  const result = await MediaLibrary.getAssetsAsync({
    mediaType: ['photo'],
    sortBy: [['creationTime', false]],
    first: MAX_CANDIDATES,
    createdAfter: startedAtMs - TIME_WINDOW_MS,
    createdBefore: endedAtMs + TIME_WINDOW_MS,
  });

  const candidates: CandidatePhoto[] = [];
  for (const asset of result.assets) {
    // EXIF GPS is on the asset's *info*, not the asset itself, so we have
    // to round-trip per asset. Fail open: if this throws (no permission /
    // network drive), we keep the candidate but flag nearRoute=false.
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const loc = (info as { location?: { latitude: number; longitude: number } }).location;
      if (loc) {
        lat = loc.latitude;
        lng = loc.longitude;
      }
    } catch {
      // ignore
    }

    const nearRoute = lat != null && lng != null
      ? isNearRoute({ lat, lng }, activity.routePoints)
      : false;

    const distanceKm = computeDistanceMarker(activity, asset.creationTime);

    candidates.push({
      id: asset.id,
      uri: asset.uri,
      creationTime: asset.creationTime,
      distanceKm,
      withinWorkoutWindow:
        asset.creationTime >= startedAtMs && asset.creationTime <= endedAtMs,
      nearRoute,
      width: asset.width,
      height: asset.height,
      lat,
      lng,
    });
  }

  // Earliest first so the picker reads as a left-to-right timeline of the
  // workout; this also tends to put the most-likely "real" photos first
  // since they're shot during the workout window.
  candidates.sort((a, b) => a.creationTime - b.creationTime);
  return candidates;
}

/**
 * Read the picked asset's full image, downsize + compress to keep the
 * upload payload small (matches `useActivityPhotoCapture`'s 1200px / 0.8 JPEG),
 * and return the base64 + final MIME-friendly URI.
 *
 * Throws on read failure so the caller can re-queue / surface to the user.
 */
export async function readForUpload(asset: CandidatePhoto): Promise<{
  base64: string;
  uri: string;
}> {
  // Resolve the asset to a file URL we can hand to ImageManipulator. On iOS
  // `asset.uri` is sometimes already a file:// URL; on others it's a `ph://`
  // identifier that needs `localUri` from getAssetInfoAsync.
  let workingUri = asset.uri;
  if (workingUri.startsWith('ph://') || workingUri.startsWith('assets-library://')) {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    if (info.localUri) {
      workingUri = info.localUri;
    } else {
      throw new Error('Photo could not be read from library');
    }
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    workingUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (!manipulated.base64) {
    throw new Error('Photo manipulation returned no base64');
  }
  return { base64: manipulated.base64, uri: manipulated.uri };
}

// ----- Internal helpers -----

function computeDistanceMarker(activity: RouteForRetroactive, photoTimeMs: number): number {
  if (activity.totalDistanceKm <= 0) return 0;
  const startMs = activity.startedAt ? Date.parse(activity.startedAt) : 0;
  const endMs = activity.endedAt ? Date.parse(activity.endedAt) : startMs + 1;
  const span = Math.max(1, endMs - startMs);
  const t = Math.max(0, Math.min(1, (photoTimeMs - startMs) / span));
  // Match RunSummaryScreen.tsx: clamp into [0.05, totalDistanceKm - 0.01]
  // so the backend's "must be on-route" validation accepts the marker even
  // for shots taken at the very start or after the user pressed stop.
  const raw = activity.totalDistanceKm * t;
  const upper = Math.max(0.05, activity.totalDistanceKm - 0.01);
  return Math.max(0.05, Math.min(upper, raw));
}

function isNearRoute(
  candidate: { lat: number; lng: number },
  route: Array<{ lat: number; lng: number }>,
): boolean {
  if (route.length === 0) return false;
  // Sparse-sampled route points are usually <50m apart, so a per-point
  // distance check (rather than a perpendicular-to-segment) is plenty for
  // a "near route" boolean. Keeps the inner loop branch-free.
  for (const p of route) {
    const m = haversineMeters(p, candidate);
    if (m <= NEAR_ROUTE_M) return true;
  }
  return false;
}
