'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface UserInfo {
  handle: string | null;
  name: string | null;
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default function AuthNav({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getCookie('zenrun_token');
    if (!token) {
      setChecked(true);
      return;
    }

    fetch(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.handle) {
          setUser({ handle: data.handle, name: data.name });
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  function handleLogout() {
    document.cookie = 'zenrun_token=; path=/; max-age=0';
    setUser(null);
    router.push('/');
    router.refresh();
  }

  if (!checked) return null;

  const linkClass =
    variant === 'header'
      ? 'text-sm font-medium text-gray-600 hover:text-coral transition-colors'
      : 'text-sm hover:text-white transition-colors';

  if (user) {
    return (
      <>
        <Link href={`/runner/${user.handle}`} className={linkClass}>
          My Profile
        </Link>
        <button onClick={handleLogout} className={linkClass}>
          Log out
        </button>
      </>
    );
  }

  return (
    <Link href="/login" className={linkClass}>
      Log in
    </Link>
  );
}
