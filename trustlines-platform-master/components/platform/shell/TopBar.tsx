'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bell, Search, ChevronDown, LogOut, Shield, X, Plus, Home, LayoutDashboard } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTabs, HOME_TAB_ID, type AppTab } from './TabContext';
import type { UserRole } from '@/types/database';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  userRole: UserRole;
  userName: string;
  notificationCount?: number;
  logoSrc?: string;
  isDashboard?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  ops_manager:             'Ops Manager',
  pm_millwork:             'PM · Millwork',
  pm_ceiling:              'PM · Ceiling',
  trustlines_pm:           'TL Project Manager',
  tlines_pm:               'T-Lines PM',
  qc_responsible:          'QC Responsible',
  logistics:               'Logistics',
  accounting:              'Accounting',
  production_manager:      'Production Manager',
  project_manager:         'Project Manager',
  general_manager:         'General Manager',
  accountant:              'Accountant',
  designer:                'Designer',
  sales_marketing_manager: 'Sales & Marketing Manager',
  sales_rep:               'Sales Rep',
  design_lead:             'Design Lead',
  shop_drawer:             'Shop Drawer',
  supply_manager:          'Supply Manager',
  supply_user:             'Supply User',
  production_user:         'Production User',
  warehouse_manager:       'Warehouse Manager',
  warehouse_user:          'Warehouse User',
  marketing_pr:            'Marketing & PR',
  marketing_manager:       'Marketing Manager',
};

export function TopBar({
  breadcrumbs = [],
  userRole,
  userName,
  notificationCount = 0,
  logoSrc,
  isDashboard = false,
}: TopBarProps) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = (userName || 'U')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleDisplay = ROLE_LABELS[userRole] || userRole.replace(/_/g, ' ');

  return (
    <header className="topbar h-13 px-4 flex items-center justify-between border-b border-neutral-200/70 bg-white/95 backdrop-blur-sm sticky top-0 z-30 gap-3">
      {/* ── Left Side: Brand Logo / Tagline ────────────────────── */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/home" className="flex items-center gap-2 text-decoration-none group">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt="Trust-Lines"
              width={120}
              height={30}
              className="max-h-7 w-auto object-contain"
              priority
              unoptimized
            />
          ) : (
            <span className="text-xs font-semibold text-neutral-900 tracking-tight group-hover:text-cyan-700 transition-colors">
              Design <span className="text-neutral-300 font-normal">|</span> Supply <span className="text-neutral-300 font-normal">|</span> Build
            </span>
          )}
        </Link>
      </div>

      {/* ── Center-Left: Integrated Workspace Tab Bar ─────────── */}
      <div className="flex-1 flex items-center min-w-0 overflow-x-auto scrollbar-none py-1">
        <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/60 max-w-full">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.id === HOME_TAB_ID ? Home : tab.icon || LayoutDashboard;
            const nextTab = tabs[idx + 1];
            const isNextActive = nextTab && nextTab.id === activeTabId;
            const showSeparator = !isActive && !isNextActive && idx !== tabs.length - 1;

            return (
              <React.Fragment key={tab.id}>
                <div
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => activateTab(tab.id)}
                  className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 shrink-0 select-none max-w-[160px] ${
                    isActive
                      ? 'bg-[#18191c] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                  }`}
                  title={tab.label}
                >
                  <span
                    className="shrink-0 flex items-center justify-center"
                    style={{ color: isActive ? (tab.color || '#38bdf8') : undefined }}
                  >
                    <Icon size={13} strokeWidth={1.8} />
                  </span>

                  <span className="truncate min-w-0">{tab.label}</span>

                  {!tab.pinned && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      title={`Close ${tab.label}`}
                      aria-label={`Close ${tab.label}`}
                      className={`flex items-center justify-center h-3.5 w-3.5 rounded text-neutral-400 hover:text-white hover:bg-white/20 transition-colors shrink-0 ml-0.5 ${
                        isActive ? 'opacity-80' : 'opacity-0 group-hover:opacity-70'
                      }`}
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {showSeparator && (
                  <span className="h-3 w-px bg-neutral-300 mx-0.5 shrink-0" aria-hidden="true" />
                )}
              </React.Fragment>
            );
          })}

          {/* '+' Button to activate launcher tab */}
          <button
            onClick={() => activateTab(HOME_TAB_ID)}
            title="Open Module Launcher"
            aria-label="Open Module Launcher"
            className="flex items-center justify-center h-6 w-6 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors shrink-0 ml-0.5"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Center-Right: Search modules input ────────────────── */}
      <div className="hidden lg:flex items-center max-w-[200px] xl:max-w-[240px] w-full shrink-0">
        <div className="relative w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search modules..."
            aria-label="Search modules"
            className="w-full pl-7 pr-3 py-1 text-xs bg-neutral-100/70 border border-neutral-200/70 rounded-lg text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
          />
        </div>
      </div>

      {/* ── Right Side: Notifications & User Profile ───────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70 transition-colors"
          title="Notifications"
        >
          <Bell size={17} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--brand-orange)] ring-2 ring-white" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200" />

        {/* User profile dropdown trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(prev => !prev)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-neutral-100/70 transition-colors text-left"
            aria-expanded={profileOpen}
            aria-label="User menu"
          >
            {/* Avatar */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F2A44] text-white text-[11px] font-bold shadow-xs">
              {initials}
            </div>

            {/* Name + Role */}
            <div className="hidden sm:flex flex-col min-w-0 pr-0.5">
              <span className="text-xs font-bold text-neutral-900 leading-none truncate max-w-[120px]">
                {userName || 'User'}
              </span>
              <span className="text-[10px] text-neutral-500 leading-tight truncate mt-0.5 max-w-[120px]">
                {roleDisplay}
              </span>
            </div>

            {/* Dropdown arrow */}
            <ChevronDown size={13} className="text-neutral-400 hidden sm:block shrink-0" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-white border border-neutral-200/90 p-1.5 shadow-lg z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                <p className="text-xs font-bold text-neutral-900 truncate">{userName}</p>
                <p className="text-[10px] text-neutral-500 truncate">{roleDisplay}</p>
              </div>

              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Shield size={14} className="text-neutral-400" />
                Settings &amp; Preferences
              </Link>

              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  onClick={() => {
                    try {
                      for (let i = localStorage.length - 1; i >= 0; i--) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('docgen_')) localStorage.removeItem(k);
                      }
                    } catch { }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                >
                  <LogOut size={14} className="text-red-500" />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
