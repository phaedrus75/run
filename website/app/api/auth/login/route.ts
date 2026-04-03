import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'https://run-production-83ca.up.railway.app';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(
      { detail: data.detail || 'Invalid email or password' },
      { status: res.status },
    );
  }

  const response = NextResponse.json({
    user: data.user,
  });

  response.cookies.set('zenrun_token', data.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
