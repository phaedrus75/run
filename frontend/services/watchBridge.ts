/**
 * Apple Watch → iPhone workout sync (WatchConnectivity).
 * Native module: WatchBridge (Expo). Uploads use the same payloads as in-app saves.
 */

import { Platform, Alert } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getToken } from './auth';
import { walkApi, runApi } from './api';
import { encodePolyline, TrackedPoint } from './walkLocationTracker';

const PENDING_QUEUE_KEY = '@zenrun:pendingWatchPayloads';

type WatchPayload = {
  zenRun?: boolean | number;
  type?: string;
  distance_km?: number;
  duration_seconds?: number;
  elevation_gain_m?: number;
  started_at?: string;
  pointsJSON?: string;
};

/**
 * Map a real-world distance to the run_type bucket the user actually achieved.
 *
 * The previous version rounded *up* (4.0km → "5k"), which over-credited short
 * runs. The display total_km on the iPhone uses the actual `distance_km` so the
 * counter is correct either way; only the categorical label changes.
 *
 * Floors to the highest bucket the user actually completed, with a small
 * forgiveness margin so a 1.95km run still counts as "2k". Anything under 1km
 * is still tagged as "1k" since that's the smallest bucket the backend accepts.
 */
function distanceToRunType(km: number): string {
  const buckets = [1, 2, 3, 5, 8, 10, 15, 18, 21];
  const TOLERANCE_KM = 0.05; // 50m of GPS noise is fine
  let best = buckets[0];
  for (const b of buckets) {
    if (km + TOLERANCE_KM >= b) best = b;
  }
  return `${best}k`;
}

function parsePoints(pointsJSON: string | undefined): TrackedPoint[] {
  if (!pointsJSON) return [];
  try {
    const raw = JSON.parse(pointsJSON) as unknown;
    if (!Array.isArray(raw)) return [];
    const out: TrackedPoint[] = [];
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const lat = Number(row[0]);
      const lng = Number(row[1]);
      const timestamp = Number(row[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) continue;
      out.push({ lat, lng, timestamp });
    }
    return out;
  } catch {
    return [];
  }
}

export type WatchDiagnostics = {
  supported?: boolean;
  activationState?: string;
  activationError?: string;
  isPaired?: boolean;
  isWatchAppInstalled?: boolean;
  isReachable?: boolean;
  isComplicationEnabled?: boolean;
  outstandingUserInfoTransfers?: number;
  hasContentPending?: boolean;
  userInfoReceivedCount?: number;
  appContextReceivedCount?: number;
  zenPayloadCount?: number;
  bufferedPayloads?: number;
  hasJsListener?: boolean;
  lastUserInfoAt?: string;
  lastAppContextAt?: string;
};

export async function getWatchDiagnostics(): Promise<WatchDiagnostics & { pendingQueueSize: number }> {
  const pending = await readPendingQueue();
  if (Platform.OS !== 'ios') {
    return { pendingQueueSize: pending.length };
  }
  try {
    const WatchBridge = requireNativeModule('WatchBridge') as { getDiagnostics?: () => Promise<WatchDiagnostics> };
    const native = WatchBridge.getDiagnostics ? await WatchBridge.getDiagnostics() : {};
    return { ...(native ?? {}), pendingQueueSize: pending.length };
  } catch {
    return { pendingQueueSize: pending.length };
  }
}

/**
 * Live two-way query against the watch's WCSession. Resolves with the watch's view of the channel
 * (its activation state, last successful send, etc.) or rejects if the watch isn't reachable.
 *
 * `pingWatch` is read-only.  `resendLastWorkout` asks the watch to re-fire its most recent saved
 * payload via `transferUserInfo` + `applicationContext` — useful when a save on the watch never
 * reached the phone.
 */
export type WatchLiveReply = {
  activationState?: string;
  activationError?: string;
  isReachable?: boolean;
  lastSendAt?: string;
  lastSendOk?: boolean;
  lastSendError?: string;
  hasStoredPayload?: boolean;
  had_payload?: boolean;
};

export async function pingWatch(): Promise<WatchLiveReply> {
  if (Platform.OS !== 'ios') throw new Error('Apple Watch ping is iOS-only');
  const WatchBridge = requireNativeModule('WatchBridge') as { pingWatch?: () => Promise<WatchLiveReply> };
  if (!WatchBridge.pingWatch) throw new Error('pingWatch not available on this build');
  return WatchBridge.pingWatch();
}

export async function resendLastWatchWorkout(): Promise<WatchLiveReply> {
  if (Platform.OS !== 'ios') throw new Error('Resend is iOS-only');
  const WatchBridge = requireNativeModule('WatchBridge') as {
    resendLastWorkout?: () => Promise<WatchLiveReply>;
  };
  if (!WatchBridge.resendLastWorkout) throw new Error('resendLastWorkout not available on this build');
  return WatchBridge.resendLastWorkout();
}

async function readPendingQueue(): Promise<WatchPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WatchPayload[]) : [];
  } catch {
    return [];
  }
}

async function writePendingQueue(queue: WatchPayload[]): Promise<void> {
  try {
    if (queue.length === 0) await AsyncStorage.removeItem(PENDING_QUEUE_KEY);
    else await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* swallow */
  }
}

async function enqueuePayload(payload: WatchPayload): Promise<void> {
  const queue = await readPendingQueue();
  queue.push(payload);
  await writePendingQueue(queue);
}

/** Returns true if the payload was successfully uploaded; false if it was re-queued or invalid. */
async function uploadPayload(raw: WatchPayload, opts: { showAlerts: boolean }): Promise<boolean> {
  const isZen = raw.zenRun === true || raw.zenRun === 1;
  if (!isZen) return false;

  const token = await getToken();
  if (!token) {
    await enqueuePayload(raw);
    if (opts.showAlerts) {
      Alert.alert('Apple Watch', 'Sign in on this iPhone to save workouts from your Watch.');
    }
    return false;
  }

  const kind = raw.type === 'run' ? 'run' : 'walk';
  const distanceKm = Number(raw.distance_km ?? 0);
  const durationSeconds = Math.max(1, Math.round(Number(raw.duration_seconds ?? 1)));
  const points = parsePoints(raw.pointsJSON);
  if (points.length < 2 || distanceKm <= 0) {
    if (opts.showAlerts) {
      Alert.alert('Apple Watch', 'Workout had too few GPS points to save.');
    }
    return false;
  }

  const polylineStr = encodePolyline(points);
  const start = points[0];
  const end = points[points.length - 1];
  const elevationGainM = raw.elevation_gain_m != null ? Number(Number(raw.elevation_gain_m).toFixed(1)) : undefined;

  try {
    if (kind === 'walk') {
      await walkApi.create({
        duration_seconds: durationSeconds,
        distance_km: Number(distanceKm.toFixed(3)),
        started_at: raw.started_at,
        ended_at: new Date().toISOString(),
        route_polyline: polylineStr || undefined,
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        elevation_gain_m: elevationGainM,
        category: 'watch',
      });
      if (opts.showAlerts) {
        Alert.alert('Walk saved', 'Your Apple Watch walk was uploaded to ZenRun.');
      }
    } else {
      const runType = distanceToRunType(distanceKm);
      await runApi.create({
        run_type: runType,
        duration_seconds: durationSeconds,
        distance_km: Number(distanceKm.toFixed(3)),
        category: 'outdoor',
        started_at: raw.started_at,
        completed_at: new Date().toISOString(),
        route_polyline: polylineStr || undefined,
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        elevation_gain_m: elevationGainM,
      });
      if (opts.showAlerts) {
        Alert.alert('Run saved', 'Your Apple Watch run was uploaded to ZenRun.');
      }
    }
    return true;
  } catch (e: unknown) {
    // Re-queue on transient failure so a later auth/network retry can pick it up.
    await enqueuePayload(raw);
    if (opts.showAlerts) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Apple Watch sync', `${msg}\nWill retry next time.`);
    }
    return false;
  }
}

async function handleWatchPayload(raw: WatchPayload) {
  await uploadPayload(raw, { showAlerts: true });
}

/**
 * Drain any payloads that were queued because auth wasn't ready or upload failed.
 * Safe to call multiple times. Should be called after login and on app foreground.
 */
export async function drainPendingWatchPayloads(): Promise<number> {
  if (Platform.OS !== 'ios') return 0;
  const queue = await readPendingQueue();
  if (queue.length === 0) return 0;
  await writePendingQueue([]);

  let succeeded = 0;
  for (const payload of queue) {
    const ok = await uploadPayload(payload, { showAlerts: false });
    if (ok) succeeded += 1;
  }
  return succeeded;
}

let subscription: { remove: () => void } | null = null;

/** Idempotent: call once at app boot. The native module buffers events delivered
 *  before this listener attaches, so it's safe to mount before auth resolves. */
export function registerWatchWorkoutSync(): { remove: () => void } {
  if (Platform.OS !== 'ios') {
    return { remove: () => {} };
  }
  if (subscription) {
    return subscription;
  }

  let WatchBridge: { addListener?: (name: string, cb: (ev: { payload?: WatchPayload }) => void) => { remove: () => void } };
  try {
    WatchBridge = requireNativeModule('WatchBridge');
  } catch {
    return { remove: () => {} };
  }

  if (!WatchBridge?.addListener) {
    return { remove: () => {} };
  }

  const sub = WatchBridge.addListener('onWatchWorkoutReceived', (ev: { payload?: WatchPayload }) => {
    const payload = ev?.payload;
    if (payload) void handleWatchPayload(payload);
  });

  // Drain anything we couldn't upload last time (e.g. signed-out, network down).
  void drainPendingWatchPayloads();

  subscription = {
    remove: () => {
      sub.remove();
      subscription = null;
    },
  };
  return subscription;
}
