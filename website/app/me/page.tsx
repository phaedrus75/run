import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { API_BASE_URL } from '../../lib/config';

export default async function MePage() {
  const cookieStore = cookies();
  const token = cookieStore.get('zenrun_token')?.value;

  if (!token) {
    redirect('/login?redirect=/me');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.handle) {
        redirect(`/runner/${data.handle}`);
      }
    }
  } catch {}

  redirect('/login?redirect=/me');
}
