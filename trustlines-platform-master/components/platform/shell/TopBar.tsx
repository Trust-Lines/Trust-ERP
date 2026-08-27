'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  userRole?: UserRole;
  userName?: string;
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
};

export function TopBar({
  breadcrumbs = [],
  notificationCount = 0,
}: TopBarProps) {
  const pathname = usePathname();

  // Find matched page title if no custom breadcrumbs provided
  const currentTitle =
    ROUTE_TITLES[pathname] ||
    Object.entries(ROUTE_TITLES).find(([route]) => pathname.startsWith(`${route}/`))?.[1] ||
    'Workspace';

  return (
    <header className="topbar h-12 px-5 flex items-center justify-between border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30 gap-4 select-none">
      {/* ── Left Side: Current Page Title & Breadcrumbs ───────── */}
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && <ChevronRight size={12} className="text-neutral-400" />}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-neutral-900 transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'font-bold text-neutral-900 text-sm' : ''}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-neutral-900 tracking-tight">
              {currentTitle}
            </h1>
          </div>
        )}
      </div>

      {/* ── Right Side: Notifications Bell ─────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/80 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </Link>
      </div>
    </header>
  );
}
