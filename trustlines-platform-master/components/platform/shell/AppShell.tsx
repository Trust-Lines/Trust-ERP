'use client';

import { AvatarDirectoryProvider } from '@/components/ui/avatar-directory';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ViewAsBanner, ViewAsProvider, type ViewAsState } from './ViewAs';
import { AI_STATE_EVENT, TrustLinesAI } from '@/components/platform/ai/TrustLinesAI';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database';


interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  userName: string;
  userEmail: string;
  logoSrc?: string;
  breadcrumbs?: { label: string; href?: string }[];
  notificationCount?: number;
  viewAs?: ViewAsState;
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
  viewAs,
}: AppShellProps) {
  const pathname = usePathname();
  const isHome = pathname === '/home' || pathname === '/';
  // While the docked Trust Lines AI panel (383px, under the top bar) is open, the main area
  // reserves that width so the page reflows beside it instead of being covered. Below lg the
  // panel simply overlays — there isn't room for both.
  const [aiOpen, setAiOpen] = React.useState(false);
  React.useEffect(() => {
    const onState = (e: Event) => setAiOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(AI_STATE_EVENT, onState);
    return () => window.removeEventListener(AI_STATE_EVENT, onState);
  }, []);

  return (
    // items-start (not the flex-row default of stretch): the sidebar is a fixed h-screen
    // column (sticky-pinned below), but the main column must NOT be stretched to match it —
    // that stretch was exactly what made a short page's content area fill the whole viewport
    // height, leaving a big empty band of its background under short lists (2026-09-23 fix).
    // No overflow-hidden/h-screen here either — the page now scrolls normally (the body), with
    // the sidebar and TopBar staying in view via `sticky`, not via clipping+internal scroll.
    // Same background as <main> so the space under a short page doesn't show as a white band.
    <ViewAsProvider value={viewAs ?? { canViewAs: false, viewAs: null }}>
    <AvatarDirectoryProvider>
    <ViewAsBanner />
    <div className="flex w-full items-start bg-[var(--bg-subtle)] text-neutral-900 dark:bg-ui-page-bg">
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
          userPerms={userPerms}
          userName={userName}
          userEmail={userEmail}
          notificationCount={notificationCount}
          logoSrc={logoSrc}
        />

        {/* Main Content Area — sized to its own content now, not forced to viewport height */}
        <main className={cn('min-w-0 bg-[var(--bg-subtle)] dark:bg-ui-page-bg transition-[margin] duration-200', aiOpen && 'lg:mr-[383px]')}>
          {/* Every page uses the full width of the screen (it used to stop at 1200px, centred). */}
          <div className="main-inner main-inner--full w-full" style={{ padding: '24px' }}>
            {children}
          </div>
        </main>
      </div>

      <TrustLinesAI />
    </div>
    </AvatarDirectoryProvider>
    </ViewAsProvider>
  );
}
