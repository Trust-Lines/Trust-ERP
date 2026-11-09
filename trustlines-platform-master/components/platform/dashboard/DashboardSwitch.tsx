import Link from 'next/link';
import { cn } from '@/lib/utils';

// The General Manager sees both companies' dashboards on /dashboard — this switches between them.
export function DashboardSwitch({ view }: { view: 'tlines' | 'trust' }) {
  const tabs: [string, 'tlines' | 'trust', string][] = [['T-Lines', 'tlines', '/tlines-pm'], ['Trust Lines', 'trust', '/tlines-pm?view=trust']];
  return (
    <nav aria-label="Dashboard" className="mb-5 flex w-fit gap-1 rounded-[8px] bg-ui-surface p-1">
      {tabs.map(([label, key, href]) => (
        <Link
          key={key} href={href} aria-current={view === key ? 'page' : undefined}
          className={cn(
            'inline-flex h-9 items-center rounded-[6px] px-5 text-[13px] font-semibold no-underline transition-colors',
            view === key ? 'bg-ui-surface-elevated text-[var(--color-secondary-700)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:text-ui-heading' : 'text-ui-body hover:bg-ui-hover-bg',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
