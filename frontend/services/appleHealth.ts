/**
 * 🍎 services/appleHealth.ts
 * ─────────────────────────────────────────────────────────────────────
 * Apple Health (HealthKit) workout import.
 *
 * iOS-only. Reads the user's HKWorkouts (runs / walks / hikes recorded
 * via Apple Watch or the iPhone) and pushes them to ZenRun via the
 * existing run / walk create endpoints, tagged with `source =
 * "apple_health"` and `external_id = <HKWorkout.uuid>` so the backend
 * can dedupe re-imports.
 *
 * The native HealthKit JS bridge is `@kingstinct/react-native-healthkit`.
 * It throws on Android/web, so every public function in this module is
 * platform-guarded — callers can blindly invoke them and we'll return
 * empty/false on non-iOS.
 *
 * Surface area:
 *   - getAvailability()          — is HK present + reachable on this device
 *   - requestAuth()              — show the iOS HK auth sheet (first run)
 *   - listImportableWorkouts()   — last 60d of runs/walks/hikes minus
 *                                  what's already in ZenRun (server-side
 *                                  dedupe)
 *   - importWorkout(workout)     — pull route + push to backend
 *   - importMany(workouts)       — best-effort batch wrapper
 */

import { Platform } from 'react-native';
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryWorkoutSamples,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  WorkoutRouteTypeIdentifier,
  type WorkoutProxyTyped,
  type WorkoutRouteLocation,
} from '@kingstinct/react-native-healthkit';

import { runApi, walkApi, healthImportApi, type Run, type Walk } from './api';
import type { TrackedPoint } from './walkLocationTracker';
import { encodePolyline } from './walkLocationTracker';

const SOURCE = 'apple_health';

// HK distinguishes ~80 activity types; ZenRun cares about the four that
// map cleanly onto its runs / walks model. Order matters: keep most
// common first so the picker sorts naturally.
const RUN_TYPES: readonly WorkoutActivityType[] = [
  WorkoutActivityType.running,
  WorkoutActivityType.wheelchairRunPace,
] as const;

const WALK_TYPES: readonly WorkoutActivityType[] = [
  WorkoutActivityType.walking,
  WorkoutActivityType.hiking,
  WorkoutActivityType.wheelchairWalkPace,
] as const;

const ALL_TYPES: readonly WorkoutActivityType[] = [
  ...RUN_TYPES,
  ...WALK_TYPES,
] as const;

// ---------------------------------------------------------------------
//  Public surface — clean, framework-agnostic shapes the UI consumes
// ---------------------------------------------------------------------

/** What the import picker actually renders. */
export interface ImportableWorkout {
  /** Stable HK UUID. We send this to the backend as `external_id` so
   *  re-imports of the same workout collapse into the existing row. */
  uuid: string;
  /** Resolved into "run" or "walk" — drives which ZenRun model + screen
   *  the import lands in. Hikes count as walks. */
  kind: 'run' | 'walk';
  /** The original HK enum value, for the UI to show a finer label
   *  (e.g. "Hike" vs "Walk"). */
  activityType: WorkoutActivityType;
  startedAt: Date;
  endedAt: Date;
  /** Calendar-aware duration in seconds, derived from start/end so we
   *  don't get tripped up by paused-workout `duration` quirks. */
  durationSeconds: number;
  /** Best-effort distance in km. Indoor workouts can have 0/null here. */
  distanceKm: number;
  /** True when HK has at least one route sample for this workout —
   *  i.e. it was recorded outdoors with GPS. Indoor runs/walks come
   *  through but with no polyline. */
  hasRoute: boolean;
  /** Source label suitable for showing in the picker
   *  (e.g. "Apple Watch", "iPhone"). */
  sourceLabel: string;
  /** Carry the underlying proxy so we can call `.getWorkoutRoutes()`
   *  during import without re-querying. Hidden in TypeScript so the UI
   *  doesn't accidentally serialise it. */
  _proxy: WorkoutProxyTyped;
}

export interface ImportResult {
  ok: boolean;
  /** The created run or walk on success. */
  run?: Run;
  walk?: Walk;
  /** When `ok=false`, a short user-facing reason. */
  reason?: string;
}

// ---------------------------------------------------------------------
//  Availability + authorization
// ---------------------------------------------------------------------

export function isApplePlatform(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Cheap, synchronous "should we even try" check. Returns false on
 * Android, on iOS simulator without HK seed data, or on iOS versions
 * predating the package's deployment target.
 */
export function getAvailability(): boolean {
  if (!isApplePlatform()) return false;
  try {
    return Boolean(isHealthDataAvailable());
  } catch {
    return false;
  }
}

/**
 * Show the iOS HealthKit auth sheet for the workout types we care
 * about. The sheet appears once per app install per data type; after
 * that iOS remembers the user's choice and `requestAuthorization`
 * returns immediately without prompting.
 *
 * Returns `true` if HK is reachable and the call didn't throw — note
 * that Apple deliberately *does not* tell us whether the user granted
 * permission (privacy by design). The only way to know is to try a
 * query and see if it returns rows. We treat "no rows" as "either no
 * data or no permission" and surface a soft empty state rather than an
 * error in the UI.
 */
export async function requestAuth(): Promise<boolean> {
  if (!getAvailability()) return false;
  try {
    await requestAuthorization({
      // Read-only — we never write workouts back to HK from the import
      // flow. The watch app handles writes during live workouts.
      toRead: [
        WorkoutTypeIdentifier,
        WorkoutRouteTypeIdentifier,
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
      ],
      toShare: [],
    });
    return true;
  } catch (err) {
    // Don't surface this as a hard error — auth failures usually mean
    // the user dismissed the sheet, which is fine.
    console.warn('[appleHealth] requestAuth failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------
//  Listing
// ---------------------------------------------------------------------

interface ListOptions {
  /** Default: 60 days back. Apple Watch users tend to have hundreds of
   *  workouts, so we bound the picker to a useful window. */
  sinceDays?: number;
  /** Hard cap on rows returned. The UI virtualises but we still don't
   *  want to fetch 5k workouts on a power user's device. */
  limit?: number;
  /** When true, skip the dedupe roundtrip to the backend and return
   *  every HK workout in range — used by the "view all imports"
   *  diagnostic in Profile. */
  includeImported?: boolean;
}

/**
 * Fetches the user's HK runs/walks/hikes in the last N days, minus
 * anything already in ZenRun (joined by HK uuid against the backend's
 * imported-workout-ids endpoint).
 */
export async function listImportableWorkouts(
  options: ListOptions = {},
): Promise<ImportableWorkout[]> {
  if (!getAvailability()) return [];
  const sinceDays = options.sinceDays ?? 60;
  const limit = options.limit ?? 100;

  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  // 1) Pull HK workouts. The package exposes a single query that
  //    returns the most recent workouts across all types; we filter by
  //    activity type client-side because the OR predicate is fiddly to
  //    construct via the JS API and the volume here is small.
  let raw: readonly WorkoutProxyTyped[] = [];
  try {
    raw = await queryWorkoutSamples({
      limit: Math.max(limit * 2, 50), // allow headroom for type filter
      ascending: false, // newest first
    });
  } catch (err) {
    console.warn('[appleHealth] queryWorkoutSamples failed:', err);
    return [];
  }

  // 2) Project + filter to runs/walks/hikes inside the time window.
  const projected: ImportableWorkout[] = [];
  for (const w of raw) {
    if (!ALL_TYPES.includes(w.workoutActivityType)) continue;
    const startedAt = w.startDate;
    if (!startedAt || startedAt < since) continue;
    projected.push(projectWorkout(w));
    if (projected.length >= limit) break;
  }

  if (options.includeImported) {
    return projected;
  }

  // 3) Dedupe against what the backend already has. A best-effort
  //    network call: on failure we still return the full list so the
  //    user can manually identify dupes, rather than blocking the UI.
  try {
    const existing = await healthImportApi.listImportedIds(SOURCE);
    const taken = new Set(existing.external_ids);
    return projected.filter((w) => !taken.has(w.uuid));
  } catch (err) {
    console.warn('[appleHealth] dedupe lookup failed:', err);
    return projected;
  }
}

function projectWorkout(w: WorkoutProxyTyped): ImportableWorkout {
  const startedAt = w.startDate;
  const endedAt = w.endDate;
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const distanceKm = Number(w.totalDistance?.quantity ?? 0);
  const kind: 'run' | 'walk' = RUN_TYPES.includes(w.workoutActivityType)
    ? 'run'
    : 'walk';
  // HKWorkout doesn't directly tell us "has route". The cheap proxy is:
  // outdoor workouts have a non-zero totalDistance + a watch source. We
  // refine this by trying a route fetch only at import time; for the
  // picker, distance > 0 is "probably has GPS".
  const hasRoute = distanceKm > 0;

  // Source label — HK exposes the originating app/device via
  // `metadata.HKMetadataKeyDevicePlacementSide` etc., but the
  // user-friendly answer is in `device.name` ("Apple Watch") on most
  // workouts. Fall back to "Apple Health" for anything else.
  const sourceLabel = readSourceLabel(w);

  return {
    uuid: (w as any).uuid ?? `hk-${startedAt.getTime()}`,
    kind,
    activityType: w.workoutActivityType,
    startedAt,
    endedAt,
    durationSeconds,
    distanceKm,
    hasRoute,
    sourceLabel,
    _proxy: w,
  };
}

function readSourceLabel(w: WorkoutProxyTyped): string {
  // The package exposes the source via `sourceRevision` on the
  // underlying sample. Different package versions surface it slightly
  // differently — we read defensively and fall back gracefully.
  const anyW: any = w;
  const candidate =
    anyW?.device?.name ||
    anyW?.sourceRevision?.source?.name ||
    anyW?.sourceRevision?.productType ||
    anyW?.metadata?.HKMetadataKeyDeviceName ||
    null;
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  return 'Apple Health';
}

// ---------------------------------------------------------------------
//  Importing
// ---------------------------------------------------------------------

/**
 * Pull route locations for a workout, flatten them into the
 * `TrackedPoint`-like shape ZenRun's polyline encoder expects.
 *
 * HK can return multiple `WorkoutRoute` objects for a single workout
 * (e.g. paused/resumed sessions). We concatenate them in their
 * recorded order, then sort by timestamp as a safety net for
 * out-of-order watch syncs.
 */
async function loadRoutePoints(
  workout: WorkoutProxyTyped,
): Promise<TrackedPoint[]> {
  let routes: readonly { locations: readonly WorkoutRouteLocation[] }[] = [];
  try {
    routes = await workout.getWorkoutRoutes();
  } catch (err) {
    console.warn('[appleHealth] getWorkoutRoutes failed:', err);
    return [];
  }
  if (!routes || routes.length === 0) return [];

  const all: WorkoutRouteLocation[] = [];
  for (const r of routes) {
    if (r?.locations?.length) all.push(...r.locations);
  }
  all.sort((a, b) => a.date.getTime() - b.date.getTime());

  return all.map<TrackedPoint>((loc) => ({
    lat: loc.latitude,
    lng: loc.longitude,
    timestamp: loc.date.getTime(),
    altitude: loc.altitude ?? null,
    accuracy: loc.horizontalAccuracy ?? null,
    speed: loc.speed ?? null,
  }));
}

/** Standard ZenRun bucket mapping for runs imported via HK. */
function distanceToRunType(km: number): string {
  const buckets = [1, 2, 3, 5, 8, 10, 15, 18, 21];
  for (const b of buckets) {
    if (km <= b + 0.5) return `${b}k`;
  }
  return '21k';
}

/**
 * Import a single workout into ZenRun. Idempotent — calling twice on
 * the same HK uuid returns the existing run/walk thanks to the
 * backend's source+external_id dedupe.
 *
 * The resulting run's `category` reflects whether HK had route data:
 * outdoor workouts go in as "outdoor", indoor / no-GPS workouts go in
 * as "treadmill" (runs) or "indoor" (walks). Distance flows through
 * even for indoor sessions, so step counts / treadmill workouts still
 * land in stats.
 */
export async function importWorkout(
  w: ImportableWorkout,
): Promise<ImportResult> {
  if (!getAvailability()) {
    return { ok: false, reason: 'HealthKit unavailable on this device' };
  }
  if (w.distanceKm < 0 || w.distanceKm > 200) {
    return { ok: false, reason: 'Distance looks invalid' };
  }

  // Pull the route. Failure here is non-fatal — we still create the
  // workout with no polyline, mirroring how indoor runs flow through
  // ZenRun today.
  const points = await loadRoutePoints(w._proxy);
  const polyline = points.length > 1 ? encodePolyline(points) : '';
  const start = points[0];
  const end = points[points.length - 1];

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
        source: SOURCE,
        external_id: w.uuid,
      });
      return { ok: true, run };
    } catch (err: any) {
      return {
        ok: false,
        reason: err?.message || 'Failed to import run',
      };
    }
  }

  // Walk / hike path.
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
      category,
      source: SOURCE,
      external_id: w.uuid,
    });
    return { ok: true, walk };
  } catch (err: any) {
    return {
      ok: false,
      reason: err?.message || 'Failed to import walk',
    };
  }
}

/**
 * Sequentially import a list of workouts. Sequential rather than
 * parallel so the backend doesn't see a thundering herd of POSTs from
 * a single user — power users with 50+ workouts hammer the rate limiter
 * otherwise.
 *
 * Returns aggregate counts; per-row errors are logged but don't stop
 * the run.
 */
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

// ---------------------------------------------------------------------
//  UI helpers
// ---------------------------------------------------------------------

/** Human label for the activity type, e.g. "Outdoor Run", "Hike". */
export function activityLabel(t: WorkoutActivityType): string {
  switch (t) {
    case WorkoutActivityType.running:
      return 'Run';
    case WorkoutActivityType.wheelchairRunPace:
      return 'Run (wheelchair)';
    case WorkoutActivityType.walking:
      return 'Walk';
    case WorkoutActivityType.hiking:
      return 'Hike';
    case WorkoutActivityType.wheelchairWalkPace:
      return 'Walk (wheelchair)';
    default:
      return 'Workout';
  }
}
