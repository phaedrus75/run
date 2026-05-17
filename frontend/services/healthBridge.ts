/**
 * Platform facade for Apple Health (iOS) and Health Connect (Android).
 * UI imports from here instead of appleHealth directly.
 */

import { Platform } from 'react-native';
import * as appleHealth from './appleHealth.ios';
import * as healthConnect from './healthConnect';

export type {
  HealthActivityType,
  ImportableWorkout,
  ImportResult,
  ImportableWeight,
  ImportableVo2Max,
} from './healthTypes';

const impl = Platform.OS === 'ios' ? appleHealth : healthConnect;

export const isApplePlatform = appleHealth.isApplePlatform;
export const isAndroidPlatform = healthConnect.isAndroidPlatform;

export function isHealthPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Human-readable name for the platform health system. */
export function healthPlatformName(): string {
  if (Platform.OS === 'ios') return 'Apple Health';
  if (Platform.OS === 'android') return 'Health Connect';
  return 'Health';
}

export function getAvailability(): boolean {
  return impl.getAvailability();
}

export async function requestAuth(): Promise<boolean> {
  return impl.requestAuth();
}

export function openHealthSettings(): void {
  if (Platform.OS === 'android' && healthConnect.openHealthSettings) {
    healthConnect.openHealthSettings();
  }
}

export async function listImportableWorkouts(
  options?: Parameters<typeof appleHealth.listImportableWorkouts>[0],
) {
  return impl.listImportableWorkouts(options);
}

export async function importWorkout(
  w: import('./healthTypes').ImportableWorkout,
) {
  return impl.importWorkout(w);
}

export async function importMany(
  workouts: import('./healthTypes').ImportableWorkout[],
) {
  return impl.importMany(workouts);
}

export async function requestWeightAuth(): Promise<boolean> {
  return impl.requestWeightAuth();
}

export async function listImportableWeights(
  options?: Parameters<typeof appleHealth.listImportableWeights>[0],
) {
  return impl.listImportableWeights(options);
}

export async function importWeight(
  entry: import('./healthTypes').ImportableWeight,
) {
  return impl.importWeight(entry);
}

export async function importManyWeights(
  entries: import('./healthTypes').ImportableWeight[],
) {
  return impl.importManyWeights(entries);
}

export async function autoSyncWeightsFromHealth(
  options?: Parameters<typeof appleHealth.autoSyncWeightsFromHealth>[0],
) {
  return impl.autoSyncWeightsFromHealth(options);
}

export async function listImportableVo2Max(
  options?: Parameters<typeof healthConnect.listImportableVo2Max>[0],
) {
  return impl.listImportableVo2Max(options as any);
}

export async function importVo2Max(
  sample: import('./healthTypes').ImportableVo2Max,
) {
  return impl.importVo2Max(sample as any);
}

export async function importManyVo2Max(
  samples: import('./healthTypes').ImportableVo2Max[],
) {
  return impl.importManyVo2Max(samples as any);
}

export async function autoSyncVo2MaxFromHealth() {
  return impl.autoSyncVo2MaxFromHealth();
}

export function invalidateMaxHrCache(): void {
  impl.invalidateMaxHrCache();
}

export function activityLabel(t: import('./healthTypes').HealthActivityType): string {
  return impl.activityLabel(t);
}
