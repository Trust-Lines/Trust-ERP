'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TrustLinesAI } from '@/components/platform/ai/TrustLinesAI';
import type { UserRole } from '@/types/database';

const FULL_WIDTH_ROUTES = ['/production', '/leads'];

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
  const fullWidth = FULL_WIDTH_ROUTES.some(r => pathname === r || pathname?.startsWith(`${r}/`));
  const isHome = pathname === '/home' || pathname === '/';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-neutral-900">
      {/* Collapsible Claude-style Sidebar */}
      <Sidebar
        userRole={userRole}
        userPerms={userPerms}
        userName={userName}
        userEmail={userEmail}
        logoSrc={logoSrc}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* TopBar with brand, breadcrumbs, search, and user menu */}
        <TopBar
          breadcrumbs={breadcrumbs}
          userRole={userRole}
          userName={userName}
          notificationCount={notificationCount}
          logoSrc={logoSrc}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 bg-[#F8FAFC]">
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
