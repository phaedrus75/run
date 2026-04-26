/**
 * Apple Watch → iPhone workout sync (WatchConnectivity).
 * Native module: WatchBridge (Expo). Uploads use the same payloads as in-app saves.
 */

import { Platform, Alert } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import { getToken } from './auth';
import { walkApi, runApi } from './api';
import { encodePolyline, TrackedPoint } from './walkLocationTracker';

type WatchPayload = {
  zenRun?: boolean | number;
  type?: string;
  distance_km?: number;
  duration_seconds?: number;
  elevation_gain_m?: number;
  started_at?: string;
  pointsJSON?: string;
};

function distanceToRunType(km: number): string {
  const buckets = [1, 2, 3, 5, 8, 10, 15, 18, 21];
  for (const b of buckets) {
    if (km <= b + 0.5) return `${b}k`;
  }
  return '21k';
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

async function handleWatchPayload(raw: WatchPayload) {
  const isZen = raw.zenRun === true || raw.zenRun === 1;
  if (!isZen) return;

  const token = await getToken();
  if (!token) {
    Alert.alert('Apple Watch', 'Sign in on this iPhone to save workouts from your Watch.');
    return;
  }

  const kind = raw.type === 'run' ? 'run' : 'walk';
  const distanceKm = Number(raw.distance_km ?? 0);
  const durationSeconds = Math.max(1, Math.round(Number(raw.duration_seconds ?? 1)));
  const points = parsePoints(raw.pointsJSON);
  if (points.length < 2 || distanceKm <= 0) {
    Alert.alert('Apple Watch', 'Workout had too few GPS points to save.');
    return;
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
      Alert.alert('Walk saved', 'Your Apple Watch walk was uploaded to ZenRun.');
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
      Alert.alert('Run saved', 'Your Apple Watch run was uploaded to ZenRun.');
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    Alert.alert('Apple Watch sync', msg);
  }
}

let subscription: { remove: () => void } | null = null;

/** Idempotent: call once after the user is authenticated (e.g. from AppNavigator). */
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

  subscription = {
    remove: () => {
      sub.remove();
      subscription = null;
    },
  };
  return subscription;
}
