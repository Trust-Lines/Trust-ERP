'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

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

    router.push('/home');
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--brand-navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Image
            src="/logo.png"
            alt="Trust-Lines"
            width={200}
            height={56}
            style={{ objectFit: 'contain', display: 'block', margin: '0 auto 10px' }}
            priority
          />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
            Production &amp; Delivery Platform
          </p>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '10px',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: 'var(--fs-h3)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--fg-default)',
            }}
          >
            Sign in
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--fg-subtle)' }}>
            Enter your work email and password to continue.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  marginBottom: '6px',
                }}
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
                placeholder="you@trust-lines.com"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'var(--fg-default)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms',
                  fontFamily: 'var(--font-ui)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--brand-teal)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  marginBottom: '6px',
                }}
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
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'var(--fg-default)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms',
                  fontFamily: 'var(--font-ui)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--brand-teal)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--status-danger-bg)',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--status-danger-fg)',
                  marginBottom: '16px',
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
                padding: '10px',
                background: loading ? 'var(--brand-teal-600)' : 'var(--brand-teal)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'background 120ms',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          Trust-Lines © {new Date().getFullYear()} · Internal Platform
        </p>
      </div>
    </div>
  );
}
