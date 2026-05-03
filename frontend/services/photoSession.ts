/**
 * photoSession
 * ============
 *
 * The single source of truth for every in-run / in-walk photo. A "session" is
 * a per-activity folder on disk that holds the photo files plus a manifest of
 * their state. Capture, upload, archive-to-Photos, and the album feed all
 * read and write the manifest — never plain React state.
 *
 * Why on disk:
 *   - Survives app kill mid-run.
 *   - Survives auth-expired-mid-save (the run never gets created, but the
 *     photos are still there waiting to be uploaded after re-login).
 *   - Survives backend 5xx (retry queue is just `upload.status: pending`).
 *   - Lets us delete a photo before save without losing the file (we move it
 *     to a `removed/` subdir and clean it up on session finish).
 *
 * Storage layout:
 *   <documentDirectory>/photos/sessions/
 *     <sessionId>/
 *       manifest.json                 ← single source of truth
 *       <photoId>.jpg                 ← 2400px JPEG, the "upload" version
 *       removed/<photoId>.jpg         ← files deleted via review screen
 *
 * Session IDs are timestamp + random suffix; activity IDs (run/walk) are
 * stamped into the manifest after the activity is created on the backend.
 *
 * @see useActivityPhotoCapture     — writes via this module
 * @see photoUploader               — drains pending uploads
 * @see photoArchiver               — drains pending Photos library archives
 * @see PhotoReviewScreen           — UI surface
 */

import * as FileSystem from 'expo-file-system/legacy';

const SESSIONS_ROOT = `${FileSystem.documentDirectory ?? ''}photos/sessions/`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityKind = 'run' | 'walk';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'failed';
export type ArchiveStatus = 'pending' | 'done' | 'denied' | 'failed' | 'skipped';

export interface UploadState {
  status: UploadStatus;
  attempts: number;
  serverPhotoId?: number;
  error?: string;
  /** ms epoch — earliest time we're allowed to retry. */
  nextRetryAt?: number;
}

export interface ArchiveState {
  status: ArchiveStatus;
  /** PHAsset id once Photos library has accepted the asset. */
  phAssetId?: string;
  error?: string;
}

export interface PhotoEntry {
  /** Stable UUID generated at capture. Used as the on-disk filename stem. */
  id: string;
  /** `file://` URI pointing to the on-disk JPEG. Safe to pass directly to
   *  React Native's `<Image source={{ uri }} />`. */
  uri: string;
  /** ms epoch — when the camera shot was taken. */
  capturedAt: number;
  lat: number | null;
  lng: number | null;
  distanceKm: number;
  caption: string | null;
  /** md5 of the on-disk file. Used to dedup across capture / recovery /
   *  retroactive flows, and (in future) by the backend to reject duplicates. */
  contentHash: string;
  width?: number;
  height?: number;
  /** Bytes. Cached so list views don't have to stat. */
  fileSize?: number;
  upload: UploadState;
  archive: ArchiveState;
}

export interface SessionManifest {
  /** Schema version — bump when shape changes incompatibly. */
  version: 1;
  sessionId: string;
  kind: ActivityKind;
  /** ms epoch — when the session was created (≈ when recording started). */
  startedAt: number;
  /** Set once the activity has been saved to the backend. The uploader
   *  will not attempt to upload until this is non-null. */
  serverActivityId: number | null;
  /** The activity's `distance_km` as stored on the server. Stashed at save
   *  time so the uploader can clamp `distance_marker_km` correctly without
   *  a round-trip to fetch the activity. */
  serverActivityDistanceKm: number | null;
  /** Last manifest mutation time. Used to break ties in scan ordering. */
  updatedAt: number;
  photos: PhotoEntry[];
}

export interface SessionSummary {
  sessionId: string;
  kind: ActivityKind;
  startedAt: number;
  serverActivityId: number | null;
  photoCount: number;
  /** Photos with `upload.status !== 'done'`. */
  pendingUploadCount: number;
  /** Photos with `archive.status === 'pending'`. */
  pendingArchiveCount: number;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function sessionDir(sessionId: string): string {
  return `${SESSIONS_ROOT}${sessionId}/`;
}

function manifestPath(sessionId: string): string {
  return `${sessionDir(sessionId)}manifest.json`;
}

function photoPath(sessionId: string, photoId: string, ext = 'jpg'): string {
  return `${sessionDir(sessionId)}${photoId}.${ext}`;
}

function makeId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}_${rand}`;
}

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** Atomic-ish manifest write: write to .tmp then rename. */
async function writeManifest(sessionId: string, manifest: SessionManifest): Promise<void> {
  await ensureDir(sessionDir(sessionId));
  const tmp = `${manifestPath(sessionId)}.tmp`;
  manifest.updatedAt = Date.now();
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(manifest));
  // moveAsync overwrites destination atomically on iOS / APFS.
  await FileSystem.moveAsync({ from: tmp, to: manifestPath(sessionId) });
}

async function readManifest(sessionId: string): Promise<SessionManifest | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(manifestPath(sessionId));
    const parsed = JSON.parse(raw) as SessionManifest;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a fresh session for an activity. Returns the sessionId; create the
 * folder + an empty manifest on disk.
 */
export async function createSession(kind: ActivityKind): Promise<string> {
  await ensureDir(SESSIONS_ROOT);
  const sessionId = makeId();
  await ensureDir(sessionDir(sessionId));
  const manifest: SessionManifest = {
    version: 1,
    sessionId,
    kind,
    startedAt: Date.now(),
    serverActivityId: null,
    serverActivityDistanceKm: null,
    updatedAt: Date.now(),
    photos: [],
  };
  await writeManifest(sessionId, manifest);
  return sessionId;
}

export async function loadManifest(sessionId: string): Promise<SessionManifest | null> {
  return readManifest(sessionId);
}

/**
 * Persist a photo file into the session directory and append it to the
 * manifest. The caller is responsible for resizing / encoding before this
 * call — the file at `sourceUri` is copied as-is.
 *
 * Returns the new entry. The caller can then trigger the uploader/archiver.
 */
export async function addPhoto(
  sessionId: string,
  params: {
    sourceUri: string;
    lat: number | null;
    lng: number | null;
    distanceKm: number;
    capturedAt: number;
    width?: number;
    height?: number;
  },
): Promise<PhotoEntry> {
  const manifest = await readManifest(sessionId);
  if (!manifest) throw new Error(`Session ${sessionId} not found`);

  const id = makeId();
  const dest = photoPath(sessionId, id);
  // Copy first so the source URI (often in caches) can be reaped without
  // breaking us.
  await FileSystem.copyAsync({ from: params.sourceUri, to: dest });

  // Hash + size after the copy. md5 + size both come from getInfoAsync on iOS.
  const info = await FileSystem.getInfoAsync(dest, { md5: true });
  const contentHash =
    info.exists && typeof (info as { md5?: string }).md5 === 'string'
      ? ((info as { md5: string }).md5)
      : '';
  const fileSize = info.exists && typeof (info as { size?: number }).size === 'number'
    ? (info as { size: number }).size
    : 0;

  // Dedup by content hash — if this exact image is already in the session,
  // skip the new copy and return the existing entry. Cleans up the file we
  // just wrote so we don't leak.
  if (contentHash) {
    const existing = manifest.photos.find((p) => p.contentHash === contentHash);
    if (existing) {
      try {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      } catch {}
      return existing;
    }
  }

  const entry: PhotoEntry = {
    id,
    uri: dest,
    capturedAt: params.capturedAt,
    lat: params.lat,
    lng: params.lng,
    distanceKm: params.distanceKm,
    caption: null,
    contentHash,
    width: params.width,
    height: params.height,
    fileSize,
    upload: { status: 'pending', attempts: 0 },
    archive: { status: 'pending' },
  };
  manifest.photos.push(entry);
  await writeManifest(sessionId, manifest);
  return entry;
}

/**
 * Remove a photo from the session. The on-disk file is moved to a `removed/`
 * subdir (so we never lose user data through a misclick), and the manifest
 * entry is dropped. The removed dir is cleaned up when the session is
 * finished.
 */
export async function removePhoto(sessionId: string, photoId: string): Promise<void> {
  const manifest = await readManifest(sessionId);
  if (!manifest) return;
  const idx = manifest.photos.findIndex((p) => p.id === photoId);
  if (idx < 0) return;
  const entry = manifest.photos[idx];
  manifest.photos.splice(idx, 1);
  try {
    const removedDir = `${sessionDir(sessionId)}removed/`;
    await ensureDir(removedDir);
    await FileSystem.moveAsync({
      from: entry.uri,
      to: `${removedDir}${entry.id}.jpg`,
    });
  } catch {
    // Best-effort move; not fatal.
  }
  await writeManifest(sessionId, manifest);
}

/**
 * Patch a single photo's mutable fields (caption, distanceKm) and/or its
 * upload / archive sub-states. The caller passes a partial; only provided
 * keys are merged.
 */
export async function updatePhoto(
  sessionId: string,
  photoId: string,
  patch: Partial<Pick<PhotoEntry, 'caption' | 'distanceKm' | 'lat' | 'lng'>> & {
    upload?: Partial<UploadState>;
    archive?: Partial<ArchiveState>;
  },
): Promise<PhotoEntry | null> {
  const manifest = await readManifest(sessionId);
  if (!manifest) return null;
  const entry = manifest.photos.find((p) => p.id === photoId);
  if (!entry) return null;

  if (patch.caption !== undefined) entry.caption = patch.caption;
  if (patch.distanceKm !== undefined) entry.distanceKm = patch.distanceKm;
  if (patch.lat !== undefined) entry.lat = patch.lat;
  if (patch.lng !== undefined) entry.lng = patch.lng;
  if (patch.upload) entry.upload = { ...entry.upload, ...patch.upload };
  if (patch.archive) entry.archive = { ...entry.archive, ...patch.archive };

  await writeManifest(sessionId, manifest);
  return entry;
}

/**
 * Stamp the saved activity's id (and distance, used for marker clamping)
 * into the manifest. Until `serverActivityId` is set the uploader knows
 * there's no run/walk on the server yet to attach photos to.
 */
export async function linkActivityId(
  sessionId: string,
  serverActivityId: number,
  serverActivityDistanceKm: number,
): Promise<void> {
  const manifest = await readManifest(sessionId);
  if (!manifest) return;
  manifest.serverActivityId = serverActivityId;
  manifest.serverActivityDistanceKm = serverActivityDistanceKm;
  await writeManifest(sessionId, manifest);
}

/** All sessions on disk, including completed ones with no pending work. */
export async function listSessions(): Promise<SessionSummary[]> {
  await ensureDir(SESSIONS_ROOT);
  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(SESSIONS_ROOT);
  } catch {
    return [];
  }
  const summaries: SessionSummary[] = [];
  for (const name of entries) {
    const m = await readManifest(name);
    if (!m) continue;
    summaries.push({
      sessionId: m.sessionId,
      kind: m.kind,
      startedAt: m.startedAt,
      serverActivityId: m.serverActivityId,
      photoCount: m.photos.length,
      pendingUploadCount: m.photos.filter((p) => p.upload.status !== 'done').length,
      pendingArchiveCount: m.photos.filter((p) => p.archive.status === 'pending').length,
    });
  }
  summaries.sort((a, b) => b.startedAt - a.startedAt);
  return summaries;
}

/** All photo entries across all sessions, newest-first. UI helper for the
 *  recovery screen. */
export async function listAllPendingPhotos(): Promise<
  { sessionId: string; manifest: SessionManifest; entry: PhotoEntry }[]
> {
  const out: { sessionId: string; manifest: SessionManifest; entry: PhotoEntry }[] = [];
  for (const summary of await listSessions()) {
    const m = await readManifest(summary.sessionId);
    if (!m) continue;
    for (const entry of m.photos) {
      if (entry.upload.status !== 'done' || entry.archive.status === 'pending') {
        out.push({ sessionId: m.sessionId, manifest: m, entry });
      }
    }
  }
  return out;
}

/**
 * If a session's photos are all uploaded and either archived or denied,
 * delete the whole folder. Idempotent — safe to call repeatedly. Sessions
 * that are still in flight are left alone.
 */
export async function maybeCleanupSession(sessionId: string): Promise<boolean> {
  const m = await readManifest(sessionId);
  if (!m) return false;
  const allUploaded = m.photos.every((p) => p.upload.status === 'done');
  const allArchiveSettled = m.photos.every(
    (p) => p.archive.status !== 'pending',
  );
  if (!allUploaded || !allArchiveSettled) return false;
  // Keep sessions for 24h after completion in case the user pulls up the
  // detail screen and we want to source-of-truth from disk.
  const ageMs = Date.now() - m.startedAt;
  if (ageMs < 24 * 60 * 60 * 1000) return false;
  try {
    await FileSystem.deleteAsync(sessionDir(sessionId), { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

/** Force-delete a session (used when user discards a recording). */
export async function discardSession(sessionId: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(sessionDir(sessionId), { idempotent: true });
  } catch {
    // best-effort
  }
}

/** Convenience: read a manifest's photos as a readonly array, or `[]`. */
export async function readPhotos(sessionId: string): Promise<PhotoEntry[]> {
  const m = await readManifest(sessionId);
  return m ? m.photos : [];
}
