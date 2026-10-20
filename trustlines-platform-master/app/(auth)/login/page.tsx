'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggleButton } from '@/components/auth/ThemeToggleButton';

// Design: Figma "TRUST-LINES ERP" → "Desktop login" (1440x900) and "Mobile login" (390 wide),
// light + dark. Colours are the 2026 palette tokens (Figma "Basic UI Colors"). Assets: /public/login.
const FIELD =
  'flex h-12 items-center rounded-md border border-primary-200 bg-white transition-colors focus-within:border-secondary-700 focus-within:ring-1 focus-within:ring-secondary-700 dark:border-secondary-600 dark:bg-secondary-800 dark:focus-within:border-primary-50 dark:focus-within:ring-primary-50';
const ICON_SLOT = 'flex h-11 w-[45px] shrink-0 items-center justify-center text-[#787881] dark:text-primary-200';
const INPUT =
  'h-full min-w-0 flex-1 bg-transparent pr-3.5 text-base text-secondary-700 outline-none placeholder:text-primary-300 dark:text-primary-50 dark:placeholder:text-primary-400';
const LABEL = 'block text-base leading-[120%] text-primary-500 dark:text-primary-50';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      router.replace('/auth/set-password' + hash);
      return;
    }
    // A PKCE-style link (…/login?code=…) belongs on the set-password screen too.
    const search = window.location.search;
    if (new URLSearchParams(search).get('code')) {
      router.replace('/auth/set-password' + search);
      return;
    }
    // Supabase sends people here with the failure in the URL when a reset/invite link is
    // expired or was already opened (mail scanners often burn the one-time link first).
    const params = new URLSearchParams(hash.replace(/^#/, '') || search);
    if (params.get('error') || params.get('error_code')) {
      setError('That email link has expired or was already used. Use “Forgot password” to get a new one.');
      window.history.replaceState(null, '', window.location.pathname);
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
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-primary-100 font-ui lg:flex-row lg:bg-white dark:bg-primary-600 lg:dark:bg-secondary-800">
      <ThemeToggleButton />

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

      {/* Login panel */}
      <div className="relative flex flex-1 flex-col items-center px-6 pt-[22px] pb-6 lg:justify-center lg:pt-0 lg:pb-0 lg:pl-[10.28%] lg:pr-12">
        <div className="w-full max-w-[440px]">
          <section
            aria-labelledby="login-heading"
            className="rounded-[10px] bg-white px-5 pt-8 pb-7 shadow-[0_12px_40px_rgba(43,61,85,0.10)] lg:rounded-lg lg:px-10 lg:pt-[60px] lg:pb-10 dark:bg-secondary-800 dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
          >
            <div className="space-y-1">
              <h1 id="login-heading" className="self-stretch text-[32px] font-medium leading-[120%] text-primary-500 dark:text-primary-50">
                Welcome back
              </h1>
              <p className="self-stretch text-base text-primary-400 dark:text-primary-200">Sign in to your workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-[17px] space-y-5">
              {error && (
                <div role="alert" style={{ background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--status-danger-fg)' }}>
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className={LABEL}>Email</label>
                <div className={FIELD}>
                  <span className={ICON_SLOT} aria-hidden="true"><Mail className="h-4 w-4" strokeWidth={1.5} /></span>
                  <input id="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className={LABEL}>Password</label>
                <div className={FIELD}>
                  <span className={ICON_SLOT} aria-hidden="true"><Lock className="h-4 w-4" strokeWidth={1.5} /></span>
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className={INPUT} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center rounded-r-md text-secondary-700 hover:text-primary-500 dark:text-primary-200 dark:hover:text-primary-50"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a href="/auth/forgot-password" className="text-base text-secondary-700 underline underline-offset-4 hover:text-primary-500 dark:text-primary-50 dark:hover:text-primary-200">
                  Forgot password
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md bg-secondary-700 text-base font-medium text-white transition-colors hover:bg-secondary-700/90 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-primary-50 dark:text-secondary-800 dark:hover:bg-primary-50/90"
              >
                {loading ? 'Signing in…' : 'Sign-in'}
              </button>
            </form>

            <AccessNote className="mt-8 lg:hidden" />
          </section>

          <AccessNote className="mt-6 hidden lg:block" />
        </div>

        <footer className="mt-auto space-y-2 pt-12 text-center text-xs lg:hidden">
          <p className="text-primary-500 dark:text-primary-100">Privacy policy</p>
          <p className="text-primary-400 dark:text-primary-300">© {new Date().getFullYear()} TLines Creativity Group</p>
        </footer>
      </div>
    </main>
  );
}

function AccessNote({ className }: { className: string }) {
  return (
    <p className={`text-center text-sm text-primary-400 dark:text-primary-200 ${className}`}>
      Need access? <span className="font-medium text-primary-500 dark:text-primary-50">Contact your administrator</span>
    </p>
  );
}
