'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ThemeToggleButton } from '@/components/auth/ThemeToggleButton';

// Branch-selection screen shared by /tlines-login and /trustlines-login.
// Design: Figma "TRUST-LINES-ERP" → "Desktop login · Light" (123-24859), dark backdrop 136-380, "Mobile login".
// Same layout as /login. Assets live in /public/login.
export type Branch = { name: string; Art: () => React.ReactNode; href: string };

export function BranchSelectLogin({ logo, branches }: { logo: React.ReactNode; branches: Branch[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-primary-100 font-ui lg:flex-row lg:bg-white dark:bg-primary-600 lg:dark:bg-secondary-800">
      <style>{`
        .tl-branch { display: block; width: 100%; container-type: inline-size; border-radius: 11px; cursor: pointer; transition: transform 150ms, box-shadow 150ms, opacity 150ms; }
        .tl-branch:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
        .tl-branch:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 3px; }
        .dark .tl-branch:focus-visible { outline-color: var(--color-primary-50); }
      `}</style>

      {/* Dark-mode glow behind the logo (Figma 123-24546 page fill: radial gradient at 20%) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden opacity-20 dark:block"
        style={{ background: 'radial-gradient(53.3% 136.4% at 22.53% 53.61%, #1f252d 0%, #353e4a 15.2%, #4c5767 30.4%, #626f84 45.6%, #7888a1 60.8%)' }}
      />

      {/* Decorative backdrop (Group 366/367, 876 x 900 at the 1440 x 900 reference size) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60.83%] lg:block">
        <Image src="/login/backdrop.svg" alt="" fill priority className="object-cover object-left dark:hidden" />
        <Image src="/login/backdrop-dark.svg" alt="" fill priority className="hidden object-cover object-left dark:block" />
      </div>

      <ThemeToggleButton />

      {/* Brand column */}
      <div className="relative flex justify-center pt-[45px] lg:w-[39.17%] lg:items-center lg:justify-end lg:py-12 lg:pl-6 lg:pr-[8.13%]">
        {logo}
      </div>

      {/* Branch panel */}
      <div className="relative flex flex-1 flex-col items-center px-5 pt-[33px] pb-6 lg:justify-center lg:py-0 lg:pl-[10.28%] lg:pr-12">
        <section
          aria-labelledby="branch-heading"
          className="flex w-full max-w-[440px] flex-col gap-[26px] rounded-[10px] border border-primary-100 bg-white px-[21px] py-[26px] shadow-[0_16px_48px_rgba(10,12,15,0.07)] lg:gap-8 lg:rounded-xl lg:px-[39px] lg:pt-[60px] lg:pb-10 dark:border-primary-600 dark:bg-secondary-800 dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        >
          <div className="space-y-1 px-3 lg:space-y-2 lg:px-0">
            <h1 id="branch-heading" className="text-[28px] font-medium leading-[120%] text-primary-500 lg:text-[32px] dark:text-primary-50">
              Trust Lines CG
            </h1>
            <p className="text-sm text-primary-400 dark:text-primary-200">Select a branch to continue</p>
          </div>

          <div role="group" aria-label="Select branch" className="flex flex-col gap-[15px] lg:-mx-[15.5px]">
            {branches.map((b, i) => (
              <button
                key={i}
                type="button"
                className={`tl-branch ${selected !== null && selected !== i ? 'opacity-30' : ''}`}
                aria-label={b.name}
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
              >
                <b.Art />
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={selected === null}
            onClick={() => selected !== null && router.push(branches[selected].href)}
            className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-secondary-700 text-[15px] font-semibold text-white transition-colors hover:bg-secondary-700/90 disabled:cursor-not-allowed disabled:bg-primary-50 disabled:text-primary-300 lg:h-12 dark:bg-primary-50 dark:text-secondary-800 dark:hover:bg-primary-50/90 dark:disabled:bg-primary-700 dark:disabled:text-primary-400"
          >
            Continue
          </button>
        </section>

        <footer className="mt-auto space-y-2 pt-12 text-center text-xs lg:hidden">
          <p className="text-primary-500 dark:text-primary-100">Privacy policy</p>
          <p className="text-primary-400 dark:text-primary-300">© {new Date().getFullYear()} TLines Creativity Group</p>
        </footer>
      </div>
    </main>
  );
}
