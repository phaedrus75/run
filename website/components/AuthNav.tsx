'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserInfo {
  handle: string | null;
  name: string | null;
}

export default function AuthNav({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.handle) {
          setUser({ handle: data.handle, name: data.name });
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
