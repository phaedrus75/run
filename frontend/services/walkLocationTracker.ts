/**
 * 🚶 Walk Location Tracker
 * ========================
 *
 * Foreground GPS tracking for walks.
 * - Uses expo-location's watchPositionAsync.
 * - Filters noisy points (low accuracy / tiny jitter / impossible speed).
 * - Accumulates a route as an array of {lat, lng} points.
 * - Computes total distance with the haversine formula.
 * - Auto-pauses when the user stops moving (avg speed < threshold).
 *
 * Phase 1: foreground only. Phase 4 will layer in background tracking via
 * expo-task-manager (see WalkScreen for the always-permission flow).
 */

import * as Location from 'expo-location';
import polyline from '@mapbox/polyline';
import {
  clearQueuedLocations,
  drainQueuedLocations,
  isBackgroundLocationActive,
  QueuedLocation,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from './walkBackgroundTask';

export interface TrackedPoint {
  lat: number;
  lng: number;
  timestamp: number; // ms epoch
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
}

export interface WalkSnapshot {
  isTracking: boolean;
  isPaused: boolean;
  startedAt: number | null;
  durationSeconds: number;
  distanceKm: number;
  points: TrackedPoint[];
  currentSpeedMps: number | null; // metres / second
  currentPace: string; // mm:ss /km
  currentLocation: TrackedPoint | null;
  elevationGainM: number;
}

export type WalkSnapshotListener = (snapshot: WalkSnapshot) => void;

// ----- Tunables -----
const MIN_ACCEPTABLE_ACCURACY_M = 30;
const MIN_DISTANCE_BETWEEN_POINTS_M = 3;
const TICK_MS = 1000;

export interface ActivityTrackerConfig {
  /** Max plausible speed in m/s — points above this are treated as GPS jumps. */
  maxSpeedMps: number;
  /** Auto-pause when avg speed drops below this (m/s). */
  autoPauseSpeedMps: number;
  autoPauseWindowMs: number;
}

const WALK_CONFIG: ActivityTrackerConfig = {
  maxSpeedMps: 6.0,      // ~21.6 km/h
  autoPauseSpeedMps: 0.4, // ~1.4 km/h
  autoPauseWindowMs: 30_000,
};

const RUN_CONFIG: ActivityTrackerConfig = {
  maxSpeedMps: 9.5,       // ~34 km/h — covers sprints
  autoPauseSpeedMps: 0.5,
  autoPauseWindowMs: 45_000, // slower to auto-pause during a run
};

class WalkLocationTracker {
  private subscription: Location.LocationSubscription | null = null;
  private listeners = new Set<WalkSnapshotListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private backgroundActive = false;
  private readonly cfg: ActivityTrackerConfig;

  private snapshot: WalkSnapshot = this.makeEmptySnapshot();

  constructor(cfg: ActivityTrackerConfig = WALK_CONFIG) {
    this.cfg = cfg;
  }

  private makeEmptySnapshot(): WalkSnapshot {
    return {
      isTracking: false,
      isPaused: false,
      startedAt: null,
      durationSeconds: 0,
      distanceKm: 0,
      points: [],
      currentSpeedMps: null,
      currentPace: '--:--',
      currentLocation: null,
      elevationGainM: 0,
    };
  }

  getSnapshot(): WalkSnapshot {
    return this.snapshot;
  }

  subscribe(listener: WalkSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) {
      l(this.snapshot);
    }
  }

  /**
   * Request foreground location permission. Returns true if granted.
   */
  async requestForegroundPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Optional: request "always" / background permission. Used by Phase 4.
   * This must follow the foreground request on iOS.
   */
  async requestBackgroundPermission(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }

  async getInitialLocation(): Promise<TrackedPoint | null> {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: loc.timestamp,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
      };
    } catch {
      return null;
    }
  }

  /**
   * Start a fresh tracking session.
   *
   * @param options.background If true, also start background location
   *   updates so the walk keeps tracking when the screen is locked.
   *   Caller must already have requested the "Always" permission.
   */
  async start(options: { background?: boolean } = {}): Promise<void> {
    if (this.snapshot.isTracking) return;

    const granted = await this.requestForegroundPermission();
    if (!granted) {
      throw new Error('Location permission denied');
    }

    // Make sure no leftover background queue from a previous session
    // contaminates this walk's polyline.
    await clearQueuedLocations();

    this.snapshot = {
      ...this.makeEmptySnapshot(),
      isTracking: true,
      startedAt: Date.now(),
    };
    this.emit();

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
      },
      (loc) => this.handleLocation(loc),
    );

    this.timer = setInterval(() => this.tick(), TICK_MS);

    if (options.background) {
      try {
        await startBackgroundLocationUpdates();
        this.backgroundActive = true;
      } catch {
        // Background not available — keep going in foreground only.
        this.backgroundActive = false;
      }
    }
  }

  /**
   * Pull any locations queued while the app was backgrounded and merge them
   * into the current snapshot. Safe to call repeatedly (the queue is drained
   * each time).
   */
  async drainBackgroundQueue(): Promise<void> {
    if (!this.snapshot.isTracking) return;
    const queued = await drainQueuedLocations();
    if (!queued.length) return;
    queued
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((q) => this.ingestPoint(q));
  }

  isBackgroundEnabled(): boolean {
    return this.backgroundActive;
  }

  async refreshBackgroundStatus(): Promise<boolean> {
    this.backgroundActive = await isBackgroundLocationActive();
    return this.backgroundActive;
  }

  pause() {
    if (!this.snapshot.isTracking || this.snapshot.isPaused) return;
    this.snapshot = { ...this.snapshot, isPaused: true };
    this.emit();
  }

  resume() {
    if (!this.snapshot.isTracking || !this.snapshot.isPaused) return;
    this.snapshot = { ...this.snapshot, isPaused: false };
    this.emit();
  }

  /**
   * Stop tracking and return the final snapshot.
   */
  async stop(): Promise<WalkSnapshot> {
    // Pull in any queued background points before snapshotting so the final
    // saved walk includes everything captured while backgrounded.
    await this.drainBackgroundQueue();
    const final = this.snapshot;
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.backgroundActive) {
      try {
        await stopBackgroundLocationUpdates();
      } catch {
        // ignore
      }
      this.backgroundActive = false;
    }
    await clearQueuedLocations();
    this.snapshot = this.makeEmptySnapshot();
    this.emit();
    return final;
  }

  /**
   * Discard everything without saving.
   */
  async discard(): Promise<void> {
    await this.stop();
  }

  private tick() {
    if (!this.snapshot.startedAt) return;
    const now = Date.now();
    if (this.snapshot.isPaused) {
      // Don't accrue duration while paused.
      this.emit();
      return;
    }
    const duration = Math.floor((now - this.snapshot.startedAt) / 1000);
    this.snapshot = {
      ...this.snapshot,
      durationSeconds: duration,
      currentPace: paceFromDistance(duration, this.snapshot.distanceKm),
    };

    this.maybeAutoPause(now);
    this.emit();
  }

  private handleLocation(loc: Location.LocationObject) {
    this.ingestPoint({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      timestamp: loc.timestamp,
      altitude: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
    });
  }

  /**
   * Single point of ingestion used by both the foreground watcher and the
   * background queue drainer. Applies the same filtering pipeline so the
   * final route is consistent regardless of where the point came from.
   */
  private ingestPoint(raw: QueuedLocation) {
    if (!this.snapshot.isTracking) return;

    const acc = raw.accuracy ?? null;
    if (acc !== null && acc > MIN_ACCEPTABLE_ACCURACY_M) {
      return;
    }

    const point: TrackedPoint = {
      lat: raw.lat,
      lng: raw.lng,
      timestamp: raw.timestamp,
      altitude: raw.altitude,
      accuracy: acc,
      speed: raw.speed,
    };

    const prev = this.snapshot.points[this.snapshot.points.length - 1];
    let addedDistanceKm = 0;
    let elevationGainM = this.snapshot.elevationGainM;

    if (prev) {
      // Skip points that arrive out of order.
      if (point.timestamp <= prev.timestamp) return;

      const distM = haversineMeters(prev, point);
      const dtSec = Math.max(0.001, (point.timestamp - prev.timestamp) / 1000);
      const speedMps = distM / dtSec;

      if (distM < MIN_DISTANCE_BETWEEN_POINTS_M) return;
      if (speedMps > this.cfg.maxSpeedMps) return;

      addedDistanceKm = distM / 1000;

      if (
        prev.altitude !== null &&
        prev.altitude !== undefined &&
        point.altitude !== null &&
        point.altitude !== undefined
      ) {
        const dAlt = point.altitude - prev.altitude;
        if (dAlt > 0.5) {
          elevationGainM += dAlt;
        }
      }
    }

    const points = [...this.snapshot.points, point];
    const distanceKm = this.snapshot.distanceKm + addedDistanceKm;
    const durationSeconds = this.snapshot.startedAt
      ? Math.floor((Date.now() - this.snapshot.startedAt) / 1000)
      : 0;

    // Auto-resume: a fresh point arriving after auto-pause means the user
    // started moving again, so unset the paused flag.
    const stillPaused = this.snapshot.isPaused && addedDistanceKm < 0.005;

    this.snapshot = {
      ...this.snapshot,
      isPaused: stillPaused,
      points,
      distanceKm,
      durationSeconds,
      currentSpeedMps: raw.speed ?? null,
      currentLocation: point,
      elevationGainM,
      currentPace: paceFromDistance(durationSeconds, distanceKm),
    };

    this.emit();
  }

  /**
   * Auto-pause heuristic: if the user has barely moved in the last
   * AUTO_PAUSE_WINDOW_MS, mark the walk as paused so duration stops growing.
   */
  private maybeAutoPause(now: number) {
    if (this.snapshot.isPaused) return;
    const points = this.snapshot.points;
    if (points.length < 2) return;

    const cutoff = now - this.cfg.autoPauseWindowMs;
    const recent = points.filter((p) => p.timestamp >= cutoff);
    if (recent.length < 2) return;

    let dist = 0;
    for (let i = 1; i < recent.length; i += 1) {
      dist += haversineMeters(recent[i - 1], recent[i]);
    }
    const dtSec = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000;
    if (dtSec <= 0) return;
    const avgSpeed = dist / dtSec;
    if (avgSpeed < this.cfg.autoPauseSpeedMps) {
      // Soft pause - duration stops accruing but tracking continues so the
      // user doesn't have to manually resume when they start moving again.
      // We only flag isPaused; the watcher keeps adding points.
      this.snapshot = { ...this.snapshot, isPaused: true };
    }
  }
}

// Singletons — one per activity type. Only one should be active at a time.
export const walkTracker = new WalkLocationTracker(WALK_CONFIG);
export const runTracker  = new WalkLocationTracker(RUN_CONFIG);

// ----- Helpers -----

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function paceFromDistance(durationSeconds: number, distanceKm: number): string {
  if (!distanceKm || distanceKm < 0.05) return '--:--';
  const secPerKm = durationSeconds / distanceKm;
  if (!isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function encodePolyline(points: TrackedPoint[]): string {
  if (!points.length) return '';
  return polyline.encode(points.map((p) => [p.lat, p.lng] as [number, number]));
}

export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  if (!encoded) return [];
  return polyline.decode(encoded).map(([lat, lng]) => ({ lat, lng }));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(2)} km`;
}

export function formatDurationHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
