'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [step, setStep]                 = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [userEmail, setUserEmail]       = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');

  useEffect(() => {
    let done = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (done) return;
        if (session?.user) {
          done = true;
          setUserEmail(session.user.email ?? '');
          setStep('form');
        }
      },
    );

    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (done) return;
        if (error) { setStep('error'); setErrorMsg(error.message); return; }
        if (data.session?.user) {
          done = true;
          setUserEmail(data.session.user.email ?? '');
          setStep('form');
        }
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (done) return;
      if (session?.user) {
        done = true;
        setUserEmail(session.user.email ?? '');
        setStep('form');
      }
    });

    const timeout = setTimeout(() => {
      if (!done) setStep('error');
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);  

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setSubmitting(false);
      return;
    }

    setStep('done');
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1800);
  }

  const card = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh',
      background: 'var(--brand-navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: 'var(--brand-teal)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M10 2V18M2 7L18 13M18 7L2 13" stroke="white" strokeWidth="1.5" opacity="0.5"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 700, color: 'white' }}>
              Trust-Lines
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6 }}>
            Production &amp; Delivery Platform
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: 10, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          {children}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Trust-Lines © {new Date().getFullYear()} · Internal Platform
        </p>
      </div>
    </div>
  );

  if (step === 'loading') return card(
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
      <p style={{ fontSize: 14, color: 'var(--fg-subtle)' }}>Verifying your invitation…</p>
    </div>
  );

  if (step === 'error') return card(
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Link expired or invalid</h2>
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 20 }}>
        {errorMsg || 'This invitation link has expired. Ask your admin to resend it.'}
      </p>
      <a href="/login" className="btn btn-primary" style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>
        Go to login
      </a>
    </div>
  );

  if (step === 'done') return card(
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Password set!</h2>
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
        Redirecting to your dashboard…
      </p>
    </div>
  );

  return card(
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>
        Welcome to Trust-Lines
      </h1>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--fg-subtle)' }}>
        You're joining as <strong>{userEmail}</strong>
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--fg-muted)' }}>
        Set a password to activate your account.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>
            New password
          </label>
          <input
            type="password"
            required
            autoFocus
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', boxSizing: 'border-box',
              border: '1px solid var(--border-default)', borderRadius: 6,
              fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
            onFocus={e  => (e.target.style.borderColor = 'var(--brand-teal)')}
            onBlur={e   => (e.target.style.borderColor = 'var(--border-default)')}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>
            Confirm password
          </label>
          <input
            type="password"
            required
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', boxSizing: 'border-box',
              border: `1px solid ${confirmPassword && password !== confirmPassword ? 'var(--status-danger)' : 'var(--border-default)'}`,
              borderRadius: 6, fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--brand-teal)')}
            onBlur={e  => (e.target.style.borderColor =
              confirmPassword && password !== confirmPassword ? 'var(--status-danger)' : 'var(--border-default)')}
          />
          {confirmPassword && password !== confirmPassword && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--status-danger)' }}>
              Passwords do not match
            </p>
          )}
        </div>

        {errorMsg && (
          <div style={{
            background: 'var(--status-danger-bg)', border: '1px solid #fca5a5',
            borderRadius: 6, padding: '10px 12px', fontSize: 13,
            color: 'var(--status-danger-fg)', marginBottom: 16,
          }}>
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || password !== confirmPassword || password.length < 8}
          style={{
            width: '100%', padding: 10,
            background: submitting ? 'var(--brand-teal-600)' : 'var(--brand-teal)',
            color: 'white', border: 'none', borderRadius: 6,
            fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-ui)', transition: 'background 120ms',
            opacity: (password.length < 8 || password !== confirmPassword) && !submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Setting password…' : 'Set password & enter platform'}
        </button>
      </form>
    </>
  );
}
