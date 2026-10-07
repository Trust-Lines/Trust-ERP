'use client';

import { useState } from 'react';
import { LoginShell } from '@/components/auth/LoginShell';
import { AuthAlert, AuthHeading, AuthStyles, LoginLogo } from '@/components/auth/AuthParts';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) { setError('Too many requests — please wait a few minutes and try again.'); return; }
      if (!res.ok) { setError('Something went wrong. Please try again.'); return; }
      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginShell logo={<LoginLogo />}>
      <AuthStyles />
      {sent ? (
        <>
          <AuthHeading title="Check your email" subtitle="If an account exists for that address, we sent a link to reset your password." />
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 19 }}>
            <AuthAlert tone="success">The link works once and expires soon. Open it on this device if you can.</AuthAlert>
            <a href="/login" className="tl-auth-btn">Back to login</a>
          </div>
        </>
      ) : (
        <>
          <AuthHeading title="Forgot password" subtitle="Enter your email and we'll send you a link to choose a new password." />
          <form onSubmit={handleSubmit} style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 19 }}>
            <label className="tl-login-field">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/login/mail.svg" alt="" width={22} height={22} />
              <input type="email" autoComplete="email" required autoFocus aria-label="Email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>

            {error && <AuthAlert>{error}</AuthAlert>}

            <button type="submit" className="tl-auth-btn" style={{ marginTop: error ? 0 : 10 }} disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <a href="/login" className="tl-auth-link" style={{ alignSelf: 'center' }}>Back to login</a>
          </form>
        </>
      )}
    </LoginShell>
  );
}
