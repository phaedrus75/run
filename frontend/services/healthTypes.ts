/**
 * Shared health-import types used by Apple Health (iOS) and Health
 * Connect (Android). Keeps UI + healthBridge platform-agnostic.
 */

export type HealthActivityType = number | string;

/** What the import picker renders. */
export interface ImportableWorkout {
  uuid: string;
  kind: 'run' | 'walk';
  /** Platform-specific activity id (HK enum or HC ExerciseType number). */
  activityType: HealthActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceKm: number;
  hasRoute: boolean;
  sourceLabel: string;
  /** Opaque platform handle for import — HK proxy or HC session record. */
  _internal?: unknown;
}

export interface ImportResult {
  ok: boolean;
  run?: import('./api').Run;
  walk?: import('./api').Walk;
  reason?: string;
}

export interface ImportableWeight {
  uuid: string;
  recordedAt: Date;
  weightLbs: number;
  sourceLabel: string;
}

export interface ImportableVo2Max {
  uuid: string;
  recordedAt: Date;
  valueMlKgMin: number;
  sourceLabel: string;
}
