import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'https://run-production-83ca.up.railway.app';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('zenrun_token')?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ authenticated: false });
    }

    const data = await res.json();
    return NextResponse.json({
      authenticated: true,
      handle: data.handle,
      name: data.name,
      is_admin: data.is_admin ?? false,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
