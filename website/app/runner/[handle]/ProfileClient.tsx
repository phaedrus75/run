'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PrivacyToggle from './PrivacyToggle';

const LEVEL_META: Record<string, { name: string; emoji: string; color: string }> = {
  breath: { name: 'Breath', emoji: '🌱', color: '#4ECDC4' },
  stride: { name: 'Stride', emoji: '🏃', color: '#E8756F' },
  flow:   { name: 'Flow',   emoji: '🌊', color: '#6C5CE7' },
  zen:    { name: 'Zen',    emoji: '🧘', color: '#1A1A1A' },
};

const RHYTHM_STAGES = [
  { min: 26, emoji: '🌲', label: 'Mighty Oak' },
  { min: 16, emoji: '🍂', label: 'Through Seasons' },
  { min: 12, emoji: '🌳', label: 'Deep Roots' },
  { min: 8,  emoji: '🍀', label: 'Growing Strong' },
  { min: 6,  emoji: '🌾', label: 'Sapling' },
  { min: 4,  emoji: '🌴', label: 'Young Tree' },
  { min: 3,  emoji: '🌿', label: 'Sprout' },
  { min: 2,  emoji: '🌱', label: 'Seedling' },
  { min: 1,  emoji: '🌱', label: 'First Sprout' },
  { min: 0,  emoji: '🌰', label: 'Planted' },
];

function getRhythmStage(weeks: number) {
  for (const stage of RHYTHM_STAGES) {
    if (weeks >= stage.min) return stage;
  }
  return RHYTHM_STAGES[RHYTHM_STAGES.length - 1];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}


interface PersonalRecord {
  time: string;
  duration_seconds: number;
  pace: string;
  date: string;
  run_id: number;
}

interface ScenicRun {
  run_id: number;
  run_type: string;
  distance_km: number;
  completed_at?: string;
  photo_count: number;
  cover_photo?: string;
  caption?: string;
}

interface ProfileData {
  privacy: string;
  visible: boolean;
  is_own_profile: boolean;
  handle: string;
  name?: string;
  runner_level?: string;
  member_since?: string;
  total_runs?: number;
  total_km?: number;
  total_hours?: number;
  current_streak?: number;
  longest_streak?: number;
  outdoor_runs?: number;
  outdoor_km?: number;
  treadmill_runs?: number;
  treadmill_km?: number;
  yearly_km_goal?: number;
  yearly_km_done?: number;
  yearly_percent?: number;
  monthly_summary?: { month: string; runs: number; km: number }[];
  scenic_photos?: number;
  scenic_runs?: number;
  distance_breakdown?: Record<string, number>;
  personal_records?: Record<string, PersonalRecord | null>;
  scenic_gallery?: ScenicRun[];
  achievements?: { emoji: string; name: string; category: string }[];
  achievements_count?: number;
  achievements_total?: number;
}

type PageState =
  | { status: 'loading' }
  | { status: 'private'; handle: string }
  | { status: 'circles'; handle: string; isLoggedIn: boolean }
  | { status: 'visible'; data: ProfileData; isOwnAuth?: boolean };

export default function ProfileClient({ handle }: { handle: string }) {
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    async function loadProfile() {
      let meData: { handle?: string; name?: string; runner_level?: string; profile_privacy?: string; created_at?: string } | null = null;
      let isLoggedIn = false;

      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        isLoggedIn = sessionData.authenticated;
        if (isLoggedIn) {
          const meRes = await fetch('/api/backend/user/me');
          if (meRes.ok) meData = await meRes.json();
        }
      } catch {}

      const myHandle = meData?.handle?.toLowerCase() || null;
      const isOwnProfile = myHandle === handle.toLowerCase();

      try {
        const res = await fetch(`/api/backend/profile/${handle}`);

        if (res.ok) {
          const data: ProfileData = await res.json();
          if (data.visible) {
            setState({ status: 'visible', data, isOwnAuth: isLoggedIn && isOwnProfile });
            return;
          }
          if (isOwnProfile) {
            const fullData = await buildOwnProfile(handle, meData!);
            setState({ status: 'visible', data: fullData, isOwnAuth: true });
            return;
          }
          setState({ status: 'circles', handle, isLoggedIn });
          return;
        }

        if (isOwnProfile) {
          const fullData = await buildOwnProfile(handle, meData!);
          setState({ status: 'visible', data: fullData, isOwnAuth: true });
          return;
        }

        setState({ status: 'private', handle });
      } catch {
        if (isOwnProfile) {
          const fullData = await buildOwnProfile(handle, meData!);
          setState({ status: 'visible', data: fullData, isOwnAuth: true });
          return;
        }
        setState({ status: 'private', handle });
      }
    }

    async function buildOwnProfile(
      profileHandle: string,
      me: { handle?: string; name?: string; runner_level?: string; profile_privacy?: string },
    ): Promise<ProfileData> {
      const [statsRes, streakRes, achievementsRes, prsRes, scenicRes, goalsRes] = await Promise.all([
        fetch('/api/backend/stats').catch(() => null),
        fetch('/api/backend/streak').catch(() => null),
        fetch('/api/backend/achievements').catch(() => null),
        fetch('/api/backend/personal-records').catch(() => null),
        fetch('/api/backend/scenic-runs').catch(() => null),
        fetch('/api/backend/goals').catch(() => null),
      ]);

      const stats = statsRes?.ok ? await statsRes.json() : {};
      const streak = streakRes?.ok ? await streakRes.json() : {};
      const achievements = achievementsRes?.ok ? await achievementsRes.json() : {};
      const prs = prsRes?.ok ? await prsRes.json() : {};
      const scenicRuns = scenicRes?.ok ? await scenicRes.json() : [];
      const goalsData = goalsRes?.ok ? await goalsRes.json() : {};

      const totalSeconds = stats.total_duration_seconds || 0;

      const scenicGallery: ScenicRun[] = (Array.isArray(scenicRuns) ? scenicRuns : []).slice(0, 6).map((sr: Record<string, unknown>) => ({
        run_id: sr.id as number,
        run_type: sr.run_type as string,
        distance_km: sr.distance_km as number,
        completed_at: sr.completed_at as string | undefined,
        photo_count: sr.photo_count as number,
        cover_photo: sr.cover_photo as string | undefined,
        caption: undefined,
      }));

      const yearlyGoal = goalsData.yearly_km_goal || 0;
      const yearlyDone = stats.total_km || 0;
      const yearlyPct = yearlyGoal > 0 ? Math.round((yearlyDone / yearlyGoal) * 1000) / 10 : 0;

      return {
        privacy: me.profile_privacy || 'private',
        visible: true,
        is_own_profile: true,
        handle: profileHandle,
        name: me.name,
        runner_level: me.runner_level || 'breath',
        total_runs: stats.total_runs || 0,
        total_km: stats.total_km || 0,
        total_hours: totalSeconds ? Math.round((totalSeconds / 3600) * 10) / 10 : 0,
        current_streak: streak.current_streak || 0,
        longest_streak: streak.longest_streak || 0,
        yearly_km_goal: yearlyGoal,
        yearly_km_done: Math.round(yearlyDone * 10) / 10,
        yearly_percent: yearlyPct,
        outdoor_runs: stats.outdoor_runs,
        outdoor_km: stats.outdoor_km,
        treadmill_runs: stats.treadmill_runs,
        treadmill_km: stats.treadmill_km,
        monthly_summary: stats.monthly_summary,
        scenic_photos: stats.scenic_photos,
        scenic_runs: stats.scenic_runs,
        distance_breakdown: stats.distance_breakdown,
        personal_records: prs,
        scenic_gallery: scenicGallery,
        achievements: (achievements.unlocked || []).map((a: { emoji: string; name: string; category: string }) => ({
          emoji: a.emoji, name: a.name, category: a.category,
        })),
        achievements_count: achievements.unlocked_count || 0,
        achievements_total: achievements.total || 0,
      };
    }

    loadProfile();
  }, [handle]);

  if (state.status === 'loading') {
    return (
      <section className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="animate-pulse text-gray-400">Loading profile...</div>
      </section>
    );
  }

  if (state.status === 'private') {
    return <PrivateView handle={state.handle} />;
  }

  if (state.status === 'circles') {
    return <CirclesView handle={state.handle} isLoggedIn={state.isLoggedIn} />;
  }

  return <FullProfile data={state.data} isOwnAuth={state.isOwnAuth} />;
}

function PrivateView({ handle }: { handle: string }) {
  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🌿</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">This runner keeps their journey private.</h1>
        <p className="text-gray-500 mb-8">
          @{handle}&apos;s profile is not visible. Respect their choice to run quietly.
        </p>
        <Link
          href="/"
          className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Start your own journey
        </Link>
      </div>
    </section>
  );
}

function CirclesView({ handle, isLoggedIn }: { handle: string; isLoggedIn: boolean }) {
  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">👥</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          @{handle} shares their journey with their circle.
        </h1>
        <p className="text-gray-500 mb-8">
          {isLoggedIn
            ? "You\u2019re not in a circle with this runner. Their full profile is only visible to circle members."
            : 'Log in with your ZenRun account to see if you share a circle with this runner.'}
        </p>
        {!isLoggedIn && (
          <Link
            href={`/login?redirect=/runner/${handle}`}
            className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Log in to ZenRun
          </Link>
        )}
      </div>
    </section>
  );
}

const DISTANCE_ORDER = ['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'];

function FullProfile({ data, isOwnAuth }: { data: ProfileData; isOwnAuth?: boolean }) {
  const level = LEVEL_META[data.runner_level || 'breath'] || LEVEL_META.breath;
  const rhythm = getRhythmStage(data.current_streak || 0);
  const memberSince = data.member_since
    ? new Date(data.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const totalRuns = data.total_runs || 0;
  const outdoorRuns = data.outdoor_runs || 0;
  const treadmillRuns = data.treadmill_runs || 0;
  const outdoorPct = totalRuns > 0 ? Math.round((outdoorRuns / totalRuns) * 100) : 0;
  const treadmillPct = totalRuns > 0 ? Math.round((treadmillRuns / totalRuns) * 100) : 0;

  const monthlySummary = data.monthly_summary || [];
  const maxMonthlyKm = Math.max(...monthlySummary.map((m) => m.km), 1);

  const breakdown = data.distance_breakdown || {};
  const breakdownEntries = DISTANCE_ORDER
    .filter((d) => breakdown[d] && breakdown[d] > 0)
    .map((d) => ({ distance: d.toUpperCase(), count: breakdown[d] }));
  const maxBreakdown = Math.max(...breakdownEntries.map((e) => e.count), 1);

  const prs = data.personal_records || {};
  const prEntries = DISTANCE_ORDER
    .filter((d) => prs[d] !== null && prs[d] !== undefined)
    .map((d) => ({ distance: d.toUpperCase(), ...(prs[d] as PersonalRecord) }));

  const gallery = data.scenic_gallery || [];

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-2xl mx-auto px-6">
        {data.is_own_profile && isOwnAuth && (
          <PrivacyToggle currentPrivacy={data.privacy} />
        )}

        <div className="text-center mb-12">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
            style={{ backgroundColor: level.color }}
          >
            {data.handle?.[0]?.toUpperCase() || '?'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            @{data.handle}
          </h1>
          <div className="inline-flex items-center gap-1.5 mt-3 bg-gray-100 rounded-full px-3 py-1">
            <span>{level.emoji}</span>
            <span className="text-sm font-medium text-gray-700">{level.name}</span>
          </div>
          {memberSince && (
            <p className="text-sm text-gray-400 mt-2">Running since {memberSince}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard value={totalRuns} label="runs" />
          <StatCard value={`${data.total_km || 0}`} label="km" />
          <StatCard value={`${data.total_hours || 0}`} label="hours" />
        </div>

        {(data.yearly_km_goal || 0) > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">2026 Goal</h2>
              <span className="text-sm font-bold text-gray-900">{Math.round(data.yearly_percent || 0)}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(data.yearly_percent || 0, 100)}%`,
                  backgroundColor: (data.yearly_percent || 0) >= 100 ? '#4ECDC4' : '#E8756F',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{data.yearly_km_done || 0} km done</span>
              <span>{data.yearly_km_goal} km goal</span>
            </div>
          </div>
        )}

        {totalRuns > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Outdoor vs Treadmill</h2>
            <div className="flex gap-2 mb-4 h-3 rounded-full overflow-hidden bg-gray-100">
              {outdoorPct > 0 && (
                <div className="bg-teal rounded-full transition-all" style={{ width: `${outdoorPct}%` }} />
              )}
              {treadmillPct > 0 && (
                <div className="bg-coral rounded-full transition-all" style={{ width: `${treadmillPct}%` }} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-teal shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{outdoorRuns} runs · {data.outdoor_km || 0} km</div>
                  <div className="text-xs text-gray-400">Outdoor ({outdoorPct}%)</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-coral shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{treadmillRuns} runs · {data.treadmill_km || 0} km</div>
                  <div className="text-xs text-gray-400">Treadmill ({treadmillPct}%)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {breakdownEntries.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Runs by Distance</h2>
            <div className="space-y-2.5">
              {breakdownEntries.map((e) => (
                <div key={e.distance} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500 w-10 shrink-0 text-right">{e.distance}</span>
                  <div className="flex-1 h-7 bg-gray-50 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-teal/20 rounded-full transition-all"
                      style={{ width: `${Math.max((e.count / maxBreakdown) * 100, 6)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-700">
                      {e.count} {e.count === 1 ? 'run' : 'runs'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {prEntries.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Personal Bests</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {prEntries.map((pr) => (
                <div key={pr.distance} className="bg-warm-bg rounded-xl p-4 text-center">
                  <div className="text-xs font-semibold text-gray-400 mb-1">{pr.distance}</div>
                  <div className="text-lg font-extrabold text-gray-900">{pr.time}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{pr.pace} /km</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rhythm</h2>
            <span className="text-sm text-gray-400">Longest: {data.longest_streak || 0}w</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{rhythm.emoji}</span>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900">{data.current_streak || 0}</span>
                <span className="text-gray-400">weeks</span>
              </div>
              <span className="text-sm text-gray-500">{rhythm.label}</span>
            </div>
          </div>
        </div>

        {monthlySummary.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Monthly Summary</h2>
            <div className="space-y-3">
              {monthlySummary.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 shrink-0">{formatMonth(m.month)}</span>
                  <div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-coral/20 rounded-full transition-all"
                      style={{ width: `${Math.max((m.km / maxMonthlyKm) * 100, 4)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-700">
                      {m.runs} runs · {m.km} km
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Scenic Runs</h2>
              <span className="text-sm text-gray-400">
                {data.scenic_photos || 0} photos · {data.scenic_runs || 0} runs
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.map((sr) => (
                <div key={sr.run_id} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square">
                  {sr.cover_photo ? (
                    <img
                      src={sr.cover_photo.startsWith('data:') ? sr.cover_photo : `data:image/jpeg;base64,${sr.cover_photo}`}
                      alt={`${sr.run_type} scenic run`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">📸</div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="text-white text-xs font-semibold">{sr.run_type?.toUpperCase()}</div>
                    <div className="text-white/70 text-[10px]">
                      {sr.photo_count} {sr.photo_count === 1 ? 'photo' : 'photos'}
                      {sr.completed_at && ` · ${new Date(sr.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(data.achievements_count || 0) > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex items-center gap-4">
            <span className="text-3xl">🏅</span>
            <div>
              <div className="text-2xl font-extrabold text-gray-900">{data.achievements_count}</div>
              <div className="text-sm text-gray-500">milestones achieved</div>
            </div>
          </div>
        )}

        {!data.is_own_profile && (
          <div className="text-center mt-12 pt-8 border-t border-gray-100">
            <p className="text-gray-500 mb-4">Start your own running journey</p>
            <Link
              href="/#download"
              className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Download ZenRun
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
      <div className="text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
