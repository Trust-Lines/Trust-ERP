'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

// TLines Creativity Group brand — Brand Guidelines 2026, "1.2 Colors": #ffffff / #777777 /
// #474747 / #1a1a1a. Kept local to this page (a deliberate, distinct "outside the app" moment)
// rather than touching the app-wide design tokens, which are a separate, much bigger change.
const INK = '#1a1a1a';
const SLATE = '#474747';
const MUTED = '#777777';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<'email' | 'password' | null>(null);

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

    router.push('/home');
    router.refresh();
  }

  const fieldStyle = (name: 'email' | 'password'): React.CSSProperties => ({
    width: '100%',
    padding: '13px 14px',
    border: `1.5px solid ${focused === name ? INK : '#e5e5e5'}`,
    borderRadius: '10px',
    fontSize: '14.5px',
    color: INK,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms, box-shadow 150ms',
    fontFamily: 'var(--font-ui)',
    background: '#fafafa',
    boxShadow: focused === name ? '0 0 0 4px rgba(26,26,26,0.06)' : 'none',
  });

  return (
    <div className="tl-login">
      <style>{`
        .tl-login {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(ellipse 1000px 800px at 18% 30%, ${SLATE} 0%, transparent 55%),
            radial-gradient(ellipse 700px 700px at 85% 80%, #2a2a2a 0%, transparent 55%),
            ${INK};
        }
        .tl-login-brand {
          flex: 1 1 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 48px;
        }
        .tl-login-form-side {
          flex: 1 1 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        @media (max-width: 860px) {
          .tl-login { flex-direction: column; }
          .tl-login-brand { flex: 0 0 auto; min-height: 240px; padding: 40px 24px 8px; }
          .tl-login-form-side { flex: 1 1 auto; padding: 24px 24px 48px; }
        }
      `}</style>

      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: `linear-gradient(135deg, transparent 45%, ${MUTED} 45%, ${MUTED} 46%, transparent 46%),
                           linear-gradient(45deg, transparent 45%, ${MUTED} 45%, ${MUTED} 46%, transparent 46%)`,
        backgroundSize: '120px 120px',
      }} />

      <div className="tl-login-brand">
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 420 }}>
          <Image
            src="/logo-creativity.png"
            alt="TLines Creativity Group"
            width={280}
            height={280}
            style={{ objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'brightness(0) invert(1)' }}
            priority
          />
          <p style={{ margin: '24px 0 0', fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, letterSpacing: '0.01em' }}>
            Production &amp; Delivery Platform
          </p>
        </div>
      </div>

      <div className="tl-login-form-side">
        <div style={{
          width: '100%', maxWidth: '380px', position: 'relative',
          background: '#ffffff', borderRadius: '20px', padding: '40px 36px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.2)',
        }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>
            Welcome back
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: '14px', color: MUTED }}>
            Sign in with your work email to continue
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: SLATE, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="you@trust-lines.com"
                style={fieldStyle('email')}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: SLATE, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                style={fieldStyle('password')}
              />
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '11px 13px',
                  fontSize: '13px',
                  color: '#b91c1c',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? SLATE : INK,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14.5px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'background 150ms, transform 100ms',
                letterSpacing: '0.01em',
              }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: MUTED }}>
            TLines Creativity Group © {new Date().getFullYear()} · Internal Platform
          </p>
        </div>
      </div>
    </div>
  );
}
