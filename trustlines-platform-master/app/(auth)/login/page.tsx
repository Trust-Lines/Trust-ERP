'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LoginShell } from '@/components/auth/LoginShell';

// Design: Figma "Desktop - 11" (1440x1024 frame). Assets exported from Figma live in /public/login.
const INK = '#2c2c2c';
const PLACEHOLDER = '#a8a8a8';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      router.replace('/auth/set-password' + hash);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // TEMP preview: send this account to the new TLines branch screen. Remove once role routing is defined.
    router.push(email.trim().toLowerCase() === 'hamzag@trust-lines.com' ? '/tlines-login' : '/home');
    router.refresh();
  }

  return (
    <LoginShell
      logo={
        <div style={{ position: 'relative', width: 255, height: 106 }} role="img" aria-label="T Holding">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/login/logo-top.svg" style={{ position: 'absolute', maxWidth: 'none', inset: '0 12.59% 47.7% 12.2%', width: '75.21%', height: '52.3%' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/login/logo-bottom.svg" style={{ position: 'absolute', maxWidth: 'none', inset: '47.53% 0 0 0', width: '100%', height: '52.47%' }} />
        </div>
      }
    >
      <style>{`
        .tl-login-field { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 11px; border: 1px solid ${PLACEHOLDER}; border-radius: 8px; box-sizing: border-box; background: #fff; }
        .tl-login-field:focus-within { border-color: ${INK}; }
        .tl-login-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 500 15px var(--font-brand); letter-spacing: 1.2px; color: ${INK}; }
        .tl-login-field input::placeholder { color: ${PLACEHOLDER}; }
      `}</style>
      <h1 style={{ margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 600, letterSpacing: '6.16px', textTransform: 'uppercase', color: INK, lineHeight: '38px' }}>
        Welcome back
      </h1>
      <p style={{ margin: '11px auto 0', width: 343, maxWidth: '100%', textAlign: 'center', fontSize: 15, fontWeight: 500, letterSpacing: '0.75px', lineHeight: '23px', color: INK }}>
        At accumsan metus ultricies, mauris metus felis, vehicula metus ultricie.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 47, display: 'flex', flexDirection: 'column', gap: 19 }}>
        <label className="tl-login-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/login/mail.svg" alt="" width={22} height={22} />
          <input id="email" type="email" autoComplete="email" required aria-label="Email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="tl-login-field">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/login/lock.svg" alt="" width={22} height={22} />
          <input id="password" type="password" autoComplete="current-password" required aria-label="Password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>

        <a href="/auth/set-password" style={{ alignSelf: 'flex-end', fontSize: 11, fontWeight: 500, letterSpacing: '0.88px', textTransform: 'uppercase', textDecoration: 'underline', color: INK }}>
          Forgot password
        </a>

        {error && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ height: 52, marginTop: error ? 0 : 29, border: 0, borderRadius: 8, background: INK, color: '#fff', fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 600, letterSpacing: '1.44px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </LoginShell>
  );
}
