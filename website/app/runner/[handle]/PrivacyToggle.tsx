'use client';

import { useState } from 'react';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

const PRIVACY_OPTIONS = [
  { value: 'private', label: 'Private', emoji: '🔒', desc: 'Only you can see your profile' },
  { value: 'circles', label: 'Circles', emoji: '👥', desc: 'Visible to your circle members' },
  { value: 'public',  label: 'Public',  emoji: '🌐', desc: 'Anyone can see your profile' },
] as const;

export default function PrivacyToggle({
  currentPrivacy,
  token,
}: {
  currentPrivacy: string;
  token: string;
}) {
  const [privacy, setPrivacy] = useState(currentPrivacy);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function changePrivacy(newPrivacy: string) {
    if (newPrivacy === privacy || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE_URL}/user/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ privacy: newPrivacy }),
      });
      if (res.ok) {
        setPrivacy(newPrivacy);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {}
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm mb-8 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Profile Visibility
        </h2>
        {saved
          ? <span className="text-xs text-teal font-medium">Saved</span>
          : <span className="text-xs text-gray-400">This is your profile</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PRIVACY_OPTIONS.map((opt) => {
          const isActive = privacy === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => changePrivacy(opt.value)}
              disabled={saving}
              className={`
                rounded-xl p-3 text-center transition-all border-2
                ${isActive
                  ? 'border-coral bg-coral/5'
                  : 'border-transparent bg-gray-50 hover:bg-gray-100'}
                ${saving ? 'opacity-50' : ''}
              `}
            >
              <div className="text-xl mb-1">{opt.emoji}</div>
              <div className={`text-xs font-semibold ${isActive ? 'text-coral' : 'text-gray-700'}`}>
                {opt.label}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
