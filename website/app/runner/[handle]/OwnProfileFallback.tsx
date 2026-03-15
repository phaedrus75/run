'use client';

import { useEffect, useState } from 'react';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default function OwnProfileFallback({
  handle,
  children,
}: {
  handle: string;
  children: React.ReactNode;
}) {
  const [isOwn, setIsOwn] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getCookie('zenrun_token');
    if (!token) {
      setIsOwn(false);
      return;
    }

    fetch(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.handle?.toLowerCase() === handle.toLowerCase()) {
          window.location.reload();
        } else {
          setIsOwn(false);
        }
      })
      .catch(() => setIsOwn(false));
  }, [handle]);

  if (isOwn === null) {
    return (
      <section className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-gray-400">Loading...</div>
      </section>
    );
  }

  return <>{children}</>;
}
