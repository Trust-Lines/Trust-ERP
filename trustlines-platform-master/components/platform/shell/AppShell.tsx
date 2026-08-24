'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { TabProvider } from './TabContext';
import { TabShell } from './TabShell';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TrustLinesAI } from '@/components/platform/ai/TrustLinesAI';
import { Home } from 'lucide-react';
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
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.self !== window.top) {
        setIsEmbedded(true);
      }
    } catch {
      setIsEmbedded(true);
    }
  }, []);

  const fullWidth = FULL_WIDTH_ROUTES.some(r => pathname === r || pathname?.startsWith(`${r}/`));

  // If inside an embedded iframe tab, render ONLY the page content without outer shell headers
  if (isEmbedded) {
    return (
      <div className="w-full h-full overflow-y-auto bg-neutral-50/50 text-neutral-900">
        <div className={fullWidth ? 'main-inner main-inner--full p-4 sm:p-6' : 'main-inner w-full max-w-7xl mx-auto p-4 sm:p-6'}>
          {children}
        </div>
      </div>
    );
  }

  const isHome = pathname === '/home' || pathname === '/';

  return (
    <TabProvider
      homeTab={{
        key: 'home',
        label: 'Home',
        href: '/home',
        icon: Home,
        color: '#38bdf8',
        iconBg: '#082f49',
      }}
    >
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <SidebarInset className="flex flex-1 flex-col overflow-hidden min-w-0">
            {/* Single top-level TopBar hosting the integrated tabs */}
            <TopBar
              breadcrumbs={breadcrumbs}
              userRole={userRole}
              userName={userName}
              notificationCount={notificationCount}
              logoSrc={logoSrc}
              isDashboard={isHome}
            />
            {/* Multi-Tab Workspace Shell */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <TabShell>
                <div
                  className={fullWidth ? 'main-inner main-inner--full' : 'main-inner w-full'}
                  style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}
                >
                  {children}
                </div>
              </TabShell>
            </div>
          </SidebarInset>
          <TrustLinesAI />
        </div>
      </SidebarProvider>
    </TabProvider>
  );
}
