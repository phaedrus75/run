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
  queryQuantitySamples,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  WorkoutRouteTypeIdentifier,
  type WorkoutProxyTyped,
  type WorkoutRouteLocation,
} from '@kingstinct/react-native-healthkit';

import {
  runApi,
  walkApi,
  weightApi,
  healthImportApi,
  type Run,
  type Walk,
  type WeightEntry,
} from './api';
import type { TrackedPoint } from './walkLocationTracker';
import { encodePolyline } from './walkLocationTracker';

// HK identifier for body weight. Imported as a string literal because
// the package exposes BodyMass through the generic `queryQuantitySamples`
// API rather than a dedicated constant. Default unit on Apple Watch /
// iPhone is kg; we explicitly request 'lb' to match the backend's
// `weight_lbs` column without rounding errors.
const BODY_MASS_IDENTIFIER = 'HKQuantityTypeIdentifierBodyMass' as const;

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

/**
 * Convert an HK `Quantity` (number + unit string) into kilometres.
 *
 * Why this exists:
 *   `HKWorkout.totalDistance` is an `HKQuantity` whose value is in
 *   whatever unit HealthKit chose at write time. The kingstinct nitro
 *   bridge passes that through verbatim — for `HKWorkoutTypeIdentifier`
 *   that's almost always **metres** (Apple Watch's internal SI default),
 *   but third-party watch faces and Strava-on-HealthKit can write in
 *   miles or even feet.
 *
 *   We were previously reading `quantity` directly and treating it as
 *   km, so a 5 km run came through as 5000 and tripped our `> 200`
 *   sanity guard with the (very misleading) "Distance looks invalid"
 *   error. This converter is the fix.
 *
 * Strategy:
 *   - Map the well-known HK unit strings ('m', 'km', 'mi', 'ft', 'yd',
 *     'cm') explicitly.
 *   - Treat unknown / empty units as metres, because that's HK's
 *     documented default for workout totalDistance, and getting an
 *     import through with a slightly-wrong distance is far better than
 *     dropping it on the floor.
 */
function quantityToKm(
  q?: { unit?: string | null; quantity?: number | null } | null,
): number {
  if (!q) return 0;
  const value = Number(q.quantity);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = String(q.unit ?? '').trim().toLowerCase();
  switch (unit) {
    case 'km':
    case 'kilometer':
    case 'kilometers':
      return value;
    case 'mi':
    case 'mile':
    case 'miles':
      return value * 1.609344;
    case 'ft':
    case 'foot':
    case 'feet':
      return value * 0.0003048;
    case 'yd':
    case 'yard':
    case 'yards':
      return value * 0.0009144;
    case 'cm':
    case 'centimeter':
    case 'centimeters':
      return value / 100_000;
    case 'm':
    case 'meter':
    case 'meters':
    case '':
      return value / 1000;
    default:
      // Unknown unit — log so we can spot new HK exports in the wild,
      // but assume metres (HK default) rather than dropping the import.
      console.warn(
        '[appleHealth] unknown distance unit, assuming meters:',
        q.unit,
      );
      return value / 1000;
  }
}

function projectWorkout(w: WorkoutProxyTyped): ImportableWorkout {
  const startedAt = w.startDate;
  const endedAt = w.endDate;
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const distanceKm = quantityToKm(w.totalDistance);
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
  if (!Number.isFinite(w.distanceKm) || w.distanceKm < 0) {
    return { ok: false, reason: 'Distance missing from HealthKit' };
  }
  if (w.distanceKm > 300) {
    // 300 km is a generous cap — the longest ultras top out around
    // 250 km. Anything above this is almost certainly a unit mix-up
    // we haven't accounted for.
    return {
      ok: false,
      reason: `Distance looks invalid (${w.distanceKm.toFixed(0)} km)`,
    };
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

// ─────────────────────────────────────────────────────────────────────
//  ⚖️ Weight auto-sync (HKQuantityTypeIdentifierBodyMass)
// ─────────────────────────────────────────────────────────────────────
//
//  The Weight tab uses Apple Health as its source of truth for users
//  with a smart scale. Every focus of the tab triggers a silent pull
//  that:
//    1. queries body-mass samples in the date window
//    2. asks the backend which uuids it already has
//    3. POSTs only the new ones to /weights with source=apple_health
//
//  Auth is requested separately from the workout flow so we don't
//  prompt for body-mass access on users who never visit the Weight
//  tab.

const WEIGHT_SOURCE = 'apple_health';

/** Stable shape the WeightTab consumes. Keeps HKQuantitySample's
 *  `quantity` / `unit` plumbing out of the UI. */
export interface ImportableWeight {
  /** HKQuantitySample uuid — sent to the backend as `external_id`. */
  uuid: string;
  /** Pounds — already converted by HK because we requested unit='lb'. */
  weightLbs: number;
  /** Sample timestamp. HK uses startDate==endDate for instantaneous
   *  measurements like body mass, so either is fine. */
  recordedAt: Date;
  /** "Apple Watch", "Withings", "iPhone Health app", etc. */
  sourceLabel: string;
}

/** Show the iOS HealthKit auth sheet for body-mass reads. Scoped
 *  narrowly so we only nudge users who actually open the Weight tab.
 *  Returns `true` when the request didn't throw — note iOS hides the
 *  user's actual choice (privacy by design); the proof is whether the
 *  subsequent query returns rows. */
export async function requestWeightAuth(): Promise<boolean> {
  if (!getAvailability()) return false;
  try {
    await requestAuthorization({
      toRead: [BODY_MASS_IDENTIFIER],
      toShare: [],
    });
    return true;
  } catch (err) {
    console.warn('[appleHealth] requestWeightAuth failed:', err);
    return false;
  }
}

interface ListWeightOptions {
  /** Hard date floor. Defaults to Jan 1 of the current calendar year
   *  to align with ZenRun's annual goal window. Pass an explicit Date
   *  to widen / narrow. */
  since?: Date;
  /** Cap on rows returned. HK quantity queries are quick but a daily
   *  weigher with 20 years of history could push thousands of rows
   *  through the bridge. 365 is plenty for a year-aligned UI. */
  limit?: number;
  /** When true, skip the backend dedupe lookup and return every HK
   *  sample in range — useful for diagnostics / "show me all". */
  includeImported?: boolean;
}

/** Fetches body-mass samples since `options.since` (default: Jan 1 of
 *  the current year), minus any uuids the backend already has. Empty
 *  array on non-iOS, when HK is unreachable, or when the user denied
 *  the auth sheet (HK returns 0 rows in that case — same surface as
 *  "no data"). */
export async function listImportableWeights(
  options: ListWeightOptions = {},
): Promise<ImportableWeight[]> {
  if (!getAvailability()) return [];

  const since =
    options.since ?? new Date(new Date().getFullYear(), 0, 1);
  const limit = options.limit ?? 365;

  let raw: readonly any[] = [];
  try {
    raw = await queryQuantitySamples(BODY_MASS_IDENTIFIER, {
      // Pounds match our backend column directly. The package converts
      // server-side; we get back numbers, no unit math required.
      unit: 'lb',
      limit,
      ascending: false,
      filter: {
        date: {
          startDate: since,
          // No endDate → unbounded forward, picks up future samples
          // taken between syncs.
        },
      },
    });
  } catch (err) {
    console.warn('[appleHealth] queryQuantitySamples(BodyMass) failed:', err);
    return [];
  }

  const projected: ImportableWeight[] = [];
  for (const s of raw) {
    const uuid: string | undefined = (s as any).uuid;
    const lbs = Number(s?.quantity ?? 0);
    const recordedAt: Date | undefined = s?.startDate ?? s?.endDate;
    if (!uuid || !recordedAt || !Number.isFinite(lbs)) continue;
    // Drop obviously-bad samples — humans don't weigh 5 lb or 750 lb,
    // and HK occasionally surfaces test/garbage rows on dev devices.
    if (lbs < 30 || lbs > 700) continue;
    projected.push({
      uuid,
      weightLbs: Number(lbs.toFixed(2)),
      recordedAt,
      sourceLabel: readSampleSourceLabel(s),
    });
  }

  if (options.includeImported) return projected;

  try {
    const existing = await healthImportApi.listImportedIds(
      WEIGHT_SOURCE,
      'weight',
    );
    const taken = new Set(existing.external_ids);
    return projected.filter((w) => !taken.has(w.uuid));
  } catch (err) {
    console.warn('[appleHealth] weight dedupe lookup failed:', err);
    return projected;
  }
}

function readSampleSourceLabel(sample: any): string {
  // Mirrors `readSourceLabel` for workouts. HK's quantity sample shape
  // exposes the originating app/device through `sourceRevision`,
  // sometimes `device`. We probe several keys defensively because
  // different HK clients (Apple Watch, Withings, MyFitnessPal, the
  // user's finger in the Health app) populate slightly different
  // fields.
  const candidate =
    sample?.device?.name ||
    sample?.sourceRevision?.source?.name ||
    sample?.sourceRevision?.productType ||
    sample?.metadata?.HKMetadataKeyDeviceName ||
    null;
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  return 'Apple Health';
}

/** Push a single body-mass sample to the backend. Idempotent thanks
 *  to the server-side (user_id, source, external_id) dedupe. */
export async function importWeight(
  w: ImportableWeight,
): Promise<{ ok: boolean; entry?: WeightEntry; reason?: string }> {
  if (!getAvailability()) {
    return { ok: false, reason: 'HealthKit unavailable on this device' };
  }
  try {
    const entry = await weightApi.create({
      weight_lbs: w.weightLbs,
      recorded_at: w.recordedAt.toISOString(),
      source: WEIGHT_SOURCE,
      external_id: w.uuid,
    });
    return { ok: true, entry };
  } catch (err: any) {
    return {
      ok: false,
      reason: err?.message || 'Failed to import weight',
    };
  }
}

/** Sequentially imports a batch of weight samples. Sequential rather
 *  than parallel for the same backend-friendliness reason as
 *  `importMany` — a daily weigher syncing for the first time can
 *  push 100+ rows. */
export async function importManyWeights(
  weights: ImportableWeight[],
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const w of weights) {
    const res = await importWeight(w);
    if (res.ok) imported += 1;
    else failed += 1;
  }
  return { imported, failed };
}

/** Convenience: do the whole "auto-sync since Jan 1" dance in one
 *  call. Returns counts so the caller can show a discreet "Synced N"
 *  status line. Safe to invoke on every WeightTab focus — the dedupe
 *  lookup means we only POST genuinely new samples. */
export async function autoSyncWeightsFromHealth(
  options: ListWeightOptions = {},
): Promise<{ imported: number; failed: number; available: boolean }> {
  if (!getAvailability()) {
    return { imported: 0, failed: 0, available: false };
  }
  const fresh = await listImportableWeights(options);
  if (fresh.length === 0) {
    return { imported: 0, failed: 0, available: true };
  }
  const res = await importManyWeights(fresh);
  return { ...res, available: true };
}

// ─────────────────────────────────────────────────────────────────────
//  UI helpers
// ─────────────────────────────────────────────────────────────────────

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
