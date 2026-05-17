/**
 * Android stub for appleHealth — Metro resolves `import './appleHealth'`
 * to this file on Android. Real health import uses healthConnect.ts via
 * healthBridge.ts; these exports exist so accidental direct imports
 * don't pull HealthKit native code.
 */

import type {
  HealthActivityType,
  ImportableWorkout,
  ImportResult,
  ImportableWeight,
  ImportableVo2Max,
} from './healthTypes';

export type { ImportableWorkout, ImportResult, ImportableWeight, ImportableVo2Max };

export function isApplePlatform(): boolean {
  return false;
}

export function getAvailability(): boolean {
  return false;
}

export async function requestAuth(): Promise<boolean> {
  return false;
}

export async function listImportableWorkouts(): Promise<ImportableWorkout[]> {
  return [];
}

export async function importWorkout(_w: ImportableWorkout): Promise<ImportResult> {
  return { ok: false, reason: 'Use Health Connect on Android' };
}

export async function importMany(
  _workouts: ImportableWorkout[],
): Promise<{ imported: number; skipped: number; failed: number }> {
  return { imported: 0, skipped: 0, failed: 0 };
}

export async function requestWeightAuth(): Promise<boolean> {
  return false;
}

export async function listImportableWeights(): Promise<ImportableWeight[]> {
  return [];
}

export async function importWeight(): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: 'Use Health Connect on Android' };
}

export async function importManyWeights(): Promise<{
  imported: number;
  skipped: number;
  failed: number;
}> {
  return { imported: 0, skipped: 0, failed: 0 };
}

export async function autoSyncWeightsFromHealth(): Promise<{
  imported: number;
  skipped: number;
}> {
  return { imported: 0, skipped: 0 };
}

export async function listImportableVo2Max(): Promise<ImportableVo2Max[]> {
  return [];
}

export async function importVo2Max(): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: 'Use Health Connect on Android' };
}

export async function importManyVo2Max(): Promise<{
  imported: number;
  skipped: number;
  failed: number;
}> {
  return { imported: 0, skipped: 0, failed: 0 };
}

export async function autoSyncVo2MaxFromHealth(): Promise<{
  imported: number;
  skipped: number;
}> {
  return { imported: 0, skipped: 0 };
}

export function invalidateMaxHrCache(): void {
  // no-op on Android stub
}

export function activityLabel(_t: HealthActivityType): string {
  return 'Workout';
}
