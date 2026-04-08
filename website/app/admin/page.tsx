'use client';

import { useEffect, useState } from 'react';

interface AdminStats {
  users: {
    total: number;
    new_this_week: number;
    new_this_month: number;
    onboarded: number;
    onboarding_pct: number;
    verified: number;
    verified_pct: number;
    active_this_week: number;
  };
  activity: {
    total_runs: number;
    total_km: number;
    total_gym_workouts: number;
    total_step_entries: number;
    total_weight_entries: number;
  };
  feature_adoption: Record<string, { users: number; pct: number }>;
  signups_over_time: { date: string; count: number }[];
  activity_over_time: { date: string; runs: number; gym: number; steps: number }[];
  dau: { date: string; count: number }[];
  wau: { week_start: string; count: number }[];
  top_users: {
    id: number;
    name: string;
    handle: string | null;
    runs: number;
    gym_workouts: number;
    last_active: string | null;
  }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/backend/admin/stats/')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Failed to load</h1>
          <p className="text-gray-500 text-sm">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mb-8">ZenRun analytics overview</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <MetricCard label="Total Users" value={stats.users.total} />
          <MetricCard label="Active This Week" value={stats.users.active_this_week} accent />
          <MetricCard label="New This Week" value={stats.users.new_this_week} />
          <MetricCard label="Total Runs" value={stats.activity.total_runs} />
          <MetricCard label="Total Gym" value={stats.activity.total_gym_workouts} />
          <MetricCard label="Total km" value={stats.activity.total_km} format="km" />
        </div>

        {/* Row: DAU + WAU */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card title="Daily Active Users" subtitle="Last 30 days">
            <BarChart
              data={stats.dau.map((d) => d.count)}
              labels={stats.dau.map((d) => shortDate(d.date))}
              color="#E8756F"
              height={160}
            />
          </Card>
          <Card title="Weekly Active Users" subtitle="Last 12 weeks">
            <BarChart
              data={stats.wau.map((w) => w.count)}
              labels={stats.wau.map((w) => shortDate(w.week_start))}
              color="#4ECDC4"
              height={160}
            />
          </Card>
        </div>

        {/* Row: Signups + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card title="Signups" subtitle="Last 30 days">
            <BarChart
              data={stats.signups_over_time.map((d) => d.count)}
              labels={stats.signups_over_time.map((d) => shortDate(d.date))}
              color="#6366F1"
              height={140}
            />
          </Card>
          <Card title="Daily Activity" subtitle="Runs, gym, steps — last 30 days">
            <StackedBarChart
              data={stats.activity_over_time}
              height={140}
            />
          </Card>
        </div>

        {/* Row: Feature Adoption + User health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card title="Feature Adoption" subtitle="% of users who have used each feature">
            <div className="space-y-3 mt-2">
              {Object.entries(stats.feature_adoption).map(([key, val]) => (
                <AdoptionBar key={key} label={capitalize(key)} pct={val.pct} count={val.users} />
              ))}
            </div>
          </Card>
          <Card title="User Health">
            <div className="grid grid-cols-2 gap-4 mt-2">
              <MiniStat label="Onboarded" value={`${stats.users.onboarding_pct}%`} sub={`${stats.users.onboarded} / ${stats.users.total}`} />
              <MiniStat label="Email Verified" value={`${stats.users.verified_pct}%`} sub={`${stats.users.verified} / ${stats.users.total}`} />
              <MiniStat label="New This Month" value={stats.users.new_this_month} />
              <MiniStat label="Weight Entries" value={stats.activity.total_weight_entries} />
              <MiniStat label="Step Entries" value={stats.activity.total_step_entries} />
              <MiniStat label="Total km" value={`${stats.activity.total_km.toLocaleString()}`} />
            </div>
          </Card>
        </div>

        {/* Top Users */}
        <Card title="Top Users" subtitle="By run count">
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium text-right">Runs</th>
                  <th className="pb-2 font-medium text-right">Gym</th>
                  <th className="pb-2 font-medium text-right">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <span className="font-medium text-gray-900">{u.name}</span>
                      {u.handle && (
                        <span className="ml-1.5 text-gray-400 text-xs">@{u.handle}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{u.runs}</td>
                    <td className="py-2.5 text-right tabular-nums">{u.gym_workouts}</td>
                    <td className="py-2.5 text-right text-gray-500">
                      {u.last_active ? shortDate(u.last_active) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Components                                                  */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  accent,
  format,
}: {
  label: string;
  value: number;
  accent?: boolean;
  format?: 'km';
}) {
  const display = format === 'km' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toLocaleString();
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-coral' : 'text-gray-900'}`}>
        {display}
      </p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function AdoptionBar({ label, pct, count }: { label: string; pct: number; count: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{count} users ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-coral rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG Charts                                                         */
/* ------------------------------------------------------------------ */

function BarChart({
  data,
  labels,
  color,
  height = 120,
}: {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const padY = 4;
  const barMaxH = height - padY * 2 - 16;

  return (
    <div className="mt-3">
      <svg width="100%" height={height} viewBox={`0 0 ${data.length * 20} ${height}`} preserveAspectRatio="none">
        {data.map((v, i) => {
          const barH = max > 0 ? (v / max) * barMaxH : 0;
          const x = i * 20 + 4;
          const w = 12;
          const y = height - padY - 14 - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(barH, 1)}
                rx={3}
                fill={v > 0 ? color : '#e5e7eb'}
                opacity={v > 0 ? 0.85 : 0.4}
              />
              {v > 0 && (
                <text x={x + w / 2} y={y - 2} textAnchor="middle" fontSize="7" fill="#6b7280">
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-1 -mt-1">
        <span className="text-[9px] text-gray-400">{labels[0]}</span>
        <span className="text-[9px] text-gray-400">{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function StackedBarChart({
  data,
  height = 120,
}: {
  data: { date: string; runs: number; gym: number; steps: number }[];
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.runs + d.gym + d.steps), 1);
  const padY = 4;
  const barMaxH = height - padY * 2 - 16;
  const colors = { runs: '#E8756F', gym: '#4ECDC4', steps: '#6366F1' };

  return (
    <div className="mt-3">
      <svg width="100%" height={height} viewBox={`0 0 ${data.length * 20} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const total = d.runs + d.gym + d.steps;
          const x = i * 20 + 4;
          const w = 12;
          let yOffset = height - padY - 14;
          const segments = [
            { val: d.runs, color: colors.runs },
            { val: d.gym, color: colors.gym },
            { val: d.steps, color: colors.steps },
          ];
          return (
            <g key={i}>
              {segments.map((seg, si) => {
                const segH = max > 0 ? (seg.val / max) * barMaxH : 0;
                yOffset -= segH;
                return (
                  <rect
                    key={si}
                    x={x}
                    y={yOffset}
                    width={w}
                    height={Math.max(segH, 0)}
                    fill={seg.color}
                    opacity={0.85}
                    rx={si === segments.length - 1 ? 3 : 0}
                  />
                );
              })}
              {total > 0 && (
                <text
                  x={x + w / 2}
                  y={height - padY - 14 - (total / max) * barMaxH - 2}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#6b7280"
                >
                  {total}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-1 -mt-1">
        <span className="text-[9px] text-gray-400">{shortDate(data[0].date)}</span>
        <span className="text-[9px] text-gray-400">{shortDate(data[data.length - 1].date)}</span>
      </div>
      <div className="flex gap-4 mt-2 justify-center">
        <Legend color={colors.runs} label="Runs" />
        <Legend color={colors.gym} label="Gym" />
        <Legend color={colors.steps} label="Steps" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
