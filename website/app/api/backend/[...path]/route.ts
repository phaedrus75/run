import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'https://run-production-83ca.up.railway.app';

async function proxyRequest(request: NextRequest, method: string) {
  const token = request.cookies.get('zenrun_token')?.value;
  const url = new URL(request.url);
  const backendPath = url.pathname.replace('/api/backend/', '/').replace(/\/+$/, '') || '/';
  const backendUrl = `${API_BASE_URL}${backendPath}${url.search}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      fetchOptions.body = await request.text();
    } catch { /* no body */ }
  }

  const res = await fetch(backendUrl, fetchOptions);
  const data = await res.text();

  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  });
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}
