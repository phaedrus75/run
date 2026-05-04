/**
 * 🌐 API SERVICE
 * ==============
 * 
 * This file handles all communication with our Python backend.
 * 
 * 🎓 LEARNING NOTES:
 * - fetch() is a built-in function for making HTTP requests
 * - async/await makes asynchronous code look like regular code
 * - We wrap everything in try/catch for error handling
 */

import { getToken } from './auth';

import { API_BASE_URL } from './config';

/**
 * 🔧 Generic fetch wrapper with error handling
 * Now includes auth token automatically when available
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get auth token if available
  let authHeader: Record<string, string> = {};
  try {
    const token = await getToken();
    if (token) {
      authHeader = { 'Authorization': `Bearer ${token}` };
    }
  } catch (e) {
    // No token available, continue without auth
  }
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API Error');
    }
    
    return response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ==========================================
// 📊 TYPE DEFINITIONS
// ==========================================

export interface Celebration {
  type: 'personal_best' | 'streak' | 'monthly_goal' | 'high_steps';
  title: string;
  message: string;
}

export interface Run {
  id: number;
  run_type: string;
  duration_seconds: number;
  distance_km: number;
  completed_at: string;
  notes: string | null;
  mood: string | null;
  category: string | null;
  pace_per_km: string;
  formatted_duration: string;
  is_personal_best?: boolean;
  pr_type?: string | null;
  celebrations?: Celebration[];
  photo_count?: number;
  // GPS fields (outdoor GPS-tracked runs only)
  route_polyline?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  elevation_gain_m?: number | null;
  started_at?: string | null;
  neighbourhood_visibility?: string | null;
  neighbourhood_published_at?: string | null;
}

export interface RunPhoto {
  id: number;
  run_id: number;
  /** Full-resolution base64 JPEG. Returned when the caller asks for `full=true`,
   *  or via `photoApi.getRunPhotoFull`. Omitted from the default thumb response. */
  photo_data?: string | null;
  /** Small (~5–15 KB) base64 thumbnail. Returned in the default list response.
   *  Use this for carousels / grids; fetch full on demand for the lightbox. */
  thumb_data?: string | null;
  /** Hint that the row in this list response carries thumb_data, not photo_data. */
  is_thumb?: boolean;
  distance_marker_km: number;
  caption: string | null;
  created_at: string | null;
}

export interface ScenicRun {
  id: number;
  run_type: string;
  distance_km: number;
  duration_seconds: number;
  completed_at: string | null;
  pace: string;
  mood: string | null;
  photo_count: number;
  cover_photo: string | null;
  /** Encoded polyline of the recorded route. Null for non-GPS runs;
   *  used by the journey view to render the route map + photo pins. */
  route_polyline?: string | null;
}

// 🚶 Walk types
export interface Walk {
  id: number;
  user_id: number | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  distance_km: number;
  route_polyline: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  elevation_gain_m: number | null;
  avg_pace_seconds_per_km: number | null;
  notes: string | null;
  mood: string | null;
  category: string | null;
  public_walk_id: number | null;
  photo_count?: number;
}

export interface WalkPhoto {
  id: number;
  walk_id: number;
  /** Full-resolution base64 JPEG. Returned when the caller asks for `full=true`,
   *  or via `walkPhotoApi.getWalkPhotoFull`. Omitted from the default thumb response. */
  photo_data?: string | null;
  /** Small (~5–15 KB) base64 thumbnail. Returned in the default list response. */
  thumb_data?: string | null;
  /** Hint that the row in this list response carries thumb_data, not photo_data. */
  is_thumb?: boolean;
  lat: number | null;
  lng: number | null;
  distance_marker_km: number | null;
  caption: string | null;
  created_at: string | null;
}

export interface WalkStats {
  total_walks: number;
  total_km: number;
  total_minutes: number;
  walks_this_week: number;
  km_this_week: number;
  walks_this_month: number;
  km_this_month: number;
  longest_walk_km: number;
  longest_walk_minutes: number;
  avg_pace_seconds_per_km: number | null;
}

export interface PublicWalk {
  id: number;
  osm_id: string | null;
  name: string;
  description: string | null;
  distance_km: number;
  estimated_duration_min: number | null;
  difficulty: string | null;
  route_polyline: string;
  start_lat: number;
  start_lng: number;
  region: string | null;
  country: string | null;
  tags: string | null;
  source: string | null;
  distance_from_user_km?: number;
}

export interface DiscoverPublicWalksResponse {
  refreshed: number;
  walks: PublicWalk[];
}

export interface Stats {
  total_runs: number;
  total_km: number;
  current_streak: number;
  longest_streak: number;
  average_pace: string;
  runs_this_week: number;
  km_this_week: number;
  runs_this_month: number;
  km_this_month: number;
  total_duration_seconds: number;
}

export interface MotivationalMessage {
  message: string;
  emoji: string;
  achievement?: string;
}

export interface WeeklyStreakProgress {
  runs_completed: number;
  runs_needed: number;
  is_complete: boolean;
  current_streak: number;
  longest_streak: number;
  message: string;
  is_comeback: boolean;
  weeks_away: number;
  missed_last_week: boolean;
}

export interface DailyWisdom {
  text: string;
  author: string;
}

export interface StreakPeriod {
  start_week: string;
  end_week: string;
  length: number;
  is_current: boolean;
}

export interface SeasonalMarker {
  type: string;
  message: string;
  season: string;
  emoji: string;
}

export interface PersonalRecord {
  time: string;
  duration_seconds: number;
  pace: string;
  date: string;
  run_id: number;
  run_count: number;
}

export interface PersonalRecords {
  [key: string]: PersonalRecord | null;
}

export interface GoalsProgress {
  yearly: {
    goal_km: number;
    current_km: number;
    remaining_km: number;
    percent: number;
    days_remaining: number;
    on_track: boolean;
    expected_percent: number;
  };
  monthly: {
    goal_km: number;
    current_km: number;
    remaining_km: number;
    percent: number;
    days_remaining: number;
    month_name: string;
    is_complete: boolean;
    expected_percent: number;
  };
  monthly_goals_hit: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  unlocked: boolean;
  unlocked_at?: string | null;
}

export interface AchievementsData {
  unlocked: Achievement[];
  locked: Achievement[];
  total: number;
  unlocked_count: number;
}

export interface WeightEntry {
  id: number;
  weight_lbs: number;
  recorded_at: string;
  notes: string | null;
}

export interface WeightProgress {
  start_weight: number;
  current_weight: number;
  goal_weight: number;
  weight_lost: number;
  weight_to_lose: number;
  percent_complete: number;
  on_track: boolean;
  trend: 'up' | 'down' | 'stable';
  entries_count: number;
}

export interface WeightChartData {
  date: string;
  weight: number;
  label: string;
}

// ==========================================
// 🏃 RUN API
// ==========================================

export const runApi = {
  /**
   * ✨ Create a new run
   */
  create: (run: {
    run_type: string;
    duration_seconds: number;
    notes?: string;
    completed_at?: string;
    mood?: string;
    category?: string;
    // GPS fields for outdoor tracked runs
    route_polyline?: string;
    start_lat?: number;
    start_lng?: number;
    end_lat?: number;
    end_lng?: number;
    elevation_gain_m?: number;
    started_at?: string;
    distance_km?: number;
  }): Promise<Run> => {
    return apiFetch('/runs', {
      method: 'POST',
      body: JSON.stringify(run),
    });
  },

  /**
   * 📖 Get all runs
   */
  getAll: (params?: { run_type?: string; limit?: number; category?: string }): Promise<Run[]> => {
    const queryParams = new URLSearchParams();
    if (params?.run_type) queryParams.set('run_type', params.run_type);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.category) queryParams.set('category', params.category);
    
    const query = queryParams.toString();
    return apiFetch(`/runs${query ? `?${query}` : ''}`);
  },

  /**
   * 🔍 Get a single run
   */
  get: (id: number): Promise<Run> => {
    return apiFetch(`/runs/${id}`);
  },

  /**
   * ✏️ Update a run
   */
  update: (id: number, data: {
    run_type?: string;
    duration_seconds?: number;
    notes?: string;
    mood?: string;
  }): Promise<Run> => {
    return apiFetch(`/runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 🗑️ Delete a run
   */
  delete: (id: number): Promise<void> => {
    return apiFetch(`/runs/${id}`, { method: 'DELETE' });
  },
};

// ==========================================
// 📊 STATS API
// ==========================================

export const statsApi = {
  /**
   * 📊 Get user statistics
   */
  get: (): Promise<Stats> => {
    return apiFetch('/stats');
  },

  /**
   * 🎉 Get motivational message
   */
  getMotivation: (): Promise<MotivationalMessage> => {
    return apiFetch('/motivation');
  },

  /**
   * 🔥 Get weekly streak progress
   */
  getStreakProgress: (): Promise<WeeklyStreakProgress> => {
    return apiFetch('/streak');
  },

  /**
   * 🏆 Get personal records
   */
  getPersonalRecords: (category?: string): Promise<PersonalRecords> => {
    const query = category ? `?category=${category}` : '';
    return apiFetch(`/personal-records${query}`);
  },

  /**
   * 🎯 Get goals progress
   */
  getGoals: (): Promise<GoalsProgress> => {
    return apiFetch('/goals');
  },

  /**
   * 🎖️ Get achievements
   */
  getAchievements: (): Promise<AchievementsData> => {
    return apiFetch('/achievements');
  },

  getDailyWisdom: (): Promise<DailyWisdom> => {
    return apiFetch('/daily-wisdom');
  },

  getStreakHistory: (): Promise<StreakPeriod[]> => {
    return apiFetch('/streak-history');
  },

  getSeasonalMarkers: (): Promise<{ markers: SeasonalMarker[] }> => {
    return apiFetch('/seasonal-markers');
  },

  getMonthReview: (month?: number, year?: number): Promise<MonthInReview> => {
    const params = new URLSearchParams();
    if (month !== undefined) params.append('month', month.toString());
    if (year !== undefined) params.append('year', year.toString());
    const query = params.toString();
    return apiFetch(`/month-review${query ? '?' + query : ''}`);
  },
};

// ==========================================
// ⚖️ WEIGHT API
// ==========================================

export const weightApi = {
  /**
   * ⚖️ Get all weight entries
   */
  getAll: (limit: number = 100): Promise<WeightEntry[]> => {
    return apiFetch(`/weights?limit=${limit}`);
  },

  /**
   * ⚖️ Create a new weight entry
   */
  create: (data: { weight_lbs: number; recorded_at?: string; notes?: string }): Promise<WeightEntry> => {
    return apiFetch('/weights', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * ⚖️ Delete a weight entry
   */
  delete: (id: number): Promise<void> => {
    return apiFetch(`/weights/${id}`, { method: 'DELETE' });
  },

  /**
   * ⚖️ Get weight progress
   */
  getProgress: (): Promise<WeightProgress> => {
    return apiFetch('/weight-progress');
  },

  /**
   * ⚖️ Get weight chart data
   */
  getChartData: (): Promise<WeightChartData[]> => {
    return apiFetch('/weight-chart');
  },
};

// ==========================================
// 👟 STEPS API
// ==========================================

export interface StepEntry {
  id: number;
  step_count: number;
  recorded_date: string;
  notes: string | null;
}

export interface StepsSummary {
  current_month: {
    month: string;
    days_15k: number;
    days_20k: number;
    days_25k: number;
    days_30k: number;
    highest: number;
    total_entries: number;
  };
  monthly_history: Array<{
    month: string;
    days_15k: number;
    days_20k: number;
    days_25k: number;
    days_30k: number;
    highest: number;
    total_entries: number;
  }>;
  all_time: {
    days_15k: number;
    days_20k: number;
    days_25k: number;
    days_30k: number;
    total_entries: number;
  };
}

export interface MonthInReview {
  should_show: boolean;
  month_name: string;
  year: number;
  month: number;
  total_runs: number;
  total_km: number;
  total_duration_seconds: number;
  avg_pace: string;
  outdoor_runs: number;
  treadmill_runs: number;
  runs_by_type: Record<string, number>;
  total_step_days: number;
  total_steps: number;
  avg_daily_steps: number;
  high_step_days: number;
  days_15k: number;
  days_20k: number;
  days_25k: number;
  days_30k: number;
  start_weight: number | null;
  end_weight: number | null;
  weight_change: number | null;
  best_streak_in_month: number;
  rhythm_weeks_hit: number;
  rhythm_weeks_total: number;
  monthly_km_goal: number;
  monthly_km_achieved: number;
  goal_percent: number;
  goal_met: boolean;
  prs_achieved: string[];
  km_vs_last_month: number;
  runs_vs_last_month: number;
}

export const stepsApi = {
  /**
   * 👟 Get all step entries
   */
  getAll: (limit: number = 100): Promise<StepEntry[]> => {
    return apiFetch(`/steps?limit=${limit}`);
  },

  /**
   * 👟 Create a new step entry
   */
  create: (data: { step_count: number; recorded_date?: string; notes?: string }): Promise<StepEntry> => {
    return apiFetch('/steps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 👟 Update a step entry
   */
  update: (id: number, data: { step_count?: number; recorded_date?: string; notes?: string | null }): Promise<StepEntry> => {
    return apiFetch(`/steps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 👟 Delete a step entry
   */
  delete: (id: number): Promise<void> => {
    return apiFetch(`/steps/${id}`, { method: 'DELETE' });
  },

  /**
   * 👟 Get steps summary (monthly counts)
   */
  getSummary: (): Promise<StepsSummary> => {
    return apiFetch('/steps/summary');
  },
};

// ==========================================
// 🏋️ GYM API (Strength Training)
// ==========================================

export interface GymExerciseLog {
  name: string;
  sets: { reps: number; completed: boolean }[];
  weight_kg: number;
}

export interface GymWorkout {
  id: number;
  completed_at: string | null;
  exercises: GymExerciseLog[];
  notes: string | null;
  duration_minutes: number | null;
}

export interface GymProgramExercise {
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  machine: string;
  increment_kg: number;
  is_timed: boolean;
}

export interface ExerciseCatalogEntry {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string | null;
  default_weight_kg: number;
  weight_kg: number;
  increment_kg: number;
  default_sets: number;
  default_reps: number;
  is_timed: boolean;
  is_custom: boolean;
}

export interface ExerciseHistoryEntry {
  date: string;
  weight: number;
  volume: number;
  best_set_reps: number;
  sets: number;
  reps: number;
}

export interface GymStats {
  total_workouts: number;
  this_week: number;
  streak_weeks: number;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  unique_exercises: number;
  progression: Record<string, { first: number; current: number }>;
  volume: Record<string, ExerciseHistoryEntry[]>;
  frequency: { week_start: string; count: number }[];
  personal_records: Record<string, { weight: number; date: string }>;
  exercise_history: Record<string, ExerciseHistoryEntry[]>;
}

export const gymApi = {
  create: (data: {
    exercises: GymExerciseLog[];
    notes?: string;
    duration_minutes?: number;
  }): Promise<GymWorkout> => {
    return apiFetch('/gym/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: (limit: number = 50, offset: number = 0): Promise<GymWorkout[]> => {
    return apiFetch(`/gym/workouts?limit=${limit}&offset=${offset}`);
  },

  update: (id: number, data: {
    exercises?: GymExerciseLog[];
    notes?: string;
    duration_minutes?: number;
  }): Promise<GymWorkout> => {
    return apiFetch(`/gym/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiFetch(`/gym/workouts/${id}`, { method: 'DELETE' });
  },

  getProgram: (): Promise<{ exercises: GymProgramExercise[] }> => {
    return apiFetch('/gym/program');
  },

  getStats: (): Promise<GymStats> => {
    return apiFetch('/gym/stats');
  },
};

export const exerciseApi = {
  getAll: (): Promise<ExerciseCatalogEntry[]> => {
    return apiFetch('/gym/exercises');
  },

  create: (data: {
    name: string;
    muscle_group?: string;
    equipment?: string;
    default_weight_kg?: number;
    increment_kg?: number;
    default_sets?: number;
    default_reps?: number;
    is_timed?: boolean;
  }): Promise<ExerciseCatalogEntry> => {
    return apiFetch('/gym/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiFetch(`/gym/exercises/${id}`, { method: 'DELETE' });
  },
};

// ==========================================
// 📸 PHOTO API (Scenic Runs)
// ==========================================

export const photoApi = {
  upload: (runId: number, data: {
    photo_data: string;
    distance_marker_km: number;
    caption?: string;
  }): Promise<{ id: number; run_id: number; distance_marker_km: number; caption: string | null }> => {
    return apiFetch(`/runs/${runId}/photos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List a run's photos. Defaults to thumbnails (`thumb_data`).
   *   - `{ thumbnailsOnly: true }`: omit base64 entirely (metadata only)
   *   - `{ full: true }`: return full-resolution `photo_data` (legacy)
   */
  getForRun: (
    runId: number,
    opts?: { thumbnailsOnly?: boolean; full?: boolean },
  ): Promise<RunPhoto[]> => {
    const params: string[] = [];
    if (opts?.thumbnailsOnly) params.push('thumbnails_only=true');
    if (opts?.full) params.push('full=true');
    const qs = params.length ? `?${params.join('&')}` : '';
    return apiFetch(`/runs/${runId}/photos${qs}`);
  },

  /** Fetch a single run photo's full-resolution base64. Used by the lightbox
   *  to upgrade quality after the user taps a thumbnail. */
  getRunPhotoFull: (runId: number, photoId: number): Promise<RunPhoto> => {
    return apiFetch(`/runs/${runId}/photos/${photoId}/full`);
  },

  delete: (runId: number, photoId: number): Promise<void> => {
    return apiFetch(`/runs/${runId}/photos/${photoId}`, { method: 'DELETE' });
  },

  /**
   * 📸 Update a run photo's caption.
   * Pass `null` or `''` to clear it.
   */
  updateCaption: (runId: number, photoId: number, caption: string | null): Promise<RunPhoto> => {
    return apiFetch(`/runs/${runId}/photos/${photoId}`, {
      method: 'PUT',
      body: JSON.stringify({ caption: caption ?? null }),
    });
  },

  getScenicRuns: (): Promise<ScenicRun[]> => {
    return apiFetch('/scenic-runs');
  },
};

// ==========================================
// 📸 UNIFIED ALBUM API — runs + walks photos in one feed
// ==========================================

export interface AlbumPhotoActivity {
  id: number;
  kind: 'run' | 'walk';
  distance_km: number;
  duration_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  run_type: string | null;
  category: string | null;
}

export interface AlbumPhoto {
  id: number;
  kind: 'run' | 'walk';
  activity_id: number;
  distance_marker_km: number;
  lat: number | null;
  lng: number | null;
  caption: string | null;
  created_at: string;
  /**
   * Base64 image. By default this is a small (~360px) thumbnail — enough
   * for grids and feed cards. Use `albumApi.getFull(kind, id)` to fetch the
   * full-resolution image when needed (e.g. in the detail viewer).
   */
  photo_data?: string;
  /** True when `photo_data` is the small thumbnail rather than full size. */
  is_thumb?: boolean;
  activity: AlbumPhotoActivity;
}

export interface AlbumPage {
  items: AlbumPhoto[];
  next_cursor: string | null;
}

export const albumApi = {
  /**
   * 📸 List the current user's photos across runs and walks, newest first.
   * Cursor-based pagination — pass `next_cursor` from a previous response.
   * Returns small thumbnails by default; set `full: true` for full-res JPEGs
   * (much heavier — only use for export tools).
   */
  list: (params?: {
    cursor?: string | null;
    limit?: number;
    include_data?: boolean;
    full?: boolean;
  }): Promise<AlbumPage> => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.include_data === false) qs.set('include_data', 'false');
    if (params?.full) qs.set('full', 'true');
    const query = qs.toString();
    return apiFetch(`/me/photos${query ? `?${query}` : ''}`);
  },

  /**
   * 📸 Fetch the full-resolution base64 image for a single album photo.
   * The detail viewer calls this to upgrade the thumbnail it already has.
   */
  getFull: (
    kind: 'run' | 'walk',
    photoId: number,
  ): Promise<{ id: number; kind: 'run' | 'walk'; photo_data: string }> => {
    return apiFetch(`/me/photos/${kind}/${photoId}/full`);
  },
};

// ==========================================
// 🔧 UTILITY FUNCTIONS
// ==========================================

/**
 * Format seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get distance for a run type
 */
export function getDistance(runType: string): number {
  const distances: Record<string, number> = {
    '1k': 1,
    '2k': 2,
    '3k': 3,
    '5k': 5,
    '8k': 8,
    '10k': 10,
    '15k': 15,
    '18k': 18,
    '21k': 21,
  };
  return distances[runType] || 0;
}

// Weekly Reflections API
export const reflectionsApi = {
  getCurrent: (): Promise<{ has_reflection: boolean; reflection?: string; mood?: string }> => {
    return apiFetch('/reflections/current');
  },
  save: (reflection: string, mood: string): Promise<any> => {
    return apiFetch('/reflections', {
      method: 'POST',
      body: JSON.stringify({ reflection, mood }),
    });
  },
};

// Runner Level API
export const levelApi = {
  get: async (): Promise<any> => {
    return apiFetch('/user/level');
  },
  set: async (level: string): Promise<any> => {
    return apiFetch('/user/level', {
      method: 'PUT',
      body: JSON.stringify({ level }),
    });
  },
};

// ==========================================
// 🚶 WALK API
// ==========================================

export const walkApi = {
  create: (data: {
    duration_seconds: number;
    distance_km: number;
    started_at?: string;
    ended_at?: string;
    route_polyline?: string;
    start_lat?: number;
    start_lng?: number;
    end_lat?: number;
    end_lng?: number;
    elevation_gain_m?: number;
    notes?: string;
    mood?: string;
    category?: string;
    public_walk_id?: number;
  }): Promise<Walk> => {
    return apiFetch('/walks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list: (limit = 50, offset = 0): Promise<Walk[]> => {
    return apiFetch(`/walks?limit=${limit}&offset=${offset}`);
  },

  get: (id: number): Promise<Walk> => {
    return apiFetch(`/walks/${id}`);
  },

  update: (id: number, data: { notes?: string; mood?: string; category?: string }): Promise<Walk> => {
    return apiFetch(`/walks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: number): Promise<void> => {
    return apiFetch(`/walks/${id}`, { method: 'DELETE' });
  },

  getStats: (): Promise<WalkStats> => {
    return apiFetch('/walks/stats');
  },
};

export const walkPhotoApi = {
  upload: (
    walkId: number,
    data: {
      photo_data: string;
      lat?: number;
      lng?: number;
      distance_marker_km?: number;
      caption?: string;
    }
  ): Promise<WalkPhoto> => {
    return apiFetch(`/walks/${walkId}/photos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List a walk's photos. Defaults to thumbnails (`thumb_data`).
   *   - `{ full: true }`: return full-resolution `photo_data` (legacy)
   */
  getForWalk: (walkId: number, opts?: { full?: boolean }): Promise<WalkPhoto[]> => {
    const qs = opts?.full ? '?full=true' : '';
    return apiFetch(`/walks/${walkId}/photos${qs}`);
  },

  /** Fetch a single walk photo's full-resolution base64. */
  getWalkPhotoFull: (walkId: number, photoId: number): Promise<WalkPhoto> => {
    return apiFetch(`/walks/${walkId}/photos/${photoId}/full`);
  },

  delete: (walkId: number, photoId: number): Promise<void> => {
    return apiFetch(`/walks/${walkId}/photos/${photoId}`, { method: 'DELETE' });
  },

  /**
   * 📸 Update a walk photo's caption.
   * Pass `null` or `''` to clear it.
   */
  updateCaption: (walkId: number, photoId: number, caption: string | null): Promise<WalkPhoto> => {
    return apiFetch(`/walks/${walkId}/photos/${photoId}`, {
      method: 'PUT',
      body: JSON.stringify({ caption: caption ?? null }),
    });
  },
};

// ==========================================
// 🌳 NEIGHBOURHOOD
// ==========================================

export interface NeighbourhoodMe {
  opted_in: boolean;
  handle: string | null;
  home_city: string | null;
  home_country: string | null;
  home_lat: number | null;
  home_lng: number | null;
  widen_radius_km: number;
  latest_run_centroid_lat: number | null;
  latest_run_centroid_lng: number | null;
}

export interface NeighbourhoodSearchHit {
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  label: string;
}

export interface NeighbourhoodReactionState {
  like_count: number;
  love_count: number;
  zen_count: number;
  viewer_has_liked: boolean;
  viewer_has_loved: boolean;
  viewer_has_zenned: boolean;
}

export interface NeighbourhoodFeedItem extends NeighbourhoodReactionState {
  run_id: number;
  handle: string;
  city: string | null;
  distance_km: number;
  duration_seconds: number;
  completed_at: string | null;
  photo_thumb_data: string | null;
  saves_count: number;
  i_ran_this_count: number;
  viewer_has_saved: boolean;
  viewer_has_run_this: boolean;
}

export interface NeighbourhoodFeedResponse {
  items: NeighbourhoodFeedItem[];
  next_cursor: { published_before: string | null; before_run_id: number } | null;
}

export interface NeighbourhoodRunDetail extends NeighbourhoodReactionState {
  run_id: number;
  handle: string;
  city: string | null;
  distance_km: number;
  duration_seconds: number;
  completed_at: string | null;
  route_polyline: string | null;
  notes: string | null;
  photos: Array<{
    id: number;
    distance_marker_km: number;
    caption: string | null;
    photo_data: string;
  }>;
  saves_count: number;
  i_ran_this_count: number;
  viewer_has_saved: boolean;
  viewer_has_run_this: boolean;
}

export const neighbourhoodApi = {
  getMe: (): Promise<NeighbourhoodMe> => apiFetch('/me/neighbourhood'),

  patchMe: (body: {
    opted_in?: boolean;
    home_city?: string | null;
    home_country?: string | null;
    home_lat?: number | null;
    home_lng?: number | null;
    widen_radius_km?: number;
  }): Promise<NeighbourhoodMe> =>
    apiFetch('/me/neighbourhood', { method: 'PATCH', body: JSON.stringify(body) }),

  suggestFromLatLng: (lat: number, lng: number): Promise<{ city: string; country: string | null; lat: number; lng: number; cached: boolean }> =>
    apiFetch('/me/neighbourhood/suggest', { method: 'POST', body: JSON.stringify({ lat, lng }) }),

  searchPlaces: (q: string): Promise<{ results: NeighbourhoodSearchHit[] }> =>
    apiFetch(`/me/neighbourhood/search?q=${encodeURIComponent(q)}`),

  getFeed: (params?: {
    limit?: number;
    include_widen?: boolean;
    published_before?: string | null;
    before_run_id?: number | null;
  }): Promise<NeighbourhoodFeedResponse> => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.include_widen) qs.append('include_widen', 'true');
    if (params?.published_before) qs.append('published_before', params.published_before);
    if (params?.before_run_id != null) qs.append('before_run_id', String(params.before_run_id));
    const s = qs.toString();
    return apiFetch(`/neighbourhood/feed${s ? `?${s}` : ''}`);
  },

  getSaved: (): Promise<{ items: NeighbourhoodFeedItem[] }> => apiFetch('/neighbourhood/saved'),

  getRun: (runId: number): Promise<NeighbourhoodRunDetail> => apiFetch(`/neighbourhood/runs/${runId}`),

  shareRun: (runId: number): Promise<Run> =>
    apiFetch(`/runs/${runId}/share-neighbourhood`, { method: 'POST', body: JSON.stringify({}) }),

  unshareRun: (runId: number): Promise<Run> =>
    apiFetch(`/runs/${runId}/share-neighbourhood`, { method: 'DELETE' }),

  saveAdd: (runId: number): Promise<{ status: string }> =>
    apiFetch(`/neighbourhood/runs/${runId}/save`, { method: 'POST', body: JSON.stringify({}) }),

  saveRemove: (runId: number): Promise<{ status: string }> =>
    apiFetch(`/neighbourhood/runs/${runId}/save`, { method: 'DELETE' }),

  iranAdd: (runId: number): Promise<{ status: string }> =>
    apiFetch(`/neighbourhood/runs/${runId}/i-ran-this`, { method: 'POST', body: JSON.stringify({}) }),

  iranRemove: (runId: number): Promise<{ status: string }> =>
    apiFetch(`/neighbourhood/runs/${runId}/i-ran-this`, { method: 'DELETE' }),

  // Toggle one of the standardised public reactions (👏 Like / 💚 Love /
  // 🌿 Zen). Backend dispatches Love → i-ran-this, Like+Zen → run_reactions.
  // Returns the post-toggle reaction state so the UI can update locally.
  toggleReaction: (runId: number, emoji: string): Promise<NeighbourhoodReactionState> =>
    apiFetch(`/neighbourhood/runs/${runId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  reportRun: (runId: number, reason?: string): Promise<{ status: string }> =>
    apiFetch(`/neighbourhood/runs/${runId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason || null }) }),
};

export const publicWalkApi = {
  list: (params?: {
    region?: string;
    country?: string;
    difficulty?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
    limit?: number;
  }): Promise<PublicWalk[]> => {
    const query = new URLSearchParams();
    if (params?.region) query.append('region', params.region);
    if (params?.country) query.append('country', params.country);
    if (params?.difficulty) query.append('difficulty', params.difficulty);
    if (params?.lat != null) query.append('lat', String(params.lat));
    if (params?.lng != null) query.append('lng', String(params.lng));
    if (params?.radius_km != null) query.append('radius_km', String(params.radius_km));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch(`/public-walks${qs ? `?${qs}` : ''}`);
  },

  get: (id: number): Promise<PublicWalk> => {
    return apiFetch(`/public-walks/${id}`);
  },

  discover: (params: {
    lat: number;
    lng: number;
    radius_km?: number;
    limit?: number;
  }): Promise<DiscoverPublicWalksResponse> => {
    return apiFetch('/public-walks/discover', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
