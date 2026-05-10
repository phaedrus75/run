/**
 * 📈 services/workoutMetrics.ts
 * ─────────────────────────────────────────────────────────────────────
 * Canonical types + helpers for the workout enrichment metrics that
 * sit alongside a Run / Walk row (calories, HR averages, splits, zones,
 * recovery, events).
 *
 * Why a separate module:
 *   - `appleHealth.ts` *produces* these values (stringifies → POSTs).
 *   - The UI components *consume* them (parses ← reads).
 *   - The backend persists the JSON blobs verbatim.
 *
 * Keeping the shapes + JSON codecs in one file means we never get out
 * of sync between encoder and decoder, and lets every detail screen
 * import a single source of truth instead of re-implementing parsing.
 *
 * Conventions:
 *   - Distances in km, durations in seconds, paces in seconds-per-km.
 *   - Heart rate in BPM, cadence in steps-per-minute (SPM), calories
 *     in kcal, VO2 max in mL/kg/min.
 *   - All decode helpers tolerate malformed input and return null —
 *     never throw — so partial data never breaks the detail screens.
 */

// ─────────────────────────────────────────────────────────────────────
//  Per-km splits
// ─────────────────────────────────────────────────────────────────────

export interface Split {
  /** 1-indexed kilometre marker (1 = first km, 2 = second, ...). */
  km: number;
  /** How long this kilometre took. */
  duration_sec: number;
  /** Pace for this single kilometre — equal to duration_sec when each
   *  bucket is 1 km. Stored explicitly so callers don't need to divide. */
  pace_sec_per_km: number;
  /** Average HR across the bucket, when HR samples were available. */
  avg_hr_bpm?: number | null;
}

export function encodeSplits(splits: Split[]): string {
  return JSON.stringify(splits);
}

export function decodeSplits(raw?: string | null): Split[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): Split | null => {
        if (!row || typeof row !== 'object') return null;
        const km = Number(row.km);
        const duration = Number(row.duration_sec);
        const pace = Number(row.pace_sec_per_km);
        if (!Number.isFinite(km) || !Number.isFinite(duration)) return null;
        if (km <= 0 || duration < 0) return null;
        return {
          km,
          duration_sec: duration,
          pace_sec_per_km: Number.isFinite(pace) ? pace : duration,
          avg_hr_bpm:
            row.avg_hr_bpm != null && Number.isFinite(Number(row.avg_hr_bpm))
              ? Math.round(Number(row.avg_hr_bpm))
              : null,
        };
      })
      .filter((s): s is Split => s !== null)
      .sort((a, b) => a.km - b.km);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
//  HR zones
// ─────────────────────────────────────────────────────────────────────

export interface HrZones {
  /** The max-HR baseline used to bucket — recorded so future
   *  re-bucketing knows the starting point (e.g. user changes their
   *  max-HR setting). */
  max_hr_used: number;
  z1_sec: number;
  z2_sec: number;
  z3_sec: number;
  z4_sec: number;
  z5_sec: number;
}

export function encodeHrZones(z: HrZones): string {
  return JSON.stringify(z);
}

export function decodeHrZones(raw?: string | null): HrZones | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const num = (v: unknown) =>
      Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0;
    const max = Number(parsed.max_hr_used);
    if (!Number.isFinite(max) || max <= 0) return null;
    return {
      max_hr_used: Math.round(max),
      z1_sec: num(parsed.z1_sec),
      z2_sec: num(parsed.z2_sec),
      z3_sec: num(parsed.z3_sec),
      z4_sec: num(parsed.z4_sec),
      z5_sec: num(parsed.z5_sec),
    };
  } catch {
    return null;
  }
}

/** Zone boundaries as percentages of max HR. The buckets follow
 *  Apple Watch's published scheme so they line up with what users
 *  see in the Activity app:
 *    Z1 < 60%       (recovery)
 *    Z2 60–70%      (easy aerobic)
 *    Z3 70–80%      (tempo)
 *    Z4 80–90%      (threshold)
 *    Z5 ≥ 90%       (max effort)
 */
export const HR_ZONE_BOUNDS = [0.6, 0.7, 0.8, 0.9] as const;

/** Bucket a single HR sample into 1–5 given the user's max HR. */
export function hrZoneFor(bpm: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(bpm) || maxHr <= 0) return 1;
  const ratio = bpm / maxHr;
  if (ratio < HR_ZONE_BOUNDS[0]) return 1;
  if (ratio < HR_ZONE_BOUNDS[1]) return 2;
  if (ratio < HR_ZONE_BOUNDS[2]) return 3;
  if (ratio < HR_ZONE_BOUNDS[3]) return 4;
  return 5;
}

/** Total time accounted for in a zones bundle, used to compute
 *  percentages without re-summing in every UI component. */
export function totalZoneSeconds(z: HrZones): number {
  return z.z1_sec + z.z2_sec + z.z3_sec + z.z4_sec + z.z5_sec;
}

// ─────────────────────────────────────────────────────────────────────
//  Workout events (pauses / laps)
// ─────────────────────────────────────────────────────────────────────

export type WorkoutEventType =
  | 'pause'
  | 'resume'
  | 'lap'
  | 'segment'
  | 'marker'
  | 'motion_paused'
  | 'motion_resumed';

export interface WorkoutEvent {
  type: WorkoutEventType;
  /** Seconds since the workout started. */
  offset_sec: number;
}

export function encodeEvents(events: WorkoutEvent[]): string {
  return JSON.stringify(events);
}

export function decodeEvents(raw?: string | null): WorkoutEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): WorkoutEvent | null => {
        if (!row || typeof row !== 'object') return null;
        const type = String(row.type) as WorkoutEventType;
        const offset = Number(row.offset_sec);
        if (!Number.isFinite(offset) || offset < 0) return null;
        return { type, offset_sec: offset };
      })
      .filter((e): e is WorkoutEvent => e !== null)
      .sort((a, b) => a.offset_sec - b.offset_sec);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Per-km split derivation from a route polyline
// ─────────────────────────────────────────────────────────────────────

export interface RoutePoint {
  lat: number;
  lng: number;
  /** Unix ms. */
  timestamp: number;
}

export interface HrSamplePoint {
  bpm: number;
  /** Unix ms. */
  timestamp: number;
}

/** Haversine distance in metres. Local, no external dep, fine for
 *  the precision a runner cares about (<<1m error per segment). */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(c)));
}

/**
 * Derive per-km splits from an ordered polyline of route points.
 *
 * Walks the polyline accumulating segment distances; when the running
 * total crosses each kilometre boundary it emits a `Split` with the
 * elapsed time since the previous boundary. The final partial
 * kilometre (if any) is dropped so we don't show "1.4 km" rows — most
 * runners scan splits for round-number consistency.
 *
 * If `hrSamples` is provided, each split is annotated with the average
 * HR across the time window of that bucket. Empty samples → no HR
 * field on the split.
 */
export function computeSplitsFromRoute(
  points: RoutePoint[],
  hrSamples: HrSamplePoint[] = [],
): Split[] {
  if (!points || points.length < 2) return [];

  const splits: Split[] = [];
  let cumulativeMeters = 0;
  let nextBoundaryMeters = 1000;
  let lastBoundaryTimeMs = points[0].timestamp;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const segMeters = haversineMeters(prev, cur);
    if (!Number.isFinite(segMeters) || segMeters <= 0) continue;

    const segDurationMs = Math.max(0, cur.timestamp - prev.timestamp);

    // Allow a single segment to cross multiple km boundaries — rare
    // (would mean a >1 km gap between samples) but we don't want to
    // silently swallow it.
    let segMetersLeft = segMeters;
    let segDurationMsLeft = segDurationMs;
    while (cumulativeMeters + segMetersLeft >= nextBoundaryMeters) {
      const metersToBoundary = nextBoundaryMeters - cumulativeMeters;
      // Time prorated to the fraction of this segment up to the boundary.
      const fraction = segMetersLeft > 0 ? metersToBoundary / segMetersLeft : 0;
      const msToBoundary = Math.round(segDurationMsLeft * fraction);
      const boundaryTimeMs = (cur.timestamp - segDurationMsLeft) + msToBoundary;

      const splitDurationSec = Math.max(
        1,
        Math.round((boundaryTimeMs - lastBoundaryTimeMs) / 1000),
      );
      const km = Math.round(nextBoundaryMeters / 1000);
      splits.push({
        km,
        duration_sec: splitDurationSec,
        pace_sec_per_km: splitDurationSec,
        avg_hr_bpm: averageHrBetween(hrSamples, lastBoundaryTimeMs, boundaryTimeMs),
      });

      cumulativeMeters = nextBoundaryMeters;
      nextBoundaryMeters += 1000;
      lastBoundaryTimeMs = boundaryTimeMs;
      segMetersLeft -= metersToBoundary;
      segDurationMsLeft -= msToBoundary;
    }

    cumulativeMeters += segMetersLeft;
  }

  return splits;
}

function averageHrBetween(
  samples: HrSamplePoint[],
  startMs: number,
  endMs: number,
): number | null {
  if (!samples || samples.length === 0) return null;
  let sum = 0;
  let count = 0;
  for (const s of samples) {
    if (s.timestamp >= startMs && s.timestamp <= endMs) {
      sum += s.bpm;
      count += 1;
    }
  }
  if (count === 0) return null;
  return Math.round(sum / count);
}

// ─────────────────────────────────────────────────────────────────────
//  HR aggregates (avg / max / zones / recovery)
// ─────────────────────────────────────────────────────────────────────

export interface HrAggregates {
  avg_bpm: number;
  max_bpm: number;
  zones: HrZones;
}

export function aggregateHr(
  samples: HrSamplePoint[],
  maxHrBaseline: number,
): HrAggregates | null {
  if (!samples || samples.length === 0 || maxHrBaseline <= 0) return null;

  let sum = 0;
  let max = 0;
  const zoneSeconds: [number, number, number, number, number] = [
    0,
    0,
    0,
    0,
    0,
  ];

  // We treat each sample as covering the time gap to the next sample
  // (capped at 30s to avoid one stale sample inflating zones during a
  // pause). Apple Watch typically samples HR every 5–10s during a
  // workout so this maps to reality well.
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const dwellMs = next ? next.timestamp - cur.timestamp : 5_000;
    const dwellSec = Math.min(30, Math.max(0, Math.round(dwellMs / 1000)));
    const zone = hrZoneFor(cur.bpm, maxHrBaseline);
    zoneSeconds[zone - 1] += dwellSec;
    sum += cur.bpm;
    if (cur.bpm > max) max = cur.bpm;
  }

  return {
    avg_bpm: Math.round(sum / sorted.length),
    max_bpm: Math.round(max),
    zones: {
      max_hr_used: Math.round(maxHrBaseline),
      z1_sec: zoneSeconds[0],
      z2_sec: zoneSeconds[1],
      z3_sec: zoneSeconds[2],
      z4_sec: zoneSeconds[3],
      z5_sec: zoneSeconds[4],
    },
  };
}

/**
 * Compute heart-rate recovery in BPM — the drop between the workout's
 * end-HR and the lowest HR observed in the 60s after.
 *
 * Returns null when we don't have samples covering the recovery window
 * (e.g. user took the watch off immediately).
 */
export function computeHrRecovery(
  endTimeMs: number,
  postWorkoutSamples: HrSamplePoint[],
): number | null {
  if (!postWorkoutSamples || postWorkoutSamples.length === 0) return null;
  // End-HR: the last sample at-or-before endTime.
  const sorted = [...postWorkoutSamples].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  let endHr: number | null = null;
  for (const s of sorted) {
    if (s.timestamp <= endTimeMs) endHr = s.bpm;
    else break;
  }
  if (endHr == null) {
    // No pre-end sample available; use the first sample as a proxy.
    endHr = sorted[0].bpm;
  }
  let minPost: number | null = null;
  for (const s of sorted) {
    if (s.timestamp >= endTimeMs && s.timestamp <= endTimeMs + 60_000) {
      if (minPost == null || s.bpm < minPost) minPost = s.bpm;
    }
  }
  if (minPost == null) return null;
  const drop = Math.round(endHr - minPost);
  if (drop < 0) return null; // HR went up — not a meaningful recovery
  return drop;
}

// ─────────────────────────────────────────────────────────────────────
//  Display formatters
// ─────────────────────────────────────────────────────────────────────

/** Format a number of seconds as `M:SS` (mm:ss) for split tables. */
export function formatPace(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '–';
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format an HR zone duration succinctly (e.g. "12m" or "1h 04m"). */
export function formatZoneDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0m';
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins.toString().padStart(2, '0')}m`;
}

/** Round-trip helper: accept a display value, return a number rounded
 *  to a sensible precision for storage. */
export function clampPositiveInt(v: unknown, max = 1_000_000): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > max) return null;
  return Math.round(n);
}

// ─────────────────────────────────────────────────────────────────────
//  Workout-event → map-marker projection
// ─────────────────────────────────────────────────────────────────────

/** A pin we want to draw on the detail-map for an event (a pause or
 *  an auto-km lap). Lat/lng resolved from the route polyline by
 *  matching each event's time offset to the closest route point. */
export interface EventMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  /** What kind of event this is — caller can colour-code. */
  kind: 'pause' | 'lap';
}

interface PointWithTime {
  lat: number;
  lng: number;
  timestamp: number;
}

/**
 * Build map markers for every pause + lap in `events` by binary-
 * searching the `route` for the closest sample to each event's
 * timestamp. We only surface pauses and laps because:
 *   - resume/motionResumed/motionPaused/segment/marker/pauseOrResumeRequest
 *     produce too much visual noise on a normal run.
 *   - Apple Watch fires a lap event every km automatically; pinning
 *     them on the map gives a runner a great "I made it to here" cue.
 *
 * Returns [] when route data is missing or the event timeline doesn't
 * line up with the route timeline (e.g. user trimmed the workout).
 */
export function eventMarkersFromRoute(
  events: WorkoutEvent[],
  startedAtMs: number,
  route: PointWithTime[],
): EventMarker[] {
  if (!route || route.length === 0 || !events || events.length === 0) {
    return [];
  }

  const sorted = [...route].sort((a, b) => a.timestamp - b.timestamp);
  const markers: EventMarker[] = [];
  let lapIndex = 0;
  let pauseIndex = 0;

  for (const ev of events) {
    if (ev.type !== 'pause' && ev.type !== 'lap') continue;
    const evMs = startedAtMs + ev.offset_sec * 1000;
    const point = nearestRoutePoint(sorted, evMs);
    if (!point) continue;
    if (ev.type === 'lap') {
      lapIndex += 1;
      markers.push({
        id: `lap-${lapIndex}`,
        lat: point.lat,
        lng: point.lng,
        title: `${lapIndex} km`,
        kind: 'lap',
      });
    } else {
      pauseIndex += 1;
      markers.push({
        id: `pause-${pauseIndex}`,
        lat: point.lat,
        lng: point.lng,
        title: 'Pause',
        kind: 'pause',
      });
    }
  }
  return markers;
}

/**
 * Approximate variant of `eventMarkersFromRoute` for callers that
 * only have lat/lng points (no timestamps) — i.e. a polyline decoded
 * from the backend. Uses `event.offset_sec / totalDurationSec` as the
 * fraction along the array, which is exact for steady pace and
 * "close enough" otherwise (a pause shifts by a few percent of
 * distance, well within map-pin tolerance).
 *
 * Lap markers — written by Apple Watch every km — get a special
 * codepath: we walk the polyline accumulating Haversine distance and
 * pin each lap at the actual km boundary. This gives perfect lap
 * placement regardless of pace variability.
 */
export function eventMarkersFromDecodedRoute(
  events: WorkoutEvent[],
  totalDurationSec: number,
  route: { lat: number; lng: number }[],
): EventMarker[] {
  if (!route || route.length === 0 || !events || events.length === 0) {
    return [];
  }

  const markers: EventMarker[] = [];

  // 🏁 Laps: project to actual km boundaries on the polyline.
  const laps = events.filter((e) => e.type === 'lap');
  if (laps.length > 0) {
    let cumulativeMeters = 0;
    let lapIdx = 0;
    let nextBoundary = 1000;
    const boundaries: { lat: number; lng: number; index: number }[] = [];
    for (let i = 1; i < route.length && lapIdx < laps.length; i++) {
      const seg = haversineMeters(route[i - 1], route[i]);
      cumulativeMeters += seg;
      while (cumulativeMeters >= nextBoundary && lapIdx < laps.length) {
        boundaries.push({ lat: route[i].lat, lng: route[i].lng, index: ++lapIdx });
        nextBoundary += 1000;
      }
    }
    boundaries.forEach((b) => {
      markers.push({
        id: `lap-${b.index}`,
        lat: b.lat,
        lng: b.lng,
        title: `${b.index} km`,
        kind: 'lap',
      });
    });
  }

  // ⏸ Pauses: fraction-of-duration → fraction-of-route-array. Good
  // enough for visualising "around here is where I stopped".
  const pauses = events.filter((e) => e.type === 'pause');
  if (pauses.length > 0 && totalDurationSec > 0) {
    let pauseIdx = 0;
    pauses.forEach((p) => {
      const fraction = Math.max(
        0,
        Math.min(1, p.offset_sec / totalDurationSec),
      );
      const i = Math.min(
        route.length - 1,
        Math.max(0, Math.round(fraction * (route.length - 1))),
      );
      pauseIdx += 1;
      markers.push({
        id: `pause-${pauseIdx}`,
        lat: route[i].lat,
        lng: route[i].lng,
        title: 'Pause',
        kind: 'pause',
      });
    });
  }

  return markers;
}

function nearestRoutePoint(
  route: PointWithTime[],
  targetMs: number,
): PointWithTime | null {
  if (route.length === 0) return null;
  if (targetMs <= route[0].timestamp) return route[0];
  if (targetMs >= route[route.length - 1].timestamp) {
    return route[route.length - 1];
  }
  let lo = 0;
  let hi = route.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (route[mid].timestamp <= targetMs) lo = mid;
    else hi = mid;
  }
  // Pick whichever neighbour is closer in time.
  const left = route[lo];
  const right = route[hi];
  return Math.abs(left.timestamp - targetMs) <=
    Math.abs(right.timestamp - targetMs)
    ? left
    : right;
}
