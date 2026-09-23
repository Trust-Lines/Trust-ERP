'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TrustLinesAI } from '@/components/platform/ai/TrustLinesAI';
import type { UserRole } from '@/types/database';

const FULL_WIDTH_ROUTES = ['/production', '/leads', '/sales-tasks', '/sales-projects', '/sales-dashboard', '/marketing/prospects', '/marketing/opportunities', '/marketing/campaigns', '/dashboard'];

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  userName: string;
  userEmail: string;
  logoSrc?: string;
  breadcrumbs?: { label: string; href?: string }[];
  notificationCount?: number;
}

export function AppShell({
  children,
  userRole,
  userPerms,
  userName,
  userEmail,
  logoSrc,
  breadcrumbs,
  notificationCount,
}: AppShellProps) {
  const pathname = usePathname();
  // '/marketing' (Marketing Home) is exact-only — it must NOT widen every /marketing/*
  // sub-route via the prefix match below (Campaigns, prospect detail, etc. aren't designed
  // for full width; only Contacts/Potentials and Home itself are).
  const fullWidth = pathname === '/marketing' || FULL_WIDTH_ROUTES.some(r => pathname === r || pathname?.startsWith(`${r}/`));
  const isHome = pathname === '/home' || pathname === '/';

  return (
    // items-start (not the flex-row default of stretch): the sidebar is a fixed h-screen
    // column (sticky-pinned below), but the main column must NOT be stretched to match it —
    // that stretch was exactly what made a short page's content area fill the whole viewport
    // height, leaving a big empty band of its background under short lists (2026-09-23 fix).
    // No overflow-hidden/h-screen here either — the page now scrolls normally (the body), with
    // the sidebar and TopBar staying in view via `sticky`, not via clipping+internal scroll.
    <div className="flex w-full items-start bg-white text-neutral-900">
      {/* Collapsible Claude-style Sidebar */}
      <Sidebar
        userRole={userRole}
        userPerms={userPerms}
        userName={userName}
        userEmail={userEmail}
        logoSrc={logoSrc}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* TopBar with brand, breadcrumbs, search, and user menu */}
        <TopBar
          breadcrumbs={breadcrumbs}
          userRole={userRole}
          userName={userName}
          notificationCount={notificationCount}
          logoSrc={logoSrc}
        />

        {/* Main Content Area — sized to its own content now, not forced to viewport height */}
        <main className="bg-[#F8FAFC]">
          <div
            className={fullWidth ? 'main-inner main-inner--full p-4 sm:p-6' : 'main-inner w-full'}
            style={{
              maxWidth: fullWidth ? '100%' : 1200,
              margin: '0 auto',
              padding: '24px',
            }}
          >
            {children}
          </div>
        </main>
      </div>

      <TrustLinesAI />
    </div>
  );
}
