/**
 * 🌒 Background walk task
 * =======================
 *
 * Registers a global expo-task-manager task that receives location updates
 * even when the app is backgrounded or the screen is locked. Each update is
 * appended to a small AsyncStorage queue keyed by walk-id; the foreground
 * tracker drains that queue when the user returns to the app.
 *
 * Why a queue?
 * ------------
 * The JS runtime sleeps when the app is suspended, so we can't call into
 * ``walkTracker`` directly from the headless task body. Instead we persist
 * the raw coordinates and let the foreground tracker reconcile them next
 * time the app wakes. This keeps the tracker logic (filtering, distance,
 * pace) centralized.
 *
 * NOTE: ``TaskManager.defineTask`` MUST be called at module load (top-level)
 * — not inside React components or async callbacks — otherwise iOS will not
 * be able to revive the task after a cold start.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKGROUND_LOCATION_TASK = 'zenrun-walk-background-location';
const QUEUE_KEY = 'walk:background:queue';
const PREF_KEY = 'walk:background:enabled';

export interface QueuedLocation {
  lat: number;
  lng: number;
  timestamp: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
}

// ------------------------------------------------------------------
//  Task body — runs in headless mode while the app is backgrounded.
// ------------------------------------------------------------------

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      // Surfacing here is a no-op (no JS console attached); rely on
      // foreground logs once the user returns.
      return;
    }
    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    const locations = payload?.locations || [];
    if (!locations.length) return;

    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: QueuedLocation[] = raw ? JSON.parse(raw) : [];
      for (const loc of locations) {
        queue.push({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: loc.timestamp,
          altitude: loc.coords.altitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
        });
      }
      // Cap the queue so a runaway session doesn't blow up storage.
      const capped = queue.slice(-2000);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(capped));
    } catch {
      // Swallow — we'll retry on the next batch.
    }
  });
}

// ------------------------------------------------------------------
//  Helpers used by the foreground tracker
// ------------------------------------------------------------------

export async function startBackgroundLocationUpdates(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    // Battery-conscious sampling — we don't need centimetre-perfect updates
    // while the screen is off, just enough to keep the polyline honest.
    timeInterval: 5000,
    distanceInterval: 10,
    deferredUpdatesInterval: 10000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'ZenRun is tracking your walk',
      notificationBody: 'Distance and route are being recorded.',
      notificationColor: '#7C9885',
    },
  });
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export async function isBackgroundLocationActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function drainQueuedLocations(): Promise<QueuedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(QUEUE_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedLocation[]) : [];
  } catch {
    return [];
  }
}

export async function clearQueuedLocations(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------
//  User preference: background tracking opt-in
// ------------------------------------------------------------------

export async function getBackgroundTrackingEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setBackgroundTrackingEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

/**
 * Request the "Always" location permission, gating on the foreground
 * permission first as iOS requires. Returns the granular result so the
 * caller can show the right error message.
 *
 * Important quirks:
 * - We use `getXxxPermissionsAsync` first to avoid re-prompting if iOS
 *   has already made up its mind (it doesn't show the system sheet on
 *   subsequent requests once denied).
 * - `requestBackgroundPermissionsAsync` THROWS on iOS when the running
 *   build is missing the "Always" plist key or the `location`
 *   `UIBackgroundModes` entitlement. We surface that as
 *   `background-unavailable` so we can tell the user to install a build
 *   from EAS rather than blaming a Settings toggle they can't change.
 */
export async function requestAlwaysLocationPermission(): Promise<{
  granted: boolean;
  foregroundStatus: Location.PermissionStatus;
  backgroundStatus: Location.PermissionStatus | null;
  reason?:
    | 'foreground-denied'
    | 'background-denied'
    | 'background-unavailable';
}> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status === 'undetermined') {
    try {
      fg = await Location.requestForegroundPermissionsAsync();
    } catch (e) {
      console.warn('[walkBackground] foreground request threw', e);
    }
  }
  if (fg.status !== 'granted') {
    return {
      granted: false,
      foregroundStatus: fg.status,
      backgroundStatus: null,
      reason: 'foreground-denied',
    };
  }

  let bgStatus: Location.PermissionStatus | null = null;
  try {
    const current = await Location.getBackgroundPermissionsAsync();
    bgStatus = current.status;
    if (current.status === 'undetermined') {
      const requested = await Location.requestBackgroundPermissionsAsync();
      bgStatus = requested.status;
    }
  } catch (e) {
    console.warn('[walkBackground] background permission threw', e);
    return {
      granted: false,
      foregroundStatus: fg.status,
      backgroundStatus: null,
      reason: 'background-unavailable',
    };
  }

  if (bgStatus !== 'granted') {
    return {
      granted: false,
      foregroundStatus: fg.status,
      backgroundStatus: bgStatus,
      reason: 'background-denied',
    };
  }

  return {
    granted: true,
    foregroundStatus: fg.status,
    backgroundStatus: bgStatus,
  };
}
