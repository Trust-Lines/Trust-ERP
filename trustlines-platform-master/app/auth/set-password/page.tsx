'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LoginShell } from '@/components/auth/LoginShell';
import { AuthAlert, AuthHeading, AuthStyles, LoginLogo } from '@/components/auth/AuthParts';

// Reached from the e-mail link of an invitation OR a password reset. Same look as the login screen.
type Step = 'loading' | 'form' | 'done' | 'error';
type Mode = 'invite' | 'recovery' | 'generic';

const MIN_LENGTH = 8;

function readLinkParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const get = (k: string) => hash.get(k) ?? query.get(k);
  const type = get('type');
  return {
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
    code: query.get('code'),
    errorDescription: get('error_description'),
    mode: (type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'generic') as Mode,
  };
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [mode, setMode] = useState<Mode>('generic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // React dev StrictMode runs effects twice; a one-time link/code must only be consumed once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = createClient();
    const link = readLinkParams();
    setMode(link.mode);
    let settled = false;

    const ready = (userEmail: string | undefined) => {
      if (settled) return;
      settled = true;
      setEmail(userEmail ?? '');
      setStep('form');
      // The tokens are single-use secrets — don't leave them sitting in the address bar.
      window.history.replaceState(null, '', window.location.pathname);
    };
    const fail = (text: string) => {
      if (settled) return;
      settled = true;
      setMessage(text);
      setStep('error');
    };

    if (link.errorDescription) {
      fail(link.errorDescription.replace(/\+/g, ' '));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && (link.accessToken || link.code)) ready(session.user.email);
    });

    if (link.accessToken && link.refreshToken) {
      supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
        .then(({ data, error }) => (error ? fail(error.message) : ready(data.session?.user?.email)));
    } else if (link.code) {
      supabase.auth.exchangeCodeForSession(link.code)
        .then(({ data, error }) => (error ? fail(error.message) : ready(data.session?.user?.email)));
    } else {
      // No link in the URL: only valid for someone who is already signed in.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) ready(data.session.user.email);
        else fail('This page needs the link from your e-mail.');
      });
    }

    const timeout = setTimeout(() => fail('This link could not be verified.'), 10000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (password.length < MIN_LENGTH) { setMessage(`Password must be at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }

    setSubmitting(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setMessage(error.message); setSubmitting(false); return; }

    setStep('done');
    setTimeout(() => { router.push('/home'); router.refresh(); }, 1600);
  }

  const mismatch = confirm.length > 0 && password !== confirm;
  const title = mode === 'invite' ? 'Welcome' : mode === 'recovery' ? 'Reset password' : 'New password';
  const subtitle = mode === 'invite'
    ? 'Choose a password to activate your account.'
    : 'Choose a new password for your account.';

  return (
    <LoginShell logo={<LoginLogo />}>
      <AuthStyles />

      {step === 'loading' && <AuthHeading title="One moment" subtitle="Verifying your link…" />}

      {step === 'error' && (
        <>
          <AuthHeading title="Link not valid" subtitle="This link has expired, was already used, or could not be verified." />
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 19 }}>
            {message && <AuthAlert>{message}</AuthAlert>}
            <a href="/auth/forgot-password" className="tl-auth-btn">Request a new link</a>
            <a href="/login" className="tl-auth-link" style={{ alignSelf: 'center' }}>Back to login</a>
          </div>
        </>
      )}

      {step === 'done' && <AuthHeading title="Password updated" subtitle="Taking you to the platform…" />}

      {step === 'form' && (
        <>
          <AuthHeading title={title} subtitle={subtitle} />
          {email && (
            <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.6px', color: '#6b6b6b', wordBreak: 'break-all' }}>
              {email}
            </p>
          )}
          <form onSubmit={handleSubmit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 19 }}>
            <label className="tl-login-field">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/login/lock.svg" alt="" width={22} height={22} />
              <input
                type={show ? 'text' : 'password'} autoComplete="new-password" required autoFocus
                aria-label="New password" placeholder={`New password (min ${MIN_LENGTH} characters)`}
                value={password} onChange={e => setPassword(e.target.value)}
              />
              <button type="button" className="tl-auth-toggle" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
            </label>
            <label className={`tl-login-field${mismatch ? ' tl-has-error' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/login/lock.svg" alt="" width={22} height={22} />
              <input
                type={show ? 'text' : 'password'} autoComplete="new-password" required
                aria-label="Confirm password" placeholder="Confirm password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
              />
            </label>
            {mismatch && <span style={{ marginTop: -11, fontSize: 12, color: '#b91c1c' }}>Passwords do not match.</span>}

            {message && <AuthAlert>{message}</AuthAlert>}

            <button type="submit" className="tl-auth-btn" style={{ marginTop: message ? 0 : 10 }} disabled={submitting || password.length < MIN_LENGTH || mismatch || !confirm}>
              {submitting ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </>
      )}
    </LoginShell>
  );
}
