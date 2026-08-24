'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTabs } from '@/components/platform/shell/TabContext';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Target,
  ClipboardList,
  Palette,
  Contact,
  Megaphone,
  Factory,
  ClipboardCheck,
  Truck,
  Package,
  Receipt,
  Building2,
  Gauge,
  Users,
  Bell,
  BarChart3,
  ScrollText,
  ShieldCheck,
  Settings,
  ChevronRight,
  Search,
} from 'lucide-react';
import type { UserRole } from '@/types/database';
import { permCan } from '@/lib/permissions/catalog';

// ── Types ──────────────────────────────────────────────────────────────────
export interface ModuleBadge {
  value: string | number;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface ModuleDef {
  key: string;
  label: string;
  href: string;
  perm: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color: string;
  iconBg: string;
}

// ── Quick Access Items (Top 3 prominent cards) ─────────────────────────────
const QUICK_ACCESS_MODULES: ModuleDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    perm: 'page.dashboard',
    icon: LayoutDashboard,
    color: '#0891B2',
    iconBg: '#DDF1F6',
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    perm: 'page.projects',
    icon: FolderKanban,
    color: '#2563EB',
    iconBg: '#E2EBFC',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    perm: 'page.approvals',
    icon: CheckSquare,
    color: '#16A34A',
    iconBg: '#E7F6EC',
  },
];

// ── All Other Modules (Grid cards) ─────────────────────────────────────────
const MAIN_MODULES: ModuleDef[] = [
  { key: 'crm', label: 'CRM', href: '/leads', perm: 'page.leads', icon: Target, color: '#7C3AED', iconBg: '#ECE2FC' },
  { key: 'pm', label: 'PM', href: '/pm', perm: 'page.projects', icon: ClipboardList, color: '#0891B2', iconBg: '#DDF1F6' },
  { key: 'design', label: 'Design', href: '/design', perm: 'page.design', icon: Palette, color: '#7C3AED', iconBg: '#ECE2FC' },
  { key: 'customers', label: 'Customers', href: '/customers', perm: 'page.customers', icon: Contact, color: '#C7572B', iconBg: '#FBE6DC' },
  { key: 'marketing', label: 'Marketing', href: '/marketing/prospects', perm: 'page.marketing', icon: Megaphone, color: '#D97706', iconBg: '#FDF1DD' },
  { key: 'production', label: 'Production', href: '/production', perm: 'page.production', icon: Factory, color: '#2D7D7D', iconBg: '#DDECEC' },
  { key: 'qc', label: 'QC', href: '/qc', perm: 'page.qc', icon: ClipboardCheck, color: '#0891B2', iconBg: '#DDF1F6' },
  { key: 'logistics', label: 'Logistics', href: '/logistics', perm: 'page.logistics', icon: Truck, color: '#475569', iconBg: '#E5E9EE' },
  { key: 'suppliers', label: 'Suppliers', href: '/suppliers', perm: 'page.suppliers', icon: Package, color: '#C7572B', iconBg: '#FBE6DC' },
  { key: 'expenses', label: 'Expenses', href: '/expenses', perm: 'page.expenses', icon: Receipt, color: '#D97706', iconBg: '#FDF1DD' },
  { key: 'clients', label: 'Clients', href: '/clients', perm: 'page.clients', icon: Building2, color: '#2563EB', iconBg: '#E2EBFC' },
  { key: 'management', label: 'Management', href: '/management', perm: 'page.management', icon: Gauge, color: '#475569', iconBg: '#E5E9EE' },
  { key: 'team', label: 'Team', href: '/team', perm: 'page.team', icon: Users, color: '#2563EB', iconBg: '#E2EBFC' },
  { key: 'notifications', label: 'Notifications', href: '/notifications', perm: 'page.notifications', icon: Bell, color: '#D97706', iconBg: '#FDF1DD' },
  { key: 'reports', label: 'Reports', href: '/sales-dashboard', perm: 'page.sales_dashboard', icon: BarChart3, color: '#2D7D7D', iconBg: '#DDECEC' },
  { key: 'audit', label: 'Audit Log', href: '/audit', perm: 'page.audit', icon: ScrollText, color: '#475569', iconBg: '#E5E9EE' },
  { key: 'roles', label: 'Roles & Perms', href: '/roles', perm: 'page.roles', icon: ShieldCheck, color: '#7C3AED', iconBg: '#ECE2FC' },
  { key: 'settings', label: 'Settings', href: '/settings', perm: 'page.settings', icon: Settings, color: '#475569', iconBg: '#E5E9EE' },
];

const TONE_COLORS: Record<NonNullable<ModuleBadge['tone']>, string> = {
  success: '#16A34A',
  warning: '#D97706',
  danger:  '#DC2626',
  info:    '#2563EB',
  neutral: '#737373',
};

// ── Props ──────────────────────────────────────────────────────────────────
interface ModuleGridProps {
  userName: string;
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  badges?: Record<string, ModuleBadge>;
  searchQuery?: string;
}

// ── Quick Access Card Component ────────────────────────────────────────────
function QuickAccessCard({
  mod,
  badge,
  highlighted,
  onOpen,
}: {
  mod: ModuleDef;
  badge?: ModuleBadge;
  highlighted?: boolean;
  onOpen?: () => void;
}) {
  const Icon = mod.icon;
  const tone = badge?.tone ?? 'neutral';
  const accent = TONE_COLORS[tone];

  return (
    <Link
      href={mod.href}
      onClick={e => {
        if (onOpen) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex items-center justify-between gap-4 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        highlighted
          ? 'border-2 border-cyan-500/80 bg-white shadow-sm ring-4 ring-cyan-500/10'
          : 'border border-neutral-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-neutral-300'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Icon box */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ background: mod.iconBg, color: mod.color }}
        >
          <Icon size={22} strokeWidth={1.7} />
        </div>

        {/* Text info */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-neutral-900 truncate">
            {mod.label}
          </span>
          {badge && (
            <div
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold w-fit"
              style={{ background: `${accent}14`, color: accent }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              {badge.value}
            </div>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={18}
        className="text-neutral-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-700"
      />
    </Link>
  );
}

// ── Standard Module Horizontal Card Component ──────────────────────────────
function ModuleRowCard({
  mod,
  badge,
  onOpen,
}: {
  mod: ModuleDef;
  badge?: ModuleBadge;
  onOpen?: () => void;
}) {
  const Icon = mod.icon;
  const tone = badge?.tone ?? 'neutral';
  const accent = TONE_COLORS[tone];

  return (
    <Link
      href={mod.href}
      onClick={e => {
        if (onOpen) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon box */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
          style={{ background: mod.iconBg, color: mod.color }}
        >
          <Icon size={18} strokeWidth={1.7} />
        </div>

        {/* Label */}
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-neutral-900 truncate">
            {mod.label}
          </span>
          {badge && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: accent }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
              {badge.value}
            </div>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={15}
        className="text-neutral-300 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-600"
      />
    </Link>
  );
}

// ── Main ModuleGrid Component ──────────────────────────────────────────────
export function ModuleGrid({
  userName,
  userRole,
  userPerms,
  badges = {},
  searchQuery: externalSearchQuery,
}: ModuleGridProps) {
  const [internalSearch, setInternalSearch] = React.useState('');
  const [mounted, setMounted] = React.useState(false);
  const { openTab } = useTabs();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  function handleOpen(mod: ModuleDef) {
    if (openTab) {
      openTab({
        id: mod.key,
        key: mod.key,
        label: mod.label,
        href: mod.href,
        icon: mod.icon,
        color: mod.color,
        iconBg: mod.iconBg,
      });
    }
  }

  const search = (externalSearchQuery !== undefined ? externalSearchQuery : internalSearch).toLowerCase().trim();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName ? userName.split(' ')[0] : 'Frontend';

  // Filter modules user has permission to see
  const visibleQuick = QUICK_ACCESS_MODULES.filter(m => permCan(userPerms, m.perm));
  const visibleMain = MAIN_MODULES.filter(m => permCan(userPerms, m.perm));

  const totalVisibleCount = visibleQuick.length + visibleMain.length;

  // Apply search query filter
  const filteredQuick = search
    ? visibleQuick.filter(m => m.label.toLowerCase().includes(search))
    : visibleQuick;

  const filteredMain = search
    ? visibleMain.filter(m => m.label.toLowerCase().includes(search))
    : visibleMain;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-7">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 font-normal">
            {totalVisibleCount} modules available
          </p>
        </div>

        {mounted && (
          <time className="text-sm font-medium text-neutral-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
      </div>

      {/* ── Optional In-Page Search for Mobile / Small Screens ───── */}
      {externalSearchQuery === undefined && (
        <div className="sm:hidden relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={internalSearch}
            onChange={e => setInternalSearch(e.target.value)}
            placeholder="Search modules..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
        </div>
      )}

      {/* ── Section 1: Quick Access ─────────────────────────────── */}
      {filteredQuick.length > 0 && (
        <section aria-label="Quick access">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-3">
            Quick access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredQuick.map(mod => (
              <QuickAccessCard
                key={mod.key}
                mod={mod}
                badge={badges[mod.key]}
                highlighted={mod.key === 'dashboard'}
                onOpen={() => handleOpen(mod)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Section Separator ───────────────────────────────────── */}
      <hr className="border-t border-neutral-200/70 my-2" />

      {/* ── Section 2: All Modules ──────────────────────────────── */}
      {filteredMain.length > 0 && (
        <section aria-label="All modules">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-3">
            All modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {filteredMain.map(mod => (
              <ModuleRowCard
                key={mod.key}
                mod={mod}
                badge={badges[mod.key]}
                onOpen={() => handleOpen(mod)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty search state */}
      {filteredQuick.length === 0 && filteredMain.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200/80 p-8">
          <Search size={32} className="mx-auto text-neutral-300 mb-3" />
          <h3 className="text-sm font-semibold text-neutral-800">No modules found</h3>
          <p className="text-xs text-neutral-500 mt-1">
            No modules match &quot;{search}&quot;. Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
}