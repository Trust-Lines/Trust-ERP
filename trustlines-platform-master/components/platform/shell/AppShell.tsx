'use client';

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

  return (
    <div className="app">
      <Sidebar userRole={userRole} userPerms={userPerms} userName={userName} userEmail={userEmail} logoSrc={logoSrc} />
      <TopBar
        breadcrumbs={breadcrumbs}
        userRole={userRole}
        userName={userName}
        notificationCount={notificationCount}
      />
      <main className="main">
        <div className={fullWidth ? 'main-inner main-inner--full' : 'main-inner'}>{children}</div>
      </main>
      <TrustLinesAI />
    </div>
  );
}
