'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CircleCheck, CircleX, LoaderCircle, Mail } from 'lucide-react';
import { ThemeToggleButton } from '@/components/auth/ThemeToggleButton';

// Design: Figma "TRUST-LINES ERP" → "Forgot password (Task 15)" (123-22117): desktop 1440x900 and
// mobile 390, light + dark, states default / filled / loading / error / success. Same layout as /login.
const FIELD =
  'flex h-12 items-center gap-2.5 rounded-md border border-primary-200 px-3.5 transition-colors focus-within:border-secondary-700 focus-within:ring-1 focus-within:ring-secondary-700 dark:border-secondary-500 dark:focus-within:border-primary-50 dark:focus-within:ring-primary-50';
const LINK = 'text-[13px] font-medium leading-[normal] text-secondary-700 underline underline-offset-2 hover:text-primary-500 dark:text-secondary-50 dark:hover:text-primary-200';
const PRIMARY_BTN =
  'flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md bg-secondary-700 text-[15px] font-semibold text-white transition-colors hover:bg-secondary-700/90 disabled:cursor-not-allowed disabled:bg-primary-50 disabled:text-primary-300 dark:bg-primary-50 dark:text-secondary-800 dark:hover:bg-primary-50/90 dark:disabled:bg-primary-700 dark:disabled:text-primary-400';

type Notice = { tone: 'success' | 'error'; title: string; body: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  async function sendLink() {
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
      setSentTo(email.trim());
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendLink();
  }

  const spinner = <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Sending link…</>;

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-primary-100 font-ui lg:flex-row lg:bg-white dark:bg-primary-600 lg:dark:bg-secondary-800">
      <ThemeToggleButton />

      {/* Dark-mode glow behind the logo (Figma page fill: radial gradient at 20%) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden opacity-20 lg:dark:block"
        style={{ background: 'radial-gradient(53.3% 136.4% at 22.53% 53.61%, #1f252d 0%, #353e4a 15.2%, #4c5767 30.4%, #626f84 45.6%, #7888a1 60.8%)' }}
      />

      {/* Decorative backdrop (876 x 900 at the 1440 x 900 reference size) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60.83%] lg:block">
        <Image src="/login/backdrop.svg" alt="" fill priority className="object-cover object-left dark:hidden" />
        <Image src="/login/backdrop-dark.svg" alt="" fill priority className="hidden object-cover object-left dark:block" />
      </div>

      {/* Brand: mobile header with chevron band; plain logo column on desktop */}
      <div className="relative flex flex-col items-center bg-white pt-[68px] lg:w-[39.17%] lg:flex-row lg:justify-end lg:bg-transparent lg:py-12 lg:pl-6 lg:pr-[10.875%] dark:bg-secondary-800 lg:dark:bg-transparent">
        <Image src="/login/t-holding-logo.svg" alt="T Holding" width={253} height={105} priority className="relative h-auto w-[192px] lg:w-[253px] dark:hidden" />
        <Image src="/login/t-holding-logo-dark.svg" alt="T Holding" width={253} height={105} priority className="relative hidden h-auto w-[192px] lg:w-[253px] dark:block" />
        <svg
          aria-hidden="true"
          viewBox="0 0 390 90"
          preserveAspectRatio="none"
          className="-mt-[7px] block h-[90px] w-full fill-primary-100 lg:hidden dark:fill-primary-600"
        >
          <path d="M390 21.0384L202.869 64.794C198.365 66.0331 195.247 65.7172 189.941 63.6103L0 0L0 7.76029L186.251 69.9041C193.306 72.7057 198.658 73.3243 205.522 71.4355L390 28.7603Z" />
          <path d="M0 23.76L186.251 85.9041C193.306 88.7057 198.658 89.3243 205.522 87.4355L390 44.7603L390 90L0 90Z" />
        </svg>
      </div>

      {/* Recovery panel */}
      <div className="relative flex flex-1 flex-col items-center px-6 pt-[51px] pb-6 lg:justify-center lg:pt-0 lg:pb-0 lg:pl-[10.28%] lg:pr-12">
        <div className="w-full max-w-[440px] lg:mt-[53px]">
          <section
            aria-labelledby="recovery-heading"
            className="rounded-xl bg-white px-5 py-[30px] shadow-[0_16px_48px_rgba(10,12,15,0.07)] lg:px-10 lg:pt-[60px] lg:pb-10 dark:bg-secondary-800 dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
          >
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <h1 id="recovery-heading" className="text-[32px] font-medium leading-[120%] text-secondary-700 lg:text-primary-500 dark:text-primary-50">
                  {sentTo ? 'Check your email' : 'Forgot password?'}
                </h1>
                <p className="text-sm leading-normal text-primary-400 dark:text-primary-200">
                  {sentTo
                    ? `If an account exists for ${sentTo}, we’ll send a password-reset link.`
                    : 'Enter your email and we’ll help you reset your password.'}
                </p>
              </div>

              {sentTo ? (
                <>
                  <StatusMessage notice={{ tone: 'success', title: 'Request received', body: 'Check your inbox and spam folder. If you don’t receive an email, check the address and try again.' }} />
                  {error && <StatusMessage notice={{ tone: 'error', title: 'We couldn’t send the link', body: error }} />}
                  <button type="button" onClick={() => void sendLink()} disabled={loading} aria-busy={loading} className={PRIMARY_BTN}>
                    {loading ? spinner : 'Send link again'}
                  </button>
                  <button type="button" onClick={() => { setSentTo(''); setError(''); }} className={`${LINK} cursor-pointer text-center`}>
                    Use a different email
                  </button>
                </>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium leading-[normal] text-primary-500 dark:text-primary-100">Email</label>
                    <div className={`${FIELD} ${loading ? 'bg-primary-50 dark:bg-primary-700' : 'bg-white dark:bg-secondary-800'}`}>
                      <Mail className="h-3.5 w-3.5 shrink-0 text-primary-400 dark:text-primary-200" strokeWidth={1.75} aria-hidden="true" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        autoFocus
                        readOnly={loading}
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-secondary-700 outline-none placeholder:text-primary-300 dark:text-primary-50 dark:placeholder:text-primary-400"
                      />
                    </div>
                  </div>

                  {error && <StatusMessage notice={{ tone: 'error', title: 'We couldn’t send the link', body: error }} />}

                  <button type="submit" disabled={loading || !email.trim()} aria-busy={loading} className={PRIMARY_BTN}>
                    {loading ? spinner : 'Send link'}
                  </button>
                </form>
              )}

              <div className="flex justify-center">
                <a href="/login" className={LINK}>Back to login</a>
              </div>
            </div>

            <AccessNote className="mt-6 pt-2 lg:hidden" />
          </section>

          <AccessNote className="mt-6 hidden lg:block" />
        </div>

        <footer className="mt-auto space-y-2.5 pt-12 text-center lg:hidden">
          <p className="text-xs text-primary-500 dark:text-primary-100">Privacy policy</p>
          <p className="text-[11px] text-primary-400 dark:text-primary-300">© {new Date().getFullYear()} TLines Creativity Group</p>
        </footer>
      </div>
    </main>
  );
}

function StatusMessage({ notice }: { notice: Notice }) {
  const Icon = notice.tone === 'success' ? CircleCheck : CircleX;
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className="space-y-2 rounded-md p-3 text-[13px]"
      style={{
        background: notice.tone === 'success' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
        color: notice.tone === 'success' ? 'var(--status-success-fg)' : 'var(--status-danger-fg)',
      }}
    >
      <p className="flex items-center gap-2 font-medium leading-[1.45]">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {notice.title}
      </p>
      <p className="leading-normal">{notice.body}</p>
    </div>
  );
}

function AccessNote({ className }: { className: string }) {
  return (
    <p className={`text-center text-xs leading-[normal] ${className}`}>
      <span className="text-primary-400 dark:text-primary-200">Need access?</span>{' '}
      <span className="font-medium text-primary-500 dark:text-primary-100">Contact your administrator</span>
    </p>
  );
}
