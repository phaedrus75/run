/**
 * photoUploader
 * =============
 *
 * Background drainer for the per-photo upload state machine in
 * `photoSession`. Reads the manifest for every session that has a
 * `serverActivityId` and a non-`done` photo, sends the photo to the backend
 * via `photoApi.upload` / `walkPhotoApi.upload`, and updates the manifest
 * with the result.
 *
 * Triggered on:
 *   - App launch (post-auth)
 *   - After the user saves an activity (the run/walk now has an id)
 *   - When the network comes back online (caller's responsibility)
 *
 * Design pillars:
 *   - **Idempotent**. A photo with `upload.status === 'done'` is skipped.
 *     Safe to re-run any time.
 *   - **Per-photo retry with backoff**. A failed upload increments
 *     `attempts` and sets `nextRetryAt`. The drainer will skip until that
 *     time passes. Capped at MAX_ATTEMPTS to avoid infinite churn.
 *   - **Concurrency cap per session**. We upload multiple photos in
 *     parallel but don't fan out 100s of requests; a small cap protects
 *     the backend and the device.
 *   - **No deletion of source files**. The session manifest decides when a
 *     session is fully complete (uploads done + archive settled). Cleanup
 *     happens in `photoSession.maybeCleanupSession`, not here.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { photoApi, walkPhotoApi } from './api';
import {
  loadManifest,
  listSessions,
  maybeCleanupSession,
  PhotoEntry,
  SessionManifest,
  updatePhoto,
} from './photoSession';

/** Maximum upload attempts per photo before we give up. After this we
 *  surface the photo in the "failed uploads" UI as a manual-retry option. */
const MAX_ATTEMPTS = 12;

/** Exponential backoff schedule (ms) keyed on attempt count.
 *  Attempt 1 retry waits 5s, attempt 2 retry waits 15s, etc. Once we run
 *  out of explicit slots we cap at the last value. */
const BACKOFF_SCHEDULE_MS = [
  5_000,        // 5s
  15_000,       // 15s
  60_000,       // 1min
  5 * 60_000,   // 5min
  30 * 60_000,  // 30min
  60 * 60_000,  // 1h
  4 * 60 * 60_000, // 4h
];

/** Max photos uploading concurrently within a single session. */
const PER_SESSION_CONCURRENCY = 3;

/** Has at least one drainer call already started? Used to debounce app-
 *  launch + save triggers that arrive within milliseconds of each other. */
let draining = false;
let queuedRedrain = false;

export interface UploadDrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Drain every session's pending photo uploads. Returns aggregate counts.
 * Multiple concurrent calls are coalesced — a second call while one is in
 * flight will trigger a single follow-up drain when the first finishes.
 */
export async function drainPendingUploads(): Promise<UploadDrainResult> {
  if (draining) {
    queuedRedrain = true;
    return { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };
  }
  draining = true;
  const acc: UploadDrainResult = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };
  try {
    const sessions = await listSessions();
    for (const summary of sessions) {
      if (summary.serverActivityId === null) continue;
      if (summary.pendingUploadCount === 0) continue;
      const partial = await drainSession(summary.sessionId);
      acc.attempted += partial.attempted;
      acc.succeeded += partial.succeeded;
      acc.failed += partial.failed;
      acc.skipped += partial.skipped;
      // Try to clean up immediately if everything in this session is now
      // settled. No-op if there are still pending archives or recent age.
      await maybeCleanupSession(summary.sessionId);
    }
  } finally {
    draining = false;
    if (queuedRedrain) {
      queuedRedrain = false;
      void drainPendingUploads();
    }
  }
  return acc;
}

/** Drain a single session. Exposed so callers (e.g. the save flow) can
 *  trigger immediately after stamping the activity id without waiting for
 *  the global scan. */
export async function drainSession(sessionId: string): Promise<UploadDrainResult> {
  const acc: UploadDrainResult = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };
  const manifest = await loadManifest(sessionId);
  if (!manifest) return acc;
  if (manifest.serverActivityId === null) return acc;

  const now = Date.now();
  const todo = manifest.photos.filter((p) => isUploadable(p, now));
  if (todo.length === 0) return acc;

  // Process in chunks of PER_SESSION_CONCURRENCY.
  for (let i = 0; i < todo.length; i += PER_SESSION_CONCURRENCY) {
    const batch = todo.slice(i, i + PER_SESSION_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((entry) => uploadOne(manifest, entry)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      acc.attempted += 1;
      if (r.status === 'fulfilled' && r.value === 'done') acc.succeeded += 1;
      else if (r.status === 'fulfilled' && r.value === 'skipped') acc.skipped += 1;
      else acc.failed += 1;
    }
  }
  return acc;
}

/** Same as drainPendingUploads but only operates on one session — no
 *  filesystem scan. Useful when the caller already has the manifest in
 *  hand. */
export async function uploadAllInSession(sessionId: string): Promise<UploadDrainResult> {
  return drainSession(sessionId);
}

/**
 * Force a single photo to be retried right now, regardless of `nextRetryAt`.
 * Used by the "retry failed" affordance on the review screen + run detail.
 */
export async function retryPhoto(
  sessionId: string,
  photoId: string,
): Promise<'done' | 'failed' | 'skipped'> {
  const manifest = await loadManifest(sessionId);
  if (!manifest) return 'failed';
  const entry = manifest.photos.find((p) => p.id === photoId);
  if (!entry) return 'failed';
  if (entry.upload.status === 'done') return 'skipped';
  if (manifest.serverActivityId === null) return 'failed';
  // Reset the backoff so uploadOne will actually attempt.
  await updatePhoto(sessionId, photoId, {
    upload: { ...entry.upload, status: 'pending', nextRetryAt: undefined, error: undefined },
  });
  const refreshed = await loadManifest(sessionId);
  if (!refreshed) return 'failed';
  const refreshedEntry = refreshed.photos.find((p) => p.id === photoId);
  if (!refreshedEntry) return 'failed';
  return uploadOne(refreshed, refreshedEntry);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function isUploadable(p: PhotoEntry, now: number): boolean {
  if (p.upload.status === 'done') return false;
  if (p.upload.status === 'uploading') return false;
  if (p.upload.attempts >= MAX_ATTEMPTS) return false;
  if (p.upload.nextRetryAt && p.upload.nextRetryAt > now) return false;
  return true;
}

function backoffMs(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1);
  // Add ±20% jitter so a fleet of devices doesn't synchronise retries.
  const base = BACKOFF_SCHEDULE_MS[idx];
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(base + jitter));
}

async function uploadOne(
  manifest: SessionManifest,
  entry: PhotoEntry,
): Promise<'done' | 'failed' | 'skipped'> {
  // Mark uploading so a second drainer call doesn't pick the same photo.
  await updatePhoto(manifest.sessionId, entry.id, {
    upload: { ...entry.upload, status: 'uploading', error: undefined },
  });

  try {
    const base64 = await readFileBase64(entry.uri);
    if (!base64) throw new Error('Photo file unreadable');

    if (manifest.kind === 'run') {
      const res = await photoApi.upload(manifest.serverActivityId!, {
        photo_data: base64,
        distance_marker_km: clampMarker(entry.distanceKm, manifest.serverActivityDistanceKm),
        caption: entry.caption ?? undefined,
      });
      await updatePhoto(manifest.sessionId, entry.id, {
        upload: {
          status: 'done',
          attempts: entry.upload.attempts + 1,
          serverPhotoId: res.id,
        },
      });
    } else {
      const res = await walkPhotoApi.upload(manifest.serverActivityId!, {
        photo_data: base64,
        lat: entry.lat ?? undefined,
        lng: entry.lng ?? undefined,
        distance_marker_km: clampMarker(entry.distanceKm, manifest.serverActivityDistanceKm),
        caption: entry.caption ?? undefined,
      });
      await updatePhoto(manifest.sessionId, entry.id, {
        upload: {
          status: 'done',
          attempts: entry.upload.attempts + 1,
          serverPhotoId: res.id,
        },
      });
    }
    return 'done';
  } catch (e) {
    const attempts = entry.upload.attempts + 1;
    const message = (e as Error)?.message ?? 'Upload failed';
    const giveUp = attempts >= MAX_ATTEMPTS;
    await updatePhoto(manifest.sessionId, entry.id, {
      upload: {
        status: 'failed',
        attempts,
        error: message,
        nextRetryAt: giveUp ? undefined : Date.now() + backoffMs(attempts),
      },
    });
    return 'failed';
  }
}

/** Read a JPEG file as base64. expo-file-system's readAsStringAsync with
 *  Base64 encoding does the heavy lifting in native — keeps the JS thread
 *  free of large string allocations. */
async function readFileBase64(uri: string): Promise<string | null> {
  try {
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return data;
  } catch (e) {
    console.warn('Failed to read photo file:', uri, e);
    return null;
  }
}

/** Backend requires `0 < distance_marker_km <= activity.distance_km`. The
 *  manifest stashes the saved distance at link-time so we can clamp here
 *  without an extra round-trip. Without it (legacy drafts, etc.) we fall
 *  back to the lower-bound clamp only and let the backend reject if the
 *  marker is out of range. */
function clampMarker(km: number, totalKm: number | null): number {
  const safe = Math.max(0.05, Number((km || 0).toFixed(3)));
  if (totalKm == null || totalKm <= 0) return safe;
  const upper = Math.max(0.05, totalKm - 0.01);
  return Math.min(upper, safe);
}
