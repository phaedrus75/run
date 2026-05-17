/**
 * Android Health Connect import — mirrors appleHealth.ios.ts for runs,
 * walks, weight, and VO2 Max. Uses `react-native-health-connect`.
 */

import { Platform } from 'react-native';
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  readRecords,
  requestExerciseRoute,
  openHealthConnectSettings,
  ExerciseType,
  type ExerciseSessionRecord,
} from 'react-native-health-connect';

import {
  runApi,
  walkApi,
  weightApi,
  vo2maxApi,
  maxHrApi,
  healthImportApi,
} from './api';
import type { TrackedPoint } from './walkLocationTracker';
import { encodePolyline } from './walkLocationTracker';
import {
  aggregateHr,
  computeHrRecovery,
  computeSplitsFromRoute,
  encodeHrZones,
  encodeSplits,
  type HrSamplePoint,
  type RoutePoint,
} from './workoutMetrics';
import type {
  HealthActivityType,
  ImportableWorkout,
  ImportResult,
  ImportableWeight,
  ImportableVo2Max,
} from './healthTypes';

export type {
  HealthActivityType,
  ImportableWorkout,
  ImportResult,
  ImportableWeight,
  ImportableVo2Max,
};

const SOURCE = 'health_connect';

const RUN_TYPES = new Set<number>([
  ExerciseType.RUNNING,
  ExerciseType.RUNNING_TREADMILL,
]);

const WALK_TYPES = new Set<number>([
  ExerciseType.WALKING,
  ExerciseType.HIKING,
  ExerciseType.WHEELCHAIR,
]);

const ALL_TYPES = new Set<number>([...RUN_TYPES, ...WALK_TYPES]);

const READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'ElevationGained' as const },
  { accessType: 'read' as const, recordType: 'Weight' as const },
  { accessType: 'read' as const, recordType: 'Vo2Max' as const },
];

const DEFAULT_MAX_HR_BPM = 190;
let cachedMaxHrBpm: number | null = null;
let initDone = false;

export function isAndroidPlatform(): boolean {
  return Platform.OS === 'android';
}

export function isApplePlatform(): boolean {
  return false;
}

async function ensureInitialized(): Promise<boolean> {
  if (!isAndroidPlatform()) return false;
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    if (!initDone) {
      initDone = await initialize();
    }
    return initDone;
  } catch {
    return false;
  }
}

export function getAvailability(): boolean {
  return isAndroidPlatform();
}

export async function requestAuth(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  try {
    await requestPermission(READ_PERMISSIONS);
    return true;
  } catch (err) {
    console.warn('[healthConnect] requestAuth failed:', err);
    return false;
  }
}

export function openHealthSettings(): void {
  try {
    openHealthConnectSettings();
  } catch {}
}

async function loadMaxHrPreference(): Promise<number> {
  if (cachedMaxHrBpm != null) return cachedMaxHrBpm;
  try {
    const pref = await maxHrApi.get();
    cachedMaxHrBpm =
      pref.effective_max_hr_bpm && pref.effective_max_hr_bpm > 0
        ? pref.effective_max_hr_bpm
        : pref.default_bpm || DEFAULT_MAX_HR_BPM;
  } catch {
    cachedMaxHrBpm = DEFAULT_MAX_HR_BPM;
  }
  return cachedMaxHrBpm;
}

export function invalidateMaxHrCache(): void {
  cachedMaxHrBpm = null;
}

function lengthToMeters(l: {
  value?: number;
  unit?: string;
  inMeters?: number;
}): number {
  if (typeof l.inMeters === 'number' && Number.isFinite(l.inMeters)) {
    return l.inMeters;
  }
  const value = l.value ?? 0;
  switch (l.unit) {
    case 'kilometers':
      return value * 1000;
    case 'miles':
      return value * 1609.344;
    case 'feet':
      return value * 0.3048;
    case 'inches':
      return value * 0.0254;
    case 'meters':
    default:
      return value;
  }
}

function massToLbs(m: {
  value?: number;
  unit?: string;
  inPounds?: number;
  inKilograms?: number;
}): number {
  if (typeof m.inPounds === 'number' && Number.isFinite(m.inPounds)) {
    return m.inPounds;
  }
  if (typeof m.inKilograms === 'number' && Number.isFinite(m.inKilograms)) {
    return m.inKilograms * 2.20462;
  }
  const value = m.value ?? 0;
  switch (m.unit) {
    case 'kilograms':
      return value * 2.20462;
    case 'grams':
      return (value / 1000) * 2.20462;
    case 'pounds':
    default:
      return value;
  }
}

function sessionId(s: ExerciseSessionRecord): string {
  return s.metadata?.id ?? `${s.startTime}-${s.exerciseType}`;
}

function readSourceLabel(s: ExerciseSessionRecord): string {
  const name = s.metadata?.dataOrigin;
  if (!name) return 'Health Connect';
  const known: Record<string, string> = {
    'com.google.android.apps.fitness': 'Google Fit',
    'com.google.android.apps.healthdata': 'Health Connect',
    'com.strava': 'Strava',
    'com.garmin.android.apps.connectmobile': 'Garmin',
    'com.fitbit.FitbitMobile': 'Fitbit',
    'com.xiaomi.wearable': 'Mi Fitness',
    'com.mi.health': 'Mi Fitness',
  };
  for (const [pkg, label] of Object.entries(known)) {
    if (name.includes(pkg) || name === pkg) return label;
  }
  const short = name.split('.').pop();
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : 'Health Connect';
}

async function distanceKmForSession(
  session: ExerciseSessionRecord,
): Promise<number> {
  try {
    const res = await readRecords('Distance', {
      timeRangeFilter: {
        operator: 'between',
        startTime: session.startTime,
        endTime: session.endTime,
      },
    });
    let meters = 0;
    for (const r of res.records) {
      meters += lengthToMeters(r.distance);
    }
    return meters / 1000;
  } catch {
    return 0;
  }
}

function projectSession(
  session: ExerciseSessionRecord,
  distanceKm: number,
): ImportableWorkout {
  const startedAt = new Date(session.startTime);
  const endedAt = new Date(session.endTime);
  const wallSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const kind: 'run' | 'walk' = RUN_TYPES.has(session.exerciseType)
    ? 'run'
    : 'walk';

  return {
    uuid: sessionId(session),
    kind,
    activityType: session.exerciseType,
    startedAt,
    endedAt,
    durationSeconds: wallSeconds,
    distanceKm,
    hasRoute: distanceKm > 0,
    sourceLabel: readSourceLabel(session),
    _internal: session,
  };
}

interface ListOptions {
  sinceDays?: number;
  limit?: number;
  includeImported?: boolean;
}

export async function listImportableWorkouts(
  options: ListOptions = {},
): Promise<ImportableWorkout[]> {
  if (!(await ensureInitialized())) return [];
  const sinceDays = options.sinceDays ?? 60;
  const limit = options.limit ?? 100;
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  let sessions: ExerciseSessionRecord[] = [];
  try {
    const res = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'after',
        startTime: since.toISOString(),
      },
    });
    sessions = (res.records as ExerciseSessionRecord[]).filter((s) =>
      ALL_TYPES.has(s.exerciseType),
    );
    sessions.sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  } catch (err) {
    console.warn('[healthConnect] read ExerciseSession failed:', err);
    return [];
  }

  const projected: ImportableWorkout[] = [];
  for (const s of sessions) {
    if (projected.length >= limit) break;
    const km = await distanceKmForSession(s);
    projected.push(projectSession(s, km));
  }

  if (options.includeImported) return projected;

  try {
    const existing = await healthImportApi.listImportedIds(SOURCE);
    const taken = new Set(existing.external_ids);
    return projected.filter((w) => !taken.has(w.uuid));
  } catch {
    return projected;
  }
}

async function loadRoutePoints(
  session: ExerciseSessionRecord,
): Promise<TrackedPoint[]> {
  const id = session.metadata?.id;
  if (!id) return [];

  try {
    const route = await requestExerciseRoute(id);
    const locs = route?.route ?? [];
    if (!locs.length) return [];
    return locs.map((loc) => ({
      lat: loc.latitude,
      lng: loc.longitude,
      timestamp: new Date(loc.time).getTime(),
      altitude:
        loc.altitude != null ? lengthToMeters(loc.altitude as any) : null,
      accuracy:
        loc.horizontalAccuracy != null
          ? lengthToMeters(loc.horizontalAccuracy as any)
          : null,
      speed: null,
    }));
  } catch (err) {
    console.warn('[healthConnect] requestExerciseRoute failed:', err);
    return [];
  }
}

async function loadWorkoutMetrics(
  session: ExerciseSessionRecord,
  points: TrackedPoint[],
): Promise<{
  calories_kcal?: number;
  avg_hr_bpm?: number;
  max_hr_bpm?: number;
  avg_cadence_spm?: number;
  elevation_gain_m?: number;
  splits_json?: string;
  hr_zones_json?: string;
  hr_recovery_bpm?: number;
}> {
  const startedAt = new Date(session.startTime);
  const endedAt = new Date(session.endTime);
  const range = {
    operator: 'between' as const,
    startTime: session.startTime,
    endTime: session.endTime,
  };
  const out: Record<string, unknown> = {};

  try {
    const cal = await readRecords('ActiveCaloriesBurned', { timeRangeFilter: range });
    let kcal = 0;
    for (const r of cal.records) {
      const e = r.energy as { value?: number; unit?: string; inKilocalories?: number };
      if (typeof e.inKilocalories === 'number') kcal += e.inKilocalories;
      else if (e.unit === 'kilocalories' && e.value) kcal += e.value;
      else if (e.unit === 'kilojoules' && e.value) kcal += e.value / 4.184;
    }
    if (kcal > 0) out.calories_kcal = Math.round(kcal);
  } catch {}

  const hrSamples: HrSamplePoint[] = [];
  try {
    const hr = await readRecords('HeartRate', { timeRangeFilter: range });
    for (const r of hr.records) {
      for (const s of r.samples) {
        hrSamples.push({
          bpm: s.beatsPerMinute,
          timestamp: new Date(s.time).getTime(),
        });
      }
    }
    if (hrSamples.length > 0) {
      const maxHr = await loadMaxHrPreference();
      const agg = aggregateHr(hrSamples, maxHr);
      if (agg) {
        if (agg.avg_bpm) out.avg_hr_bpm = agg.avg_bpm;
        if (agg.max_bpm) out.max_hr_bpm = agg.max_bpm;
        if (agg.zones) out.hr_zones_json = encodeHrZones(agg.zones);
      }
      const recovery = computeHrRecovery(endedAt.getTime(), hrSamples);
      if (recovery != null) out.hr_recovery_bpm = recovery;
    }
  } catch {}

  try {
    const steps = await readRecords('Steps', { timeRangeFilter: range });
    let total = 0;
    for (const r of steps.records) total += r.count;
    const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000;
    if (total > 0 && minutes > 0) {
      const spm = Math.round(total / minutes);
      if (spm >= 30 && spm <= 250) out.avg_cadence_spm = spm;
    }
  } catch {}

  try {
    const elev = await readRecords('ElevationGained', { timeRangeFilter: range });
    let meters = 0;
    for (const r of elev.records) meters += lengthToMeters(r.elevation);
    if (meters > 0) out.elevation_gain_m = Math.round(meters);
  } catch {}

  if (points.length >= 2) {
    const splitInputs: RoutePoint[] = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
    }));
    const splits = computeSplitsFromRoute(
      splitInputs,
      hrSamples.filter(
        (s) =>
          s.timestamp >= startedAt.getTime() &&
          s.timestamp <= endedAt.getTime(),
      ),
    );
    if (splits.length > 0) out.splits_json = encodeSplits(splits);
  }

  return out as any;
}

function distanceToRunType(km: number): string {
  if (km < 5) return '5K';
  if (km < 10) return '10K';
  if (km < 21.5) return 'Half Marathon';
  if (km < 43) return 'Marathon';
  return 'Ultra';
}

function sessionRecord(w: ImportableWorkout): ExerciseSessionRecord {
  return w._internal as ExerciseSessionRecord;
}

export async function importWorkout(w: ImportableWorkout): Promise<ImportResult> {
  if (!(await ensureInitialized())) {
    return { ok: false, reason: 'Health Connect unavailable' };
  }
  if (!Number.isFinite(w.distanceKm) || w.distanceKm < 0) {
    return { ok: false, reason: 'Distance missing' };
  }
  if (w.distanceKm > 300) {
    return {
      ok: false,
      reason: `Distance looks invalid (${w.distanceKm.toFixed(0)} km)`,
    };
  }

  const session = sessionRecord(w);
  const points = await loadRoutePoints(session);
  const polyline = points.length > 1 ? encodePolyline(points) : '';
  const start = points[0];
  const end = points[points.length - 1];
  const metrics = await loadWorkoutMetrics(session, points);

  if (w.kind === 'run') {
    const category = points.length > 1 ? 'outdoor' : 'treadmill';
    try {
      const run = await runApi.create({
        run_type: distanceToRunType(w.distanceKm || 0),
        duration_seconds: w.durationSeconds,
        distance_km: Number((w.distanceKm || 0).toFixed(3)),
        category,
        started_at: w.startedAt.toISOString(),
        completed_at: w.endedAt.toISOString(),
        route_polyline: polyline || undefined,
        start_lat: start?.lat,
        start_lng: start?.lng,
        end_lat: end?.lat,
        end_lng: end?.lng,
        elevation_gain_m: metrics.elevation_gain_m,
        source: SOURCE,
        external_id: w.uuid,
        calories_kcal: metrics.calories_kcal,
        avg_hr_bpm: metrics.avg_hr_bpm,
        max_hr_bpm: metrics.max_hr_bpm,
        avg_cadence_spm: metrics.avg_cadence_spm,
        splits_json: metrics.splits_json,
        hr_zones_json: metrics.hr_zones_json,
        hr_recovery_bpm: metrics.hr_recovery_bpm,
      });
      return { ok: true, run };
    } catch (err: any) {
      return { ok: false, reason: err?.message || 'Failed to import run' };
    }
  }

  const category = points.length > 1 ? 'outdoor' : 'indoor';
  try {
    const walk = await walkApi.create({
      duration_seconds: w.durationSeconds,
      distance_km: Number((w.distanceKm || 0).toFixed(3)),
      started_at: w.startedAt.toISOString(),
      ended_at: w.endedAt.toISOString(),
      route_polyline: polyline || undefined,
      start_lat: start?.lat,
      start_lng: start?.lng,
      end_lat: end?.lat,
      end_lng: end?.lng,
      elevation_gain_m: metrics.elevation_gain_m,
      category,
      source: SOURCE,
      external_id: w.uuid,
      calories_kcal: metrics.calories_kcal,
      avg_hr_bpm: metrics.avg_hr_bpm,
      max_hr_bpm: metrics.max_hr_bpm,
      avg_cadence_spm: metrics.avg_cadence_spm,
      splits_json: metrics.splits_json,
      hr_zones_json: metrics.hr_zones_json,
      hr_recovery_bpm: metrics.hr_recovery_bpm,
    });
    return { ok: true, walk };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Failed to import walk' };
  }
}

export async function importMany(
  workouts: ImportableWorkout[],
): Promise<{ imported: number; skipped: number; failed: number }> {
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  for (const w of workouts) {
    const res = await importWorkout(w);
    if (res.ok) imported += 1;
    else if (res.reason?.includes('already')) skipped += 1;
    else failed += 1;
  }
  return { imported, skipped, failed };
}

export async function requestWeightAuth(): Promise<boolean> {
  return requestAuth();
}

export async function listImportableWeights(
  options: { since?: Date; limit?: number; includeImported?: boolean } = {},
): Promise<ImportableWeight[]> {
  if (!(await ensureInitialized())) return [];
  const since =
    options.since ?? new Date(new Date().getFullYear(), 0, 1);
  const limit = options.limit ?? 365;

  let raw: Awaited<ReturnType<typeof readRecords<'Weight'>>>['records'] = [];
  try {
    const res = await readRecords('Weight', {
      timeRangeFilter: { operator: 'after', startTime: since.toISOString() },
    });
    raw = res.records;
  } catch {
    return [];
  }

  const projected: ImportableWeight[] = [];
  for (const s of raw) {
    const uuid = s.metadata?.id;
    if (!uuid) continue;
    const lbs = massToLbs(s.weight);
    if (lbs < 30 || lbs > 700) continue;
    projected.push({
      uuid,
      weightLbs: Number(lbs.toFixed(2)),
      recordedAt: new Date(s.time),
      sourceLabel: 'Health Connect',
    });
    if (projected.length >= limit) break;
  }

  if (options.includeImported) return projected;
  try {
    const existing = await healthImportApi.listImportedIds('health_connect', 'weight');
    const taken = new Set(existing.external_ids);
    return projected.filter((w) => !taken.has(w.uuid));
  } catch {
    return projected;
  }
}

export async function importWeight(
  entry: ImportableWeight,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await weightApi.create({
      weight_lbs: entry.weightLbs,
      recorded_at: entry.recordedAt.toISOString(),
      source: 'health_connect',
      external_id: entry.uuid,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message };
  }
}

export async function importManyWeights(
  entries: ImportableWeight[],
): Promise<{ imported: number; skipped: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const e of entries) {
    const res = await importWeight(e);
    if (res.ok) imported += 1;
    else failed += 1;
  }
  return { imported, skipped: 0, failed };
}

export async function autoSyncWeightsFromHealth(
  options: { since?: Date; limit?: number } = {},
): Promise<{ imported: number; skipped: number }> {
  const fresh = await listImportableWeights(options);
  if (fresh.length === 0) return { imported: 0, skipped: 0 };
  const res = await importManyWeights(fresh);
  return { imported: res.imported, skipped: res.failed };
}

export async function listImportableVo2Max(
  options: { sinceDays?: number; limit?: number } = {},
): Promise<ImportableVo2Max[]> {
  if (!(await ensureInitialized())) return [];
  const sinceDays = options.sinceDays ?? 365;
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  try {
    const res = await readRecords('Vo2Max', {
      timeRangeFilter: { operator: 'after', startTime: since.toISOString() },
    });
    const out: ImportableVo2Max[] = [];
    for (const r of res.records) {
      const id = r.metadata?.id;
      if (!id) continue;
      out.push({
        uuid: id,
        recordedAt: new Date(r.time),
        valueMlKgMin: r.vo2MillilitersPerMinuteKilogram,
        sourceLabel: 'Health Connect',
      });
    }
    return out.slice(0, options.limit ?? 100);
  } catch {
    return [];
  }
}

export async function importVo2Max(
  sample: ImportableVo2Max,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await vo2maxApi.create({
      value_ml_kg_min: sample.valueMlKgMin,
      recorded_at: sample.recordedAt.toISOString(),
      source: 'health_connect',
      external_id: sample.uuid,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message };
  }
}

export async function importManyVo2Max(
  samples: ImportableVo2Max[],
): Promise<{ imported: number; skipped: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const s of samples) {
    const res = await importVo2Max(s);
    if (res.ok) imported += 1;
    else failed += 1;
  }
  return { imported, skipped: 0, failed };
}

export async function autoSyncVo2MaxFromHealth(): Promise<{
  imported: number;
  skipped: number;
}> {
  const fresh = await listImportableVo2Max({ sinceDays: 365, limit: 50 });
  if (fresh.length === 0) return { imported: 0, skipped: 0 };
  try {
    const existing = await healthImportApi.listImportedIds('health_connect', 'vo2max');
    const taken = new Set(existing.external_ids);
    const toImport = fresh.filter((s) => !taken.has(s.uuid));
    const res = await importManyVo2Max(toImport);
    return { imported: res.imported, skipped: res.failed };
  } catch {
    return { imported: 0, skipped: 0 };
  }
}

export function activityLabel(t: HealthActivityType): string {
  const n = typeof t === 'number' ? t : Number(t);
  switch (n) {
    case ExerciseType.RUNNING:
      return 'Run';
    case ExerciseType.RUNNING_TREADMILL:
      return 'Treadmill run';
    case ExerciseType.WALKING:
      return 'Walk';
    case ExerciseType.HIKING:
      return 'Hike';
    case ExerciseType.WHEELCHAIR:
      return 'Wheelchair';
    default:
      return 'Workout';
  }
}
