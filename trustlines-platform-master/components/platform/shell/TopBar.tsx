'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Bot } from 'lucide-react';
import type { UserRole } from '@/types/database';
import { AI_STATE_EVENT, OPEN_AI_EVENT } from '@/components/platform/ai/TrustLinesAI';
import { UserMenu } from './UserMenu';
import { PageSearch } from './PageSearch';
import { buildNavSections, roleLabel } from './Sidebar';

// Design: Figma "TRUST-LINES ERP" → "Shell (Task 11)" → "Global top bar" (101:12543), light + dark.
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  userRole?: UserRole;
  userPerms?: Record<string, boolean>;
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
  logoSrc?: string;
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'CRM Board',
  '/leads/new': 'New Opportunity',
  '/sales-dashboard': 'Sales Dashboard',
  '/sales-tasks': 'Sales Tasks',
  '/sales-projects': 'Sales Handoffs',
  '/marketing/prospects': 'Lead Cloud',
  '/marketing/potentials': 'Potentials',
  '/marketing/campaigns': 'Campaigns & Surveys',
  '/design': 'Design & Assets',
  '/pm': 'PM · Millwork & Ceiling',
  '/projects': 'Supply Projects',
  '/approvals': 'Approvals',
  '/customers': 'Customers Directory',
  '/clients': 'Corporate Clients',
  '/production': 'Production Board',
  '/qc': 'Quality Control',
  '/logistics': 'Logistics & Containers',
  '/suppliers': 'Suppliers & Vendors',
  '/expenses': 'Finance & Expenses',
  '/management': 'Operations Management',
  '/team': 'Team & Staff',
  '/roles': 'Roles & Permissions',
  '/audit': 'Audit & Security Log',
  '/settings': 'Settings & Preferences',
  '/notifications': 'Notifications',
  '/my-tasks': 'My Tasks',
};

export function TopBar({
  breadcrumbs = [],
  userRole,
  userPerms,
  userName = '',
  userEmail = '',
  notificationCount = 0,
}: TopBarProps) {
  const pathname = usePathname();
  const sections = React.useMemo(() => (userRole ? buildNavSections(userRole, userPerms) : []), [userRole, userPerms]);
  const [aiOpen, setAiOpen] = React.useState(false);
  React.useEffect(() => {
    const onState = (e: Event) => setAiOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(AI_STATE_EVENT, onState);
    return () => window.removeEventListener(AI_STATE_EVENT, onState);
  }, []);

  // Find matched page title if no custom breadcrumbs provided
  const currentTitle =
    ROUTE_TITLES[pathname] ||
    Object.entries(ROUTE_TITLES).find(([route]) => pathname.startsWith(`${route}/`))?.[1] ||
    'Workspace';

  return (
    <header data-shell="topbar" className="sticky top-0 z-30 flex h-20 select-none items-center justify-between gap-4 border-b border-primary-100 bg-white px-8 font-ui dark:border-primary-600 dark:bg-primary-950">
      {/* ── Left: page search, then current page title & breadcrumbs ── */}
      <div className="flex min-w-0 shrink items-center gap-6">
        <PageSearch sections={sections} />
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs leading-[1.4] text-primary-400 dark:text-primary-200">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && <span aria-hidden="true">/</span>}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="truncate hover:text-secondary-700 dark:hover:text-primary-50">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'truncate text-[13px] font-medium text-primary-500 dark:text-primary-100' : 'truncate'}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <h1 className="truncate text-[13px] font-medium leading-[1.4] text-primary-500 dark:text-primary-100">
            {currentTitle}
          </h1>
        )}
      </div>

      {/* ── Right: notifications & account ─────────────────────── */}
      <div className="flex shrink-0 items-center gap-5">
        <Link
          href="/notifications"
          className="relative grid h-[37px] w-[41px] place-items-center rounded-md text-secondary-700 transition-colors hover:text-primary-500 dark:text-primary-50 dark:hover:text-primary-200"
          title="Notifications"
          aria-label={notificationCount > 0 ? `Notifications (${notificationCount} unread)` : 'Notifications'}
        >
          <Bell className="h-[27px] w-[27px]" strokeWidth={1.5} />
          {notificationCount > 0 && (
            <span className="absolute top-0.5 left-[23px] flex h-3 min-w-3 items-center justify-center rounded-[3px] bg-accent-400 px-0.5 text-[11px] leading-none text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </Link>

        {/* Figma "Trust Lines AI panel" (334:13694): outlined while the panel is open. */}
        <button
          type="button"
          aria-pressed={aiOpen}
          onClick={() => window.dispatchEvent(new Event(OPEN_AI_EVENT))}
          className={
            aiOpen
              ? 'flex h-9 cursor-pointer items-center gap-2 rounded-md border border-secondary-700 bg-transparent px-3 text-[13px] font-semibold text-secondary-700 transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-700 dark:border-secondary-50 dark:text-secondary-50 dark:focus-visible:outline-primary-50'
              : 'flex h-9 cursor-pointer items-center gap-2 rounded-md border border-transparent bg-secondary-700 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-secondary-700/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-700 dark:bg-secondary-50 dark:text-primary-950 dark:hover:bg-secondary-50/90 dark:focus-visible:outline-primary-50'
          }
        >
          <Bot className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Trust Lines AI
        </button>

        <UserMenu userName={userName} userEmail={userEmail} roleDisplay={userRole ? roleLabel(userRole) : ''} variant="topbar" />
      </div>
    </header>
  );
}
