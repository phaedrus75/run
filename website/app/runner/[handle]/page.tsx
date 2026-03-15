import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

const LEVEL_META: Record<string, { name: string; emoji: string; color: string }> = {
  breath: { name: 'Breath', emoji: '🌱', color: '#4ECDC4' },
  stride: { name: 'Stride', emoji: '🏃', color: '#E8756F' },
  flow:   { name: 'Flow',   emoji: '🌊', color: '#6C5CE7' },
  zen:    { name: 'Zen',    emoji: '🧘', color: '#1A1A1A' },
};

const RHYTHM_STAGES: { min: number; emoji: string; label: string }[] = [
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

interface ProfileData {
  privacy: string;
  visible: boolean;
  handle: string;
  name?: string;
  runner_level?: string;
  member_since?: string;
  total_runs?: number;
  total_km?: number;
  total_hours?: number;
  current_streak?: number;
  longest_streak?: number;
  achievements?: { emoji: string; name: string; category: string }[];
  achievements_count?: number;
  achievements_total?: number;
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  return {
    title: `@${params.handle} — ZenRun`,
    description: `View ${params.handle}'s running journey on ZenRun.`,
    openGraph: {
      title: `@${params.handle} — ZenRun`,
      description: `View ${params.handle}'s running journey on ZenRun.`,
    },
  };
}

async function fetchProfile(handle: string, token?: string): Promise<ProfileData | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/profile/${handle}`, {
      headers,
      cache: 'no-store',
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function RunnerProfilePage({ params }: { params: { handle: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get('zenrun_token')?.value;
  const profile = await fetchProfile(params.handle, token);

  if (!profile) {
    return <PrivateProfile handle={params.handle} />;
  }

  if (!profile.visible) {
    return <CirclesProfile handle={params.handle} isLoggedIn={!!token} />;
  }

  return <PublicProfile data={profile} />;
}

function PrivateProfile({ handle }: { handle: string }) {
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

function CirclesProfile({ handle, isLoggedIn }: { handle: string; isLoggedIn: boolean }) {
  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">👥</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          @{handle} shares their journey with their circle.
        </h1>
        <p className="text-gray-500 mb-8">
          {isLoggedIn
            ? "You're not in a circle with this runner. Their full profile is only visible to circle members."
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

function PublicProfile({ data }: { data: ProfileData }) {
  const level = LEVEL_META[data.runner_level || 'breath'] || LEVEL_META.breath;
  const rhythm = getRhythmStage(data.current_streak || 0);
  const memberSince = data.member_since
    ? new Date(data.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard value={data.total_runs || 0} label="runs" />
          <StatCard value={`${data.total_km || 0}`} label="km" />
          <StatCard value={`${data.total_hours || 0}`} label="hours" />
        </div>

        {/* Rhythm */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rhythm</h2>
            <span className="text-sm text-gray-400">
              Longest: {data.longest_streak || 0}w
            </span>
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

        {/* Achievements */}
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

        {/* CTA */}
        <div className="text-center mt-12 pt-8 border-t border-gray-100">
          <p className="text-gray-500 mb-4">Start your own running journey</p>
          <Link
            href="/#download"
            className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Download ZenRun
          </Link>
        </div>
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
