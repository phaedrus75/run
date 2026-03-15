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

// 🔧 API Configuration
// Production URL (Railway deployment)
const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

// For local development, uncomment this:
// const API_BASE_URL = 'http://192.168.86.132:8000';

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
}

export interface WeeklyPlan {
  id: number;
  week_id: string;
  planned_runs: string[];
  created_at: string;
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
  };
  monthly: {
    goal_km: number;
    current_km: number;
    remaining_km: number;
    percent: number;
    days_remaining: number;
    month_name: string;
    is_complete: boolean;
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
// 📅 WEEKLY PLAN API
// ==========================================

export const planApi = {
  /**
   * 📅 Create or update a weekly plan
   */
  create: (plan: {
    week_id: string;
    planned_runs: string[];
  }): Promise<WeeklyPlan> => {
    return apiFetch('/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  },

  /**
   * 📅 Get current week's plan
   */
  getCurrent: (): Promise<WeeklyPlan> => {
    return apiFetch('/plans/current');
  },

  /**
   * 📅 Get a specific week's plan
   */
  get: (weekId: string): Promise<WeeklyPlan> => {
    return apiFetch(`/plans/${weekId}`);
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

  /**
   * ⚖️ Get weight progress
   */
  getWeightProgress: (): Promise<WeightProgress> => {
    return apiFetch('/weight-progress');
  },

  /**
   * ⚖️ Get weight chart data
   */
  getWeightChart: (): Promise<WeightChartData[]> => {
    return apiFetch('/weight-chart');
  },

  /**
   * 📅 Get month in review data
   */
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
    highest: number;
    total_entries: number;
  };
  monthly_history: Array<{
    month: string;
    days_15k: number;
    days_20k: number;
    days_25k: number;
    highest: number;
    total_entries: number;
  }>;
  all_time: {
    days_15k: number;
    days_20k: number;
    days_25k: number;
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
  start_weight: number | null;
  end_weight: number | null;
  weight_change: number | null;
  best_streak_in_month: number;
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
// 🔧 UTILITY FUNCTIONS
// ==========================================

/**
 * Get the current week ID (YYYY-Www)
 * Uses Sunday-Saturday weeks (US standard)
 */
export function getCurrentWeekId(): string {
  const now = new Date();
  
  // Find the Sunday that starts this week
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);
  
  // Calculate week number (weeks since start of year)
  const startOfYear = new Date(sunday.getFullYear(), 0, 1);
  const days = Math.floor((sunday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.floor(days / 7) + 1;
  
  return `${sunday.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get the start (Sunday) and end (Saturday) of current week
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);
  
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  
  return { start: sunday, end: saturday };
}

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
    '3k': 3,
    '5k': 5,
    '10k': 10,
    '15k': 15,
    '20k': 20,
  };
  return distances[runType] || 0;
}
