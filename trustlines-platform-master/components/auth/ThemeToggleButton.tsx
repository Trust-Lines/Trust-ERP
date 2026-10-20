'use client';

import { Moon, Sun } from 'lucide-react';
import { writeThemePreference } from '@/lib/theme/theme';

// Light / dark switch pinned to the top-right corner of the auth screens.
// Icons swap via the `dark` class, so server and client render the same markup.
export function ThemeToggleButton() {
  return (
    <button
      type="button"
      onClick={() => writeThemePreference(document.documentElement.classList.contains('dark') ? 'light' : 'dark')}
      aria-label="Toggle light / dark mode"
      title="Toggle light / dark mode"
      className="fixed top-4 right-4 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-primary-100 bg-white/80 text-primary-500 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 lg:top-6 lg:right-6 dark:border-primary-600 dark:bg-secondary-800/80 dark:text-primary-50 dark:hover:bg-secondary-800 dark:focus-visible:outline-primary-50"
    >
      <Moon className="h-5 w-5 dark:hidden" strokeWidth={1.5} aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
