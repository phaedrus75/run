'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'authorized' | 'denied'>('loading');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.is_admin) {
          setState('authorized');
        } else if (data.authenticated) {
          setState('denied');
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
