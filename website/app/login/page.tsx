'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Mode = 'login' | 'forgot' | 'reset';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/me';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Invalid email or password');
        setLoading(false);
        return;
      }

      const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/me';
      window.location.href = safeRedirect;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/backend/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Something went wrong');
      } else {
        setSuccess('If an account exists with this email, a reset code has been sent.');
        setTimeout(() => setMode('reset'), 2000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/backend/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: resetCode,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Invalid or expired reset code');
      } else {
        setSuccess('Password reset successfully. You can now log in.');
        setTimeout(() => { setMode('login'); setSuccess(''); }, 2000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {mode === 'login' && 'Log in to ZenRun'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Enter reset code'}
          </h1>
          <p className="text-gray-500">
            {mode === 'login' && 'Sign in with your ZenRun account to view circle members\' profiles.'}
            {mode === 'forgot' && 'Enter your email and we\'ll send you a 6-digit reset code.'}
            {mode === 'reset' && 'Check your email for the code we just sent.'}
          </p>
        </div>

        <form
          onSubmit={mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgot : handleReset}
          className="bg-white rounded-2xl shadow-sm p-8 space-y-5"
        >
          {(mode === 'login' || mode === 'forgot') && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-warm-bg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition-colors"
                placeholder="you@example.com"
              />
            </div>
          )}

          {mode === 'login' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-warm-bg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition-colors"
                placeholder="Your password"
              />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reset Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-warm-bg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition-colors text-center text-2xl tracking-[0.3em] font-bold"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-warm-bg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition-colors"
                  placeholder="Min 8 chars, upper + lower + number"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          {success && (
            <p className="text-sm text-teal-700 bg-teal-50 rounded-lg px-4 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-coral hover:bg-coral-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'forgot'
                  ? 'Send reset code'
                  : 'Reset password'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          {mode === 'login' && (
            <button
              onClick={() => { setError(''); setSuccess(''); setMode('forgot'); }}
              className="text-sm text-coral hover:text-coral-dark font-medium"
            >
              Forgot password?
            </button>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => { setError(''); setSuccess(''); setMode('login'); }}
              className="text-sm text-coral hover:text-coral-dark font-medium block mx-auto"
            >
              Back to login
            </button>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => { setError(''); setSuccess(''); setMode('reset'); }}
              className="text-sm text-gray-400 hover:text-gray-600 block mx-auto"
            >
              Already have a code?
            </button>
          )}

          <p className="text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/#download" className="text-coral hover:text-coral-dark font-medium">
              Download the app
            </Link>{' '}
            to get started.
          </p>
        </div>
      </div>
    </section>
  );
}
