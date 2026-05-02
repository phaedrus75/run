/**
 * pendingPhoneActivities
 * ======================
 *
 * Persistent draft layer for phone-recorded runs and walks. When the user
 * finishes a recording and the save call fails (auth expired, network down,
 * backend hiccup, etc.) we serialise the snapshot + any captured photos to
 * disk as a "pending activity" so it survives app kills and reboots. On the
 * next foreground launch with valid auth, drainage retries every queued
 * draft.
 *
 * This mirrors the watch-side queue in `watchBridge.ts` for the phone-led
 * recording path. Before Build 32, in-app recordings had no draft layer at
 * all — a single 401 mid-save lost the entire run. After Build 32, that
 * failure mode is impossible.
 *
 * Storage layout:
 *   <documentDirectory>/pendingActivities/        ← per-draft JSON files
 *     <draftId>.json                              ← {kind, snapshot, photos, ...}
 *   AsyncStorage[INDEX_KEY] = [draftId, ...]      ← stable iteration order
 *
 * Photos are stored inline as base64 inside each JSON file. For typical runs
 * (≤ ~15 photos at ~200 KB each) the file is a few MB at worst — well within
 * iOS's per-file limits, and the cost is paid only on the failure path.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { runApi, photoApi, walkApi, walkPhotoApi } from './api';
import { encodePolyline, type TrackedPoint } from './walkLocationTracker';

const INDEX_KEY = '@zenrun:pendingPhoneActivities';
const DRAFTS_DIR = `${FileSystem.documentDirectory ?? ''}pendingActivities/`;

export interface SerialisedSnapshot {
  durationSeconds: number;
  distanceKm: number;
  elevationGainM: number;
  startedAt: number | null;
  points: { lat: number; lng: number; timestamp: number; altitude?: number | null }[];
}

export interface SerialisedPhoto {
  base64: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number;
  capturedAt: number;
}

interface BaseDraft {
  id: string;
  draftedAt: number;
  snapshot: SerialisedSnapshot;
  photos: SerialisedPhoto[];
  mood?: string;
  note?: string;
}

export interface PendingRunDraft extends BaseDraft {
  kind: 'run';
}

export interface PendingWalkDraft extends BaseDraft {
  kind: 'walk';
  publicWalkId?: number;
}

export type PendingActivityDraft = PendingRunDraft | PendingWalkDraft;

// ─── Index management ────────────────────────────────────────────────────────

async function readIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    await AsyncStorage.removeItem(INDEX_KEY);
  } else {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  }
}

async function ensureDraftsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DRAFTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAFTS_DIR, { intermediates: true });
  }
}

function draftPath(id: string): string {
  return `${DRAFTS_DIR}${id}.json`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function makeId(): string {
  // Timestamp prefix keeps drafts naturally sorted by time. Random suffix
  // avoids collisions if two saves fail within the same millisecond.
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${ts}_${rand}`;
}

/** Persist a failed run save as a draft. Returns the draft id on success. */
export async function enqueueRunDraft(
  payload: Omit<PendingRunDraft, 'id' | 'kind' | 'draftedAt'>,
): Promise<string | null> {
  return enqueueDraft({ kind: 'run', ...payload });
}

/** Persist a failed walk save as a draft. Returns the draft id on success. */
export async function enqueueWalkDraft(
  payload: Omit<PendingWalkDraft, 'id' | 'kind' | 'draftedAt'>,
): Promise<string | null> {
  return enqueueDraft({ kind: 'walk', ...payload });
}

async function enqueueDraft(
  partial: Omit<PendingActivityDraft, 'id' | 'draftedAt'>,
): Promise<string | null> {
  try {
    await ensureDraftsDir();
    const id = makeId();
    const draft: PendingActivityDraft = {
      ...partial,
      id,
      draftedAt: Date.now(),
    } as PendingActivityDraft;
    await FileSystem.writeAsStringAsync(draftPath(id), JSON.stringify(draft));
    const index = await readIndex();
    index.push(id);
    await writeIndex(index);
    return id;
  } catch (e) {
    console.warn('Failed to enqueue activity draft:', e);
    return null;
  }
}

/** Discard a draft permanently — both file and index entry. */
async function deleteDraft(id: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(draftPath(id), { idempotent: true });
  } catch {}
  const index = await readIndex();
  const next = index.filter((x) => x !== id);
  if (next.length !== index.length) await writeIndex(next);
}

async function readDraft(id: string): Promise<PendingActivityDraft | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(draftPath(id));
    const parsed = JSON.parse(raw) as PendingActivityDraft;
    return parsed;
  } catch {
    return null;
  }
}

/** All currently-queued drafts, oldest first. UI helper. */
export async function listPendingDrafts(): Promise<PendingActivityDraft[]> {
  const index = await readIndex();
  const out: PendingActivityDraft[] = [];
  for (const id of index) {
    const d = await readDraft(id);
    if (d) out.push(d);
  }
  return out;
}

export async function getPendingCount(): Promise<number> {
  const index = await readIndex();
  return index.length;
}

// ─── Distance bucket helper (mirrors RunSummaryScreen) ───────────────────────

function distanceToRunType(km: number): string {
  const buckets = [1, 2, 3, 5, 8, 10, 15, 18, 21];
  for (const b of buckets) {
    if (km <= b + 0.5) return `${b}k`;
  }
  return '21k';
}

// ─── Drainage ────────────────────────────────────────────────────────────────

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/**
 * Try to upload every queued draft. Each draft is a single transaction:
 *   1. Create the run/walk via API.
 *   2. Upload all photos in parallel (errors here do NOT roll back the activity
 *      — that matches the in-screen save UX).
 *   3. Delete the draft.
 *
 * If step 1 fails, the draft stays queued for the next attempt.
 *
 * Safe to call multiple times. Idempotent w.r.t. successful saves because
 * each successful upload immediately deletes its draft.
 */
export async function drainPendingPhoneActivities(): Promise<DrainResult> {
  const result: DrainResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  const index = await readIndex();
  if (index.length === 0) return result;

  for (const id of index) {
    result.attempted += 1;
    const draft = await readDraft(id);
    if (!draft) {
      // Orphaned index entry — clean it up and move on.
      await deleteDraft(id);
      continue;
    }
    try {
      if (draft.kind === 'run') {
        await uploadRunDraft(draft);
      } else {
        await uploadWalkDraft(draft);
      }
      await deleteDraft(id);
      result.succeeded += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push(`${draft.kind} draft ${id}: ${(e as Error).message}`);
      // Keep the draft for the next attempt.
    }
  }

  return result;
}

async function uploadRunDraft(draft: PendingRunDraft): Promise<void> {
  const { snapshot, mood, note } = draft;
  const points = snapshot.points;
  if (points.length < 2 || snapshot.distanceKm <= 0) {
    // Bad draft — discard rather than retry forever.
    throw new Error('Insufficient GPS points');
  }
  const start = points[0];
  const end = points[points.length - 1];
  const polyline = encodePolyline(points as TrackedPoint[]);
  const runType = distanceToRunType(snapshot.distanceKm);
  const savedDistanceKm = Number(snapshot.distanceKm.toFixed(3));

  const run = await runApi.create({
    run_type: runType,
    duration_seconds: Math.max(1, Math.round(snapshot.durationSeconds)),
    distance_km: savedDistanceKm,
    category: 'outdoor',
    started_at: snapshot.startedAt
      ? new Date(snapshot.startedAt).toISOString()
      : undefined,
    completed_at: new Date(draft.draftedAt).toISOString(),
    route_polyline: polyline || undefined,
    start_lat: start?.lat,
    start_lng: start?.lng,
    end_lat: end?.lat,
    end_lng: end?.lng,
    elevation_gain_m: snapshot.elevationGainM
      ? Number(snapshot.elevationGainM.toFixed(1))
      : undefined,
    notes: note?.trim() || undefined,
    mood: mood || undefined,
  });

  const valid = draft.photos.filter((p) => p.base64 && p.base64.length > 0);
  if (valid.length > 0) {
    const upperBound = Math.max(0.05, savedDistanceKm - 0.01);
    await Promise.allSettled(
      valid.map((p) => {
        const clampedMarker = Math.min(
          upperBound,
          Math.max(0.05, Number((p.distanceKm || 0).toFixed(3))),
        );
        return photoApi.upload(run.id, {
          photo_data: p.base64,
          distance_marker_km: clampedMarker,
        });
      }),
    );
  }
}

async function uploadWalkDraft(draft: PendingWalkDraft): Promise<void> {
  const { snapshot, mood, note, publicWalkId } = draft;
  const points = snapshot.points;
  if (points.length < 2 || snapshot.distanceKm <= 0) {
    throw new Error('Insufficient GPS points');
  }
  const start = points[0];
  const end = points[points.length - 1];
  const polyline = encodePolyline(points as TrackedPoint[]);

  const walk = await walkApi.create({
    duration_seconds: Math.max(1, Math.round(snapshot.durationSeconds)),
    distance_km: Number(snapshot.distanceKm.toFixed(3)),
    started_at: snapshot.startedAt
      ? new Date(snapshot.startedAt).toISOString()
      : undefined,
    ended_at: new Date(draft.draftedAt).toISOString(),
    route_polyline: polyline || undefined,
    start_lat: start?.lat,
    start_lng: start?.lng,
    end_lat: end?.lat,
    end_lng: end?.lng,
    elevation_gain_m: snapshot.elevationGainM
      ? Number(snapshot.elevationGainM.toFixed(1))
      : undefined,
    notes: note?.trim() || undefined,
    mood: mood || undefined,
    category: 'outdoor',
    public_walk_id: publicWalkId,
  });

  const valid = draft.photos.filter((p) => p.base64 && p.base64.length > 0);
  if (valid.length > 0) {
    await Promise.allSettled(
      valid.map((p) =>
        walkPhotoApi.upload(walk.id, {
          photo_data: p.base64,
          lat: p.lat ?? undefined,
          lng: p.lng ?? undefined,
          distance_marker_km: p.distanceKm,
        }),
      ),
    );
  }
}
