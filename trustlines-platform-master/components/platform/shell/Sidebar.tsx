'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  Home,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Factory,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  MonitorPlay,
  Truck,
  Building2,
  Contact,
  Palette,
  Users,
  ScrollText,
  Settings,
  Bell,
  FolderSearch,
  Trash2,
  ShieldCheck,
  Target,
  FilePlus,
  BarChart3,
  ListChecks,
  Package,
  Receipt,
  Megaphone,
  Inbox,
  QrCode,
  LogOut,
  Shield,
} from 'lucide-react';
import type { UserRole } from '@/types/database';
import { permCan } from '@/lib/permissions/catalog';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  perm: string;
  exact?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  ops_manager: 'Ops Manager',
  pm_millwork: 'PM · Millwork',
  pm_ceiling: 'PM · Ceiling',
  trustlines_pm: 'TL Project Manager',
  tlines_pm: 'T-Lines PM',
  qc_responsible: 'QC Responsible',
  logistics: 'Logistics',
  accounting: 'Accounting',
  production_manager: 'Production Manager',
  project_manager: 'Project Manager',
  general_manager: 'General Manager',
  accountant: 'Accountant',
  designer: 'Designer',
  sales_marketing_manager: 'Sales & Marketing Manager',
  sales_rep: 'Sales Rep',
  design_lead: 'Design Lead',
  shop_drawer: 'Shop Drawer',
  supply_manager: 'Supply Manager',
  supply_user: 'Supply User',
  production_user: 'Production User',
  warehouse_manager: 'Warehouse Manager',
  warehouse_user: 'Warehouse User',
  marketing_pr: 'Marketing & PR',
  marketing_manager: 'Marketing Manager',
};

const DASHBOARD_ITEM: NavItem = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, perm: 'page.dashboard' };
const CUSTOMERS_ITEM: NavItem = { label: 'Customers', href: '/customers', icon: Contact, perm: 'page.customers' };
const DESIGN_ITEM: NavItem = { label: 'Design', href: '/design', icon: Palette, perm: 'page.design' };

// "Supply" used to BE this alias for the full /projects table (its only real content was a
// generic list) — Roadmap Month 2 tasks 15/16 built a real Supply Workspace at /supply
// (item-plan/list/PO/PF status, "waiting on me" for pm_millwork/pm_ceiling). Renamed this entry
// to "All Projects" rather than deleting it — it's still the only place to browse/search every
// project, which the new focused workspace deliberately doesn't replace.
const PROJECTS_NAV: NavItem[] = [
  { label: 'PM',            href: '/pm',        icon: ClipboardList, perm: 'page.projects' },
  { label: 'Supply',        href: '/supply',    icon: FolderKanban,  perm: 'page.projects' },
  { label: 'All Projects',  href: '/projects',  icon: FolderSearch,  perm: 'page.projects' },
  { label: 'Approvals',     href: '/approvals', icon: CheckSquare,   perm: 'page.approvals' },
];

const OPERATIONS_NAV: NavItem[] = [
  { label: 'Clients',    href: '/clients',    icon: Building2,        perm: 'page.clients' },
  { label: 'Production', href: '/production', icon: Factory,          perm: 'page.production' },
  { label: 'QC',         href: '/qc',         icon: ClipboardCheck,   perm: 'page.qc' },
  { label: 'Logistics',  href: '/logistics',  icon: Truck,            perm: 'page.logistics' },
  { label: 'Suppliers',  href: '/suppliers',  icon: Package,          perm: 'page.suppliers' },
  { label: 'Expenses',   href: '/expenses',   icon: Receipt,          perm: 'page.expenses' },
  { label: 'Management', href: '/management', icon: Gauge,            perm: 'page.management' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Team',                href: '/team',           icon: Users,        perm: 'page.team' },
  { label: 'Roles & Permissions', href: '/roles',          icon: ShieldCheck,  perm: 'page.roles' },
  { label: 'Trash',               href: '/projects/trash', icon: Trash2,       perm: 'page.trash' },
  { label: 'Dropbox Wizard',      href: '/dropbox-wizard', icon: FolderSearch, perm: 'page.dropbox_wizard' },
  { label: 'Audit Log',           href: '/audit',          icon: ScrollText,   perm: 'page.audit' },
  { label: 'Settings',            href: '/settings',       icon: Settings,     perm: 'page.settings' },
];

const CRM_BOARD_NAV: NavItem[] = [
  { label: 'CRM Board', href: '/leads', icon: Target, perm: 'page.leads', exact: true },
];
const SALES_NAV: NavItem[] = [
  { label: 'Quick Deal (Sales)', href: '/leads/new',      icon: FilePlus,   perm: 'page.leads' },
  { label: 'Tasks',              href: '/sales-tasks',    icon: ListChecks, perm: 'page.leads' },
  { label: 'Handoffs',           href: '/sales-projects', icon: Inbox,      perm: 'page.leads' },
];
// Marketing Home (`/marketing`) comes first on purpose — it's the actual landing page for the
// whole module (MarketingWorkspaceClient), and it was previously reachable from NOWHERE in the
// sidebar. "Potentials" was removed as its own destination: it is not a separate page anymore
// (it's the Potential column inside Opportunities), and the old link only 302'd back to
// Opportunities — confusing, not a real place. "Opportunities" itself was also missing here even
// though it is Marketing's primary working screen (see PROJECT-MASTER-PLAN.md Phase 00.5).
const MARKETING_NAV: NavItem[] = [
  { label: 'Marketing Home',      href: '/marketing',               icon: Megaphone,    perm: 'page.marketing' },
  { label: 'Lead Cloud',          href: '/marketing/prospects',     icon: FolderSearch, perm: 'page.marketing' },
  { label: 'Opportunities',       href: '/marketing/opportunities', icon: Target,       perm: 'page.marketing' },
  { label: 'Campaigns & Surveys', href: '/marketing/campaigns',     icon: QrCode,       perm: 'page.marketing_campaigns' },
];

interface SidebarProps {
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  userName: string;
  userEmail: string;
  logoSrc?: string;
}

const EASE = 'cubic-bezier(0.165, 0.85, 0.45, 1)';
const DURATION = 240;
const EXPANDED_WIDTH = 230;
const COLLAPSED_WIDTH = 52;

// ── Panel Icon (from claude-sidebar) ───────────────────────────────────────
function PanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z" />
    </svg>
  );
}

function NavLink({
  item,
  perms,
  pathname,
  collapsed,
  bypassPerm = false,
}: {
  item: NavItem;
  perms: Record<string, boolean> | undefined;
  pathname: string;
  collapsed: boolean;
  bypassPerm?: boolean;
}) {
  if (!bypassPerm && !permCan(perms, item.perm)) return null;
  const Icon = item.icon;
  const active = pathname === item.href || (!item.exact && pathname?.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group flex items-center h-8.5 w-full rounded-xl px-2.5 text-xs font-medium transition-all duration-150 mb-0.5 select-none ${
        active
          ? 'bg-white text-slate-900 shadow-xs font-bold'
          : 'text-white/85 hover:text-white hover:bg-white/15'
      }`}
    >
      <div className="flex items-center gap-2.5 w-full min-w-0">
        <span className={`flex items-center justify-center shrink-0 w-5 h-5 ${active ? 'text-slate-900' : 'text-white/80 group-hover:text-white'}`}>
          <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
        </span>
        <span
          className="truncate flex-1 text-left"
          style={{
            opacity: collapsed ? 0 : 1,
            transition: `opacity 150ms ${EASE}`,
            display: collapsed ? 'none' : 'block',
          }}
        >
          {item.label}
        </span>
      </div>
    </Link>
  );
}

function NavGroup({
  title,
  icon: GroupIcon,
  items,
  perms,
  pathname,
  collapsed,
  bypassPerm = false,
  defaultOpen = false,
  activeOverride,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  items: NavItem[];
  perms: Record<string, boolean> | undefined;
  pathname: string;
  collapsed: boolean;
  bypassPerm?: boolean;
  defaultOpen?: boolean;
  activeOverride?: string;
}) {
  const visible = bypassPerm ? items : items.filter(item => permCan(perms, item.perm));

  const matchedHref = visible
    .filter(i => pathname === i.href || (!i.exact && pathname?.startsWith(`${i.href}/`)))
    .reduce((best, i) => (i.href.length > best.length ? i.href : best), '');
  const activeHref = (activeOverride && visible.some(i => i.href === activeOverride)) ? activeOverride : matchedHref;
  const isActiveGroup = !!activeHref;

  const storageKey = `sidebar_open_${title}`;
  const [open, setOpen] = useState(() => isActiveGroup || defaultOpen);

  useEffect(() => {
    if (isActiveGroup) { setOpen(true); return; }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) setOpen(stored === '1');
    } catch { }
  }, [isActiveGroup]);

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { }
      return next;
    });
  }

  if (visible.length === 0) return null;

  if (collapsed) {
    const firstItem = visible[0];
    return (
      <NavLink
        item={{ ...firstItem, label: title, icon: GroupIcon }}
        perms={perms}
        pathname={pathname}
        collapsed={true}
        bypassPerm={bypassPerm}
      />
    );
  }

  return (
    <div className="mb-0.5">
      <button
        onClick={toggle}
        className="flex items-center h-8 w-full rounded-xl px-2.5 text-xs font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors select-none text-left cursor-pointer"
        aria-expanded={open}
      >
        <GroupIcon size={15} strokeWidth={1.8} className="shrink-0 mr-2 text-white/80" />
        <span className="flex-1 truncate">{title}</span>
        <span className="text-[10px] text-white/60 font-mono mr-1.5">{visible.length}</span>
        {open ? <ChevronDown size={13} className="text-white/60" /> : <ChevronRight size={13} className="text-white/60" />}
      </button>

      {open && (
        <div className="ml-4.5 pl-2.5 border-l border-white/20 mt-0.5 space-y-0.5">
          {visible.map(item => {
            const Icon = item.icon;
            const active = item.href === activeHref;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 h-7.5 px-2 rounded-lg text-[12px] transition-colors ${
                  active
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={13} strokeWidth={1.8} className={`shrink-0 ${active ? 'text-slate-900' : 'text-white/70'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  userRole,
  userPerms,
  userName,
  userEmail,
  logoSrc,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickDealActive = pathname === '/leads' && searchParams?.get('view') === 'quick_deal';

  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('trustlines_sidebar_collapsed');
      if (stored !== null) setCollapsed(stored === '1');
    } catch { }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem('trustlines_sidebar_collapsed', next ? '1' : '0'); } catch { }
      return next;
    });
  }

  const initials = (userName || 'U')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleDisplay = ROLE_LABELS[userRole] || userRole.replace(/_/g, ' ');

  const isInternal = userRole !== 'tlines_pm';
  const SALES_ADMIN_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];
  const isSalesAdmin = SALES_ADMIN_ROLES.includes(userRole);
  const isSales = isSalesAdmin || userRole === 'sales_rep';
  const isMarketing = permCan(userPerms, 'page.marketing');

  // Sales and Marketing are two different teams working two different jobs (Sales works deals
  // through to a Trust project; Marketing works leads through to a qualified Opportunity) — they
  // used to share one "CRM" nav group, which is exactly what made the sidebar hard to read. Split
  // into two groups so each team sees only its own destinations under its own name.
  const salesNav: NavItem[] = [
    ...CRM_BOARD_NAV,
    ...SALES_NAV,
    ...(isSalesAdmin
      ? [{ label: 'Dashboard', href: '/sales-dashboard', icon: BarChart3, perm: 'page.sales_dashboard' },
         { label: 'Sales Team', href: '/sales-team', icon: Users, perm: 'page.sales_team' }]
      : []),
    { label: 'Trash', href: '/leads/trash', icon: Trash2, perm: 'page.leads' },
  ];

  return (
    <aside
      className="h-screen flex flex-col text-white select-none overflow-hidden shrink-0 z-20"
      style={{
        backgroundColor: '#474747',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        transition: `width ${DURATION}ms ${EASE}`,
      }}
    >
      {/* ── Header: Logo + Claude Panel Toggle Button ─────────── */}
      <div
        className="relative h-12 flex items-center justify-between px-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
      >
        <div
          className="flex items-center gap-2 overflow-hidden min-w-0"
          style={{
            opacity: collapsed ? 0 : 1,
            transition: `opacity 150ms ${EASE}`,
            pointerEvents: collapsed ? 'none' : 'auto',
          }}
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt="Trust-Lines"
              width={110}
              height={28}
              className="max-h-6 w-auto object-contain brightness-0 invert"
              priority
              unoptimized
            />
          ) : (
            <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span className="h-5 w-5 rounded bg-black/25 text-white flex items-center justify-center text-[10px] font-black">TL</span>
              Trust-Lines
            </span>
          )}
        </div>

        {/* Panel Collapse Toggle Button (Claude-Style) */}
        <button
          type="button"
          aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
          title={collapsed ? 'Open sidebar' : 'Close sidebar'}
          onClick={toggleCollapse}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0"
        >
          <PanelIcon />
        </button>
      </div>

      {/* ── Navigation List ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 scrollbar-none">
        <NavLink item={DASHBOARD_ITEM} perms={userPerms} pathname={pathname} collapsed={collapsed} />

        {isSales && (
          <NavGroup
            title="Sales" icon={Target} items={salesNav} perms={userPerms} pathname={pathname} bypassPerm defaultOpen
            collapsed={collapsed}
            activeOverride={quickDealActive ? '/leads/new' : undefined}
          />
        )}

        {isMarketing && (
          <NavGroup
            title="Marketing" icon={Megaphone}
            items={isSales ? MARKETING_NAV : [...CRM_BOARD_NAV, ...MARKETING_NAV]}
            perms={userPerms} pathname={pathname} bypassPerm defaultOpen
            collapsed={collapsed}
          />
        )}

        <NavGroup title="Design" icon={Palette} items={[DESIGN_ITEM]} perms={userPerms} pathname={pathname} collapsed={collapsed} />
        <NavGroup title="Projects" icon={ClipboardList} items={PROJECTS_NAV} perms={userPerms} pathname={pathname} collapsed={collapsed} />

        <NavLink item={CUSTOMERS_ITEM} perms={userPerms} pathname={pathname} collapsed={collapsed} />

        {isInternal && (
          <NavGroup title="Operations" icon={Factory} items={OPERATIONS_NAV} perms={userPerms} pathname={pathname} collapsed={collapsed} />
        )}
        {isInternal && (
          <NavGroup title="Admin" icon={ShieldCheck} items={ADMIN_NAV} perms={userPerms} pathname={pathname} collapsed={collapsed} />
        )}
      </div>

      {/* ── Footer: User Profile & Menu ──────────────────────── */}
      <div
        className="relative p-2 mt-auto shrink-0"
        ref={menuRef}
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
      >
        {/* User popover menu */}
        {menuOpen && (
          <div
            className={`bg-[#2D2D2D] text-white border border-white/15 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in-50 zoom-in-95 ${
              collapsed ? 'fixed left-[58px] bottom-3 w-56' : 'absolute bottom-full mb-2 left-2 right-2'
            }`}
          >
            <div className="px-3 py-2 border-b border-white/10 mb-1">
              <p className="text-xs font-bold text-white truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-white/60 truncate">{userEmail}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-teal-300">
                {roleDisplay}
              </span>
            </div>

            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <Settings size={14} className="text-white/70" />
              <span>Settings</span>
            </Link>

            <Link
              href="/audit"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <Shield size={14} className="text-white/70" />
              <span>Audit &amp; Security</span>
            </Link>

            <div className="h-px bg-white/10 my-1" />

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
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-xl transition-colors text-left cursor-pointer"
              >
                <LogOut size={14} className="text-rose-400" />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        )}

        {/* Trigger button row */}
        <button
          type="button"
          onClick={() => setMenuOpen(prev => !prev)}
          className="w-full flex items-center gap-2.5 p-1.5 rounded-xl bg-black/15 border border-white/10 hover:bg-black/25 transition-colors overflow-hidden text-left cursor-pointer group"
          aria-expanded={menuOpen}
          title={collapsed ? `${userName} (${roleDisplay})` : undefined}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-slate-800 text-xs font-bold shadow-xs">
            {initials}
          </div>
          <div
            className="flex flex-1 flex-col min-w-0"
            style={{
              opacity: collapsed ? 0 : 1,
              transition: `opacity 150ms ${EASE}`,
              display: collapsed ? 'none' : 'flex',
            }}
          >
            <span className="truncate text-xs font-bold text-white leading-tight">
              {userName}
            </span>
            <span className="truncate text-[10px] text-white/70 leading-tight mt-0.5">
              {roleDisplay}
            </span>
          </div>
          {!collapsed && (
            <ChevronDown size={13} className={`text-white/60 transition-transform duration-150 ${menuOpen ? 'rotate-180 text-white' : ''}`} />
          )}
        </button>
      </div>
    </aside>
  );
}
