'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PrivacyToggle from './PrivacyToggle';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

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

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
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
  monthly_summary?: { month: string; runs: number; km: number }[];
  scenic_photos?: number;
  scenic_runs?: number;
  achievements?: { emoji: string; name: string; category: string }[];
  achievements_count?: number;
  achievements_total?: number;
}

type PageState =
  | { status: 'loading' }
  | { status: 'private'; handle: string }
  | { status: 'circles'; handle: string; isLoggedIn: boolean }
  | { status: 'visible'; data: ProfileData; token?: string };

export default function ProfileClient({ handle }: { handle: string }) {
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    const token = getCookie('zenrun_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_BASE_URL}/profile/${handle}`, { headers })
      .then(async (res) => {
        if (res.status === 404) {
          setState({ status: 'private', handle });
          return;
        }
        if (!res.ok) {
          setState({ status: 'private', handle });
          return;
        }
        const data: ProfileData = await res.json();
        if (!data.visible) {
          setState({ status: 'circles', handle, isLoggedIn: !!token });
        } else {
          setState({ status: 'visible', data, token });
        }
      })
      .catch(() => {
        setState({ status: 'private', handle });
      });
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

  return <FullProfile data={state.data} token={state.token} />;
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

function FullProfile({ data, token }: { data: ProfileData; token?: string }) {
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

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-2xl mx-auto px-6">
        {data.is_own_profile && token && (
          <PrivacyToggle currentPrivacy={data.privacy} token={token} />
        )}

        <div className="text-center mb-12">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
            style={{ backgroundColor: level.color }}
          >
            {data.name?.[0]?.toUpperCase() || '?'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data.name || 'Runner'}
          </h1>
          <p className="text-gray-500 mt-1">@{data.handle}</p>
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

        {(data.scenic_runs || 0) > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Scenic Runs</h2>
            <div className="flex items-center gap-4">
              <span className="text-4xl">📸</span>
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {data.scenic_photos} photos across {data.scenic_runs} runs
                </div>
                <p className="text-sm text-gray-500">Capturing the views, km by km.</p>
              </div>
            </div>
          </div>
        )}

        {data.achievements && data.achievements.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Milestones</h2>
              <span className="text-sm text-gray-400">
                {data.achievements_count || 0} / {data.achievements_total || 0}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {data.achievements.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-warm-bg rounded-full px-3 py-1.5"
                  title={a.name}
                >
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{a.name}</span>
                </div>
              ))}
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
