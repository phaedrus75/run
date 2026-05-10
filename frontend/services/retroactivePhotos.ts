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
 *  even if the library is huge. Most workouts have <20 photos in their
 *  ±15min window; long activities (half marathons, journey days) might
 *  brush 40-50. We cap well above realistic to give us headroom. */
const MAX_CANDIDATES = 80;
/** How many `getAssetInfoAsync` calls to keep in flight at once. PhotoKit
 *  is happy with this; serial was the original implementation and it
 *  made the picker feel hung on 100+ candidate days. */
const EXIF_CONCURRENCY = 8;

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
 * Parse an ISO-8601 datetime string as UTC ms epoch.
 *
 * The ECMA spec says ISO strings WITHOUT a timezone marker are parsed as
 * **local time** by `Date.parse` / `new Date(...)`. The backend stores
 * naive datetimes (UTC by convention) and historically serialised them
 * without a `Z` suffix, which silently shifted every timestamp by the
 * device's UTC offset on the JS side and broke this picker for any user
 * not in UTC. The backend fix adds `+00:00`, but we keep this coercion
 * as belt-and-braces for older cached responses and any endpoint that
 * hasn't been updated yet.
 */
function parseAsUtc(iso: string): number {
  // Already has a timezone marker (Z, +hh:mm, -hh:mm) — trust it.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    return Date.parse(iso);
  }
  return Date.parse(iso + 'Z');
}

export interface FindCandidatesOptions {
  /** Called with `(done, total)` as EXIF lookups complete. The picker
   *  uses this to render a "Reading 12 of 30…" progress line so a long
   *  workout window doesn't feel like a hang. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Find candidate photos for retroactive attach. Returns items sorted by
 * creationTime ascending (earliest first, so the picker reads as a
 * left-to-right timeline of the workout).
 *
 * EXIF GPS lookups run in parallel with `EXIF_CONCURRENCY` workers —
 * PhotoKit handles this happily and it turns a 30s "is this hung?"
 * load into a sub-3s one for typical libraries.
 */
export async function findCandidatePhotos(
  activity: RouteForRetroactive,
  options: FindCandidatesOptions = {},
): Promise<CandidatePhoto[]> {
  const startedAtMs = activity.startedAt ? parseAsUtc(activity.startedAt) : NaN;
  const endedAtMs = activity.endedAt ? parseAsUtc(activity.endedAt) : NaN;
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

  const total = result.assets.length;
  options.onProgress?.(0, total);

  // Resolve one asset → CandidatePhoto, doing EXIF GPS round-trip with
  // a per-asset try/catch so a single failure (e.g. iCloud asset that
  // hasn't downloaded) doesn't take the whole batch down.
  const resolveOne = async (
    asset: MediaLibrary.Asset,
  ): Promise<CandidatePhoto> => {
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
      // ignore — keep the candidate, just without GPS-near-route boost
    }

    const nearRoute = lat != null && lng != null
      ? isNearRoute({ lat, lng }, activity.routePoints)
      : false;

    return {
      id: asset.id,
      uri: asset.uri,
      creationTime: asset.creationTime,
      distanceKm: computeDistanceMarker(activity, asset.creationTime),
      withinWorkoutWindow:
        asset.creationTime >= startedAtMs && asset.creationTime <= endedAtMs,
      nearRoute,
      width: asset.width,
      height: asset.height,
      lat,
      lng,
    };
  };

  // Bounded-concurrency pool over result.assets. Index-based queue so we
  // don't allocate a worker array up front; each "worker" pulls the
  // next index off until we run out.
  const candidates: CandidatePhoto[] = new Array(total);
  let nextIndex = 0;
  let done = 0;
  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      try {
        candidates[i] = await resolveOne(result.assets[i]);
      } catch {
        // Already swallowed inside resolveOne; this is a belt-and-braces
        // for any unexpected throw outside the EXIF try/catch.
      }
      done += 1;
      options.onProgress?.(done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(EXIF_CONCURRENCY, total) }, worker),
  );

  return candidates.filter(Boolean).sort((a, b) => a.creationTime - b.creationTime);
}

/** Output spec for retroactive uploads. Matches what `EditRunModal`,
 *  `EditWalkModal`, and the live `RunScreen` capture paths use, so a
 *  photo attached retroactively looks identical in detail to one
 *  captured in-flight. The library originals are typically 4032×3024
 *  HEIC, so 1600px JPEG is a meaningful downsize but still sharp. */
const UPLOAD_WIDTH_PX = 1600;
const UPLOAD_QUALITY = 0.85;

/**
 * Read the picked asset's full image, downsize + compress to keep the
 * upload payload manageable, and return the base64 + final URI.
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
    [{ resize: { width: UPLOAD_WIDTH_PX } }],
    {
      compress: UPLOAD_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!manipulated.base64) {
    throw new Error('Photo manipulation returned no base64');
  }
  return { base64: manipulated.base64, uri: manipulated.uri };
}

// ----- Internal helpers -----

function computeDistanceMarker(activity: RouteForRetroactive, photoTimeMs: number): number {
  if (activity.totalDistanceKm <= 0) return 0;
  const startMs = activity.startedAt ? parseAsUtc(activity.startedAt) : 0;
  const endMs = activity.endedAt ? parseAsUtc(activity.endedAt) : startMs + 1;
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
