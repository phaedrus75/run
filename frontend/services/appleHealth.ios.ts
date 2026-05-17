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
  vo2maxApi,
  maxHrApi,
  healthImportApi,
  type Run,
  type Walk,
  type WeightEntry,
  type Vo2MaxSample,
} from './api';
import type { TrackedPoint } from './walkLocationTracker';
import { encodePolyline } from './walkLocationTracker';
import {
  aggregateHr,
  computeHrRecovery,
  computeSplitsFromRoute,
  encodeEvents,
  encodeHrZones,
  encodeSplits,
  type HrSamplePoint,
  type RoutePoint,
  type WorkoutEvent,
  type WorkoutEventType,
} from './workoutMetrics';
import type {
  HealthActivityType,
  ImportableWorkout,
  ImportResult,
} from './healthTypes';

export type { HealthActivityType, ImportableWorkout, ImportResult };

// HK identifier for body weight. Imported as a string literal because
// the package exposes BodyMass through the generic `queryQuantitySamples`
// API rather than a dedicated constant. Default unit on Apple Watch /
// iPhone is kg; we explicitly request 'lb' to match the backend's
// `weight_lbs` column without rounding errors.
const BODY_MASS_IDENTIFIER = 'HKQuantityTypeIdentifierBodyMass' as const;

// 📈 Workout enrichment quantity identifiers. These are queried in the
// time window of an HKWorkout (or, for VO2 Max, standalone) to produce
// the calories / HR / cadence / VO2 trend metrics the detail screens
// surface. All accessed via the generic `queryQuantitySamples` API.
const HEART_RATE_IDENTIFIER = 'HKQuantityTypeIdentifierHeartRate' as const;
const ACTIVE_ENERGY_IDENTIFIER =
  'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const STEP_COUNT_IDENTIFIER = 'HKQuantityTypeIdentifierStepCount' as const;
const FLIGHTS_CLIMBED_IDENTIFIER =
  'HKQuantityTypeIdentifierFlightsClimbed' as const;
const VO2_MAX_IDENTIFIER = 'HKQuantityTypeIdentifierVO2Max' as const;

const SOURCE = 'apple_health';

/** Default max HR baseline used when the user hasn't set one. The
 *  same constant lives on the backend (DEFAULT_MAX_HR_BPM in main.py).
 *  We cache the user's actual preference at module load — see
 *  `loadMaxHrPreference` below. */
const DEFAULT_MAX_HR_BPM = 190;
let cachedMaxHrBpm: number | null = null;

/** Pulls the user's effective max-HR from the backend. Cached for the
 *  process lifetime — the importer reads this once per session. The
 *  server resolves the user's mode (default / age / custom) and
 *  returns the bpm to use, so the client doesn't repeat the logic.
 *  The cache is best-effort only; if the network call fails we fall
 *  back to DEFAULT_MAX_HR_BPM and continue. */
async function loadMaxHrPreference(): Promise<number> {
  if (cachedMaxHrBpm != null) return cachedMaxHrBpm;
  try {
    const pref = await maxHrApi.get();
    cachedMaxHrBpm =
      pref.effective_max_hr_bpm && pref.effective_max_hr_bpm > 0
        ? pref.effective_max_hr_bpm
        : pref.default_bpm || DEFAULT_MAX_HR_BPM;
  } catch (err) {
    console.warn('[appleHealth] maxHrApi.get failed, using default:', err);
    cachedMaxHrBpm = DEFAULT_MAX_HR_BPM;
  }
  return cachedMaxHrBpm;
}

/** Clears the cached max-HR baseline so the next workout import
 *  picks up the user's freshly-saved preference. Call this after the
 *  profile UI saves a new mode. */
export function invalidateMaxHrCache(): void {
  cachedMaxHrBpm = null;
}

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
      //
      // The quantity identifiers cover the Tier-A + Tier-B
      // enrichment metrics surfaced on detail screens:
      //   - DistanceWalkingRunning: route fallback when HKWorkoutRoute
      //     isn't present (rare, but happens for some 3rd-party apps).
      //   - ActiveEnergyBurned + StepCount: per-second samples joined
      //     to the workout window for finer calorie / cadence numbers
      //     than the workout-level totals expose.
      //   - HeartRate: powers avg/max/zones + recovery on the detail
      //     screen and the Guide's HR-aware suggestions.
      //   - FlightsClimbed: stairs as a proxy for elevation when GPS
      //     altitude is sparse (treadmills + indoor runs in towers).
      //   - VO2Max: the cardio fitness trend on the Honors screen.
      // Asking for all of these in a single sheet means the user
      // sees one auth prompt when they first open the import flow,
      // not five staggered ones across screens.
      toRead: [
        WorkoutTypeIdentifier,
        WorkoutRouteTypeIdentifier,
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        ACTIVE_ENERGY_IDENTIFIER,
        HEART_RATE_IDENTIFIER,
        STEP_COUNT_IDENTIFIER,
        FLIGHTS_CLIMBED_IDENTIFIER,
        VO2_MAX_IDENTIFIER,
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

/**
 * Convert an HK `Quantity` carrying a time interval into seconds.
 *
 * Mirrors `quantityToKm`. `HKWorkout.duration` is documented as a
 * `TimeInterval` (seconds), but the nitro bridge surfaces a
 * `Quantity` whose unit is whatever HK chose — typically 's', but
 * occasionally 'min' or 'hr' for some third-party watch faces.
 *
 * Empty / unknown units default to seconds, which is HK's default
 * for duration. Returns 0 for missing / non-finite quantities so
 * callers can fall back to a wall-clock derivation.
 */
function quantityToSeconds(
  q?: { unit?: string | null; quantity?: number | null } | null,
): number {
  if (!q) return 0;
  const value = Number(q.quantity);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = String(q.unit ?? '').trim().toLowerCase();
  switch (unit) {
    case 's':
    case 'sec':
    case 'secs':
    case 'second':
    case 'seconds':
    case '':
      return value;
    case 'ms':
    case 'millisecond':
    case 'milliseconds':
      return value / 1000;
    case 'min':
    case 'minute':
    case 'minutes':
      return value * 60;
    case 'hr':
    case 'hour':
    case 'hours':
      return value * 3600;
    default:
      console.warn(
        '[appleHealth] unknown duration unit, assuming seconds:',
        q.unit,
      );
      return value;
  }
}

/**
 * Convert an HK energy `Quantity` into kilocalories.
 *
 * Apple's `HKWorkout.totalEnergyBurned` is by default in kilocalories
 * but can also surface in kilojoules (especially for imports from
 * European watch faces). This helper handles the four units we'll
 * realistically see; unknown units fall back to "assume kcal" with a
 * warning so we never silently miscount calories by 4×.
 */
function quantityToKcal(
  q?: { unit?: string | null; quantity?: number | null } | null,
): number {
  if (!q) return 0;
  const value = Number(q.quantity);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = String(q.unit ?? '').trim().toLowerCase();
  switch (unit) {
    case 'kcal':
    case 'cal':
    case 'kilocalorie':
    case 'kilocalories':
    case 'calorie':
    case 'calories':
    case '':
      return value;
    case 'kj':
    case 'kjoule':
    case 'kilojoule':
    case 'kilojoules':
      return value / 4.184;
    case 'j':
    case 'joule':
    case 'joules':
      return value / 4184;
    case 'mcal':
    case 'mcalorie':
    case 'millicalorie':
      return value / 1000;
    default:
      console.warn(
        '[appleHealth] unknown energy unit, assuming kcal:',
        q.unit,
      );
      return value;
  }
}

function projectWorkout(w: WorkoutProxyTyped): ImportableWorkout {
  const startedAt = w.startDate;
  const endedAt = w.endDate;
  // Prefer HKWorkout.duration: it's the *active* workout time and
  // excludes pauses (water breaks, red lights, photo stops). That's
  // what Apple Watch shows in the rings and what users remember when
  // they previously logged half marathons by hand. Fall back to
  // wall-clock only if HK didn't supply a duration (rare — happens
  // for some imported third-party workouts).
  const wallSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const activeSeconds = quantityToSeconds(w.duration);
  const durationSeconds = activeSeconds > 0
    ? Math.round(activeSeconds)
    : wallSeconds;
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
    _internal: w,
  };
}

function workoutProxy(w: ImportableWorkout): WorkoutProxyTyped {
  return w._internal as WorkoutProxyTyped;
}

/** Bundle IDs we recognise → friendly display names. Extend as new
 *  Apple/third-party recorders show up in real workout sources. */
const KNOWN_BUNDLE_LABELS: Record<string, string> = {
  'com.apple.health': 'Health',
  'com.apple.Health': 'Health',
  'com.apple.workouts': 'Workout',
  'com.apple.Workouts': 'Workout',
  'com.apple.fitness': 'Fitness',
  'com.apple.Fitness': 'Fitness',
  'com.apple.healthkit': 'Health',
  'com.strava.stravaride': 'Strava',
  'com.nike.nikeplus-gps': 'Nike Run Club',
  'com.runkeeper.RunKeeperPro': 'RunKeeper',
};

/** Strings that occasionally leak from the kingstinct Nitro proxy
 *  layer when an underlying HKSource has a missing/empty name. We
 *  treat these as junk and fall through to the next candidate. */
function looksLikeProxyJunk(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  // Nitro hybrid objects can stringify as "[object Object]" or to
  // their TS interface name ("SourceProxy", "Source Proxy", etc.)
  // when the JS bridge reads an undefined `name` value.
  if (/^\[object/i.test(t)) return true;
  if (/proxy$/i.test(t)) return true;
  if (/\bproxy\b/i.test(t) && t.length < 24) return true;
  return false;
}

function pickStringCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  if (looksLikeProxyJunk(t)) return null;
  return t;
}

function readSourceLabel(w: WorkoutProxyTyped): string {
  // Order of preference:
  //   1. Recording device name (e.g. "Apple Watch", "Munshi's iPhone")
  //   2. Recording app's friendly name from a known bundle ID
  //      (so "com.apple.health" reads as "Health" not as the raw bundle)
  //   3. Recording app's reported name (e.g. "Strava", "Workout")
  //   4. Hardware product code (e.g. "Watch7,1") — last-resort, ugly
  //      but at least factual
  //   5. Generic "Apple Health"
  //
  // We aggressively reject "proxy"-shaped strings at every layer
  // because the kingstinct package occasionally surfaces its Nitro
  // hybrid-object class name when the underlying HKSource.name is
  // empty (typical for auto-detected pedometer walks).
  const anyW: any = w;

  const deviceName = pickStringCandidate(anyW?.device?.name);
  if (deviceName) return deviceName;

  const bundleId = anyW?.sourceRevision?.source?.bundleIdentifier;
  if (typeof bundleId === 'string' && KNOWN_BUNDLE_LABELS[bundleId]) {
    return KNOWN_BUNDLE_LABELS[bundleId];
  }

  const sourceName = pickStringCandidate(anyW?.sourceRevision?.source?.name);
  if (sourceName) return sourceName;

  const productType = pickStringCandidate(anyW?.sourceRevision?.productType);
  if (productType) return productType;

  const metaName = pickStringCandidate(anyW?.metadata?.HKMetadataKeyDeviceName);
  if (metaName) return metaName;

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

// ─────────────────────────────────────────────────────────────────────
//  📈 Workout enrichment metrics extraction
// ─────────────────────────────────────────────────────────────────────

/** What `loadWorkoutMetrics` produces — plumbed straight into the
 *  runApi / walkApi `create()` payload. All fields are optional so
 *  partial data still imports cleanly. */
interface WorkoutEnrichmentPayload {
  calories_kcal?: number;
  avg_hr_bpm?: number;
  max_hr_bpm?: number;
  avg_cadence_spm?: number;
  splits_json?: string;
  hr_zones_json?: string;
  hr_recovery_bpm?: number;
  workout_events_json?: string;
  /** Fed into the run/walk's elevation_gain_m column when GPS altitude
   *  was sparse — uses HK's `totalFlightsClimbed × ~3 m/floor` proxy. */
  elevation_gain_m?: number;
}

/**
 * Pull the bag of optional enrichment metrics for a workout — calories,
 * HR aggregates, cadence, splits, recovery, events.
 *
 * Designed to be very forgiving:
 *   - Each query lives in its own try/catch so a single permission
 *     denial / HK glitch can't poison the rest of the import.
 *   - The function never throws; missing fields are simply omitted.
 *   - Falls back to workout-level totals when per-second samples are
 *     unavailable (some 3rd-party apps write totals only).
 *
 * `routePoints` is passed in — not re-fetched — so the caller can
 * share the same fetch with the polyline builder.
 */
async function loadWorkoutMetrics(
  workout: WorkoutProxyTyped,
  startedAt: Date,
  endedAt: Date,
  routePoints: TrackedPoint[],
): Promise<WorkoutEnrichmentPayload> {
  const out: WorkoutEnrichmentPayload = {};

  // 🔥 Calories — prefer the workout-level total since it's already
  // in the right unit. Per-second samples would let us bucket by
  // split, which we may revisit later.
  try {
    const kcal = quantityToKcal((workout as any).totalEnergyBurned);
    if (kcal > 0 && kcal < 10_000) {
      out.calories_kcal = Math.round(kcal);
    }
  } catch (err) {
    console.warn('[appleHealth] calories extraction failed:', err);
  }

  // 🪜 Floors climbed → elevation gain proxy. ~3 m per floor is the
  // industry rule of thumb (matches what Apple's Activity rings show).
  // Only used when route altitude data is too sparse to derive
  // elevation directly; the GPS-based calc is more accurate when
  // available.
  try {
    const flights = Number((workout as any).totalFlightsClimbed?.quantity);
    if (Number.isFinite(flights) && flights > 0 && flights < 1_000) {
      out.elevation_gain_m = Math.round(flights * 3);
    }
  } catch (err) {
    console.warn('[appleHealth] flights extraction failed:', err);
  }

  // ⏸ Workout events (pauses, laps). Stored on the workout sample
  // itself — no separate query. We map HK's numeric enum into our
  // string-typed events for storage.
  try {
    const rawEvents: ReadonlyArray<{
      type: number | string;
      startDate?: Date;
    }> = (workout as any).events || [];
    if (rawEvents.length > 0) {
      const startMs = startedAt.getTime();
      const eventTypeMap: Record<number, WorkoutEventType> = {
        1: 'pause',
        2: 'resume',
        3: 'lap',
        4: 'marker',
        5: 'motion_paused',
        6: 'motion_resumed',
        7: 'segment',
      };
      const events: WorkoutEvent[] = [];
      for (const ev of rawEvents) {
        if (!ev?.startDate) continue;
        const offsetSec = Math.max(
          0,
          Math.round((ev.startDate.getTime() - startMs) / 1000),
        );
        let type: WorkoutEventType | null = null;
        if (typeof ev.type === 'number') type = eventTypeMap[ev.type] ?? null;
        else if (typeof ev.type === 'string') {
          // Defensive: some bridge versions stringify the enum.
          const lc = ev.type.toLowerCase();
          if (lc === 'pause') type = 'pause';
          else if (lc === 'resume') type = 'resume';
          else if (lc === 'lap') type = 'lap';
          else if (lc === 'marker') type = 'marker';
          else if (lc.startsWith('motionpause')) type = 'motion_paused';
          else if (lc.startsWith('motionresum')) type = 'motion_resumed';
          else if (lc === 'segment') type = 'segment';
        }
        if (!type) continue;
        events.push({ type, offset_sec: offsetSec });
      }
      if (events.length > 0) {
        out.workout_events_json = encodeEvents(events);
      }
    }
  } catch (err) {
    console.warn('[appleHealth] events extraction failed:', err);
  }

  // ❤️ Heart rate — query a window slightly larger than the workout
  // (start − 10s … end + 90s) so we capture the post-workout drop for
  // the recovery metric without missing the first warmup beat.
  let hrSamples: HrSamplePoint[] = [];
  try {
    const hrWindowStart = new Date(startedAt.getTime() - 10_000);
    const hrWindowEnd = new Date(endedAt.getTime() + 90_000);
    const raw: ReadonlyArray<any> = await queryQuantitySamples(
      HEART_RATE_IDENTIFIER,
      {
        // HKHeartRate's canonical unit string is 'count/min'.
        unit: 'count/min',
        limit: 5_000,
        ascending: true,
        filter: {
          date: {
            startDate: hrWindowStart,
            endDate: hrWindowEnd,
          },
        },
      } as any,
    );
    for (const s of raw || []) {
      const bpm = Number(s?.quantity);
      const ts: Date | undefined = s?.startDate ?? s?.endDate;
      if (!Number.isFinite(bpm) || !ts) continue;
      if (bpm < 30 || bpm > 240) continue;
      hrSamples.push({ bpm, timestamp: ts.getTime() });
    }
  } catch (err) {
    console.warn('[appleHealth] HR samples query failed:', err);
  }

  if (hrSamples.length > 0) {
    const inWorkout = hrSamples.filter(
      (s) =>
        s.timestamp >= startedAt.getTime() && s.timestamp <= endedAt.getTime(),
    );
    if (inWorkout.length > 0) {
      const maxHrBaseline = await loadMaxHrPreference();
      const agg = aggregateHr(inWorkout, maxHrBaseline);
      if (agg) {
        out.avg_hr_bpm = agg.avg_bpm;
        out.max_hr_bpm = agg.max_bpm;
        out.hr_zones_json = encodeHrZones(agg.zones);
      }
    }
    const recovery = computeHrRecovery(endedAt.getTime(), hrSamples);
    if (recovery != null) out.hr_recovery_bpm = recovery;
  }

  // 🦵 Cadence — sum step samples in the workout window, divide by
  // active duration (in minutes). Apple's per-second step counts are
  // accurate for outdoor runs/walks; treadmill / indoor data depends
  // on the watch face but is usually fine.
  try {
    const raw: ReadonlyArray<any> = await queryQuantitySamples(
      STEP_COUNT_IDENTIFIER,
      {
        unit: 'count',
        limit: 10_000,
        ascending: true,
        filter: {
          date: {
            startDate: startedAt,
            endDate: endedAt,
          },
        },
      } as any,
    );
    let totalSteps = 0;
    for (const s of raw || []) {
      const n = Number(s?.quantity);
      if (Number.isFinite(n) && n > 0) totalSteps += n;
    }
    const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000;
    if (totalSteps > 0 && minutes > 0) {
      const spm = Math.round(totalSteps / minutes);
      if (spm >= 30 && spm <= 250) {
        out.avg_cadence_spm = spm;
      }
    }
  } catch (err) {
    console.warn('[appleHealth] step samples query failed:', err);
  }

  // 🕐 Splits — derived from the route polyline + (when present) HR
  // samples. We compute these client-side because:
  //   - HK doesn't expose per-km splits as a first-class type.
  //   - We already have the route points in memory.
  //   - The split-with-HR view requires combining the two streams,
  //     which is awkward to do server-side without persisting raw HR.
  if (routePoints.length >= 2) {
    const splitInputs: RoutePoint[] = routePoints.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
    }));
    const splitHr: HrSamplePoint[] = hrSamples.filter(
      (s) =>
        s.timestamp >= startedAt.getTime() && s.timestamp <= endedAt.getTime(),
    );
    const splits = computeSplitsFromRoute(splitInputs, splitHr);
    if (splits.length > 0) {
      out.splits_json = encodeSplits(splits);
    }
  }

  return out;
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
  const proxy = workoutProxy(w);
  const points = await loadRoutePoints(proxy);
  const polyline = points.length > 1 ? encodePolyline(points) : '';
  const start = points[0];
  const end = points[points.length - 1];

  // 📈 Pull HR / calories / cadence / events / splits in parallel.
  // Never throws — returns an empty payload if every query failed.
  const metrics = await loadWorkoutMetrics(
    proxy,
    w.startedAt,
    w.endedAt,
    points,
  );

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
        // HK gives us either GPS-derived altitude (already on route
        // points) or `totalFlightsClimbed` (× 3 m proxy). Pass the
        // floors-derived value only — the GPS one isn't aggregated
        // client-side yet for runs (Walk pipeline does that today).
        elevation_gain_m: metrics.elevation_gain_m,
        source: SOURCE,
        external_id: w.uuid,
        // 📈 Optional enrichment — see services/workoutMetrics.ts.
        calories_kcal: metrics.calories_kcal,
        avg_hr_bpm: metrics.avg_hr_bpm,
        max_hr_bpm: metrics.max_hr_bpm,
        avg_cadence_spm: metrics.avg_cadence_spm,
        splits_json: metrics.splits_json,
        hr_zones_json: metrics.hr_zones_json,
        hr_recovery_bpm: metrics.hr_recovery_bpm,
        workout_events_json: metrics.workout_events_json,
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
      workout_events_json: metrics.workout_events_json,
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
//  🫁 VO2 Max auto-sync (HKQuantityTypeIdentifierVO2Max)
// ─────────────────────────────────────────────────────────────────────
//
//  Apple Watch estimates VO2 Max from outdoor walks/runs and writes a
//  new sample roughly every 1–2 weeks. We mirror those into ZenRun so
//  the Honors screen can show a fitness trend line.
//
//  Same shape as the weight sync:
//    1. List samples since Jan 1 of the current year.
//    2. Filter against backend dedupe.
//    3. POST the new ones (sequentially, idempotent).
//
//  Auth piggybacks on `requestAuth()` — VO2 Max is included in the
//  workout import auth sheet so users don't see a separate prompt.

const VO2_SOURCE = 'apple_health';

export interface ImportableVo2Max {
  /** HKQuantitySample uuid, sent as `external_id`. */
  uuid: string;
  /** mL/(kg·min). */
  valueMlKgMin: number;
  recordedAt: Date;
  sourceLabel: string;
}

interface ListVo2Options {
  since?: Date;
  limit?: number;
  includeImported?: boolean;
}

export async function listImportableVo2Max(
  options: ListVo2Options = {},
): Promise<ImportableVo2Max[]> {
  if (!getAvailability()) return [];

  const since =
    options.since ?? new Date(new Date().getFullYear(), 0, 1);
  const limit = options.limit ?? 365;

  let raw: readonly any[] = [];
  try {
    raw = await queryQuantitySamples(VO2_MAX_IDENTIFIER, {
      // VO2 Max samples in HK use 'mL/min·kg' (yes, that exact
      // string with a middle dot, per Apple's published unit).
      unit: 'mL/min·kg',
      limit,
      ascending: false,
      filter: {
        date: {
          startDate: since,
        },
      },
    } as any);
  } catch (err) {
    console.warn(
      '[appleHealth] queryQuantitySamples(VO2Max) failed:',
      err,
    );
    return [];
  }

  const projected: ImportableVo2Max[] = [];
  for (const s of raw) {
    const uuid: string | undefined = s?.uuid;
    const value = Number(s?.quantity ?? 0);
    const recordedAt: Date | undefined = s?.startDate ?? s?.endDate;
    if (!uuid || !recordedAt || !Number.isFinite(value)) continue;
    // Sanity-bound: human VO2 max is roughly 10–90; outside that
    // is almost certainly garbage / unit mix-up.
    if (value < 10 || value > 90) continue;
    projected.push({
      uuid,
      valueMlKgMin: Number(value.toFixed(2)),
      recordedAt,
      sourceLabel: readSampleSourceLabel(s),
    });
  }

  if (options.includeImported) return projected;

  try {
    const existing = await healthImportApi.listImportedIds(
      VO2_SOURCE,
      'vo2max',
    );
    const taken = new Set(existing.external_ids);
    return projected.filter((s) => !taken.has(s.uuid));
  } catch (err) {
    console.warn('[appleHealth] vo2max dedupe lookup failed:', err);
    return projected;
  }
}

/** Push a single VO2 Max sample. Idempotent server-side. */
export async function importVo2Max(
  s: ImportableVo2Max,
): Promise<{ ok: boolean; sample?: Vo2MaxSample; reason?: string }> {
  if (!getAvailability()) {
    return { ok: false, reason: 'HealthKit unavailable on this device' };
  }
  try {
    const sample = await vo2maxApi.create({
      value_ml_kg_min: s.valueMlKgMin,
      recorded_at: s.recordedAt.toISOString(),
      source: VO2_SOURCE,
      external_id: s.uuid,
    });
    return { ok: true, sample };
  } catch (err: any) {
    return {
      ok: false,
      reason: err?.message || 'Failed to import VO2 Max',
    };
  }
}

export async function importManyVo2Max(
  samples: ImportableVo2Max[],
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  for (const s of samples) {
    const res = await importVo2Max(s);
    if (res.ok) imported += 1;
    else failed += 1;
  }
  return { imported, failed };
}

/** Convenience for the Honors screen — pulls + persists VO2 Max
 *  samples since Jan 1. Returns counts and an `available` flag so
 *  the caller can render a tasteful "Synced N" toast. */
export async function autoSyncVo2MaxFromHealth(
  options: ListVo2Options = {},
): Promise<{ imported: number; failed: number; available: boolean }> {
  if (!getAvailability()) {
    return { imported: 0, failed: 0, available: false };
  }
  const fresh = await listImportableVo2Max(options);
  if (fresh.length === 0) {
    return { imported: 0, failed: 0, available: true };
  }
  const res = await importManyVo2Max(fresh);
  return { ...res, available: true };
}


// ─────────────────────────────────────────────────────────────────────
//  UI helpers
// ─────────────────────────────────────────────────────────────────────

/** Human label for the activity type, e.g. "Outdoor Run", "Hike". */
export function activityLabel(t: HealthActivityType): string {
  const type = t as WorkoutActivityType;
  switch (type) {
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
