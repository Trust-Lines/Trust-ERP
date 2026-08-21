'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
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
  LogOut,
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
  Clock,
  Inbox,
  QrCode,
} from 'lucide-react';
import type { UserRole } from '@/types/database';
import { permCan } from '@/lib/permissions/catalog';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  perm: string;
  exact?: boolean;
}

const DASHBOARD_ITEM: NavItem = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, perm: 'page.dashboard' };
const NOTIFICATIONS_ITEM: NavItem = { label: 'Notifications', href: '/notifications', icon: Bell, perm: 'page.notifications' };
const CUSTOMERS_ITEM: NavItem = { label: 'Customers', href: '/customers', icon: Contact, perm: 'page.customers' };
const DESIGN_ITEM: NavItem = { label: 'Design', href: '/design', icon: Palette, perm: 'page.design' };

const PROJECTS_NAV: NavItem[] = [
  { label: 'PM',        href: '/pm',        icon: ClipboardList, perm: 'page.projects' },
  { label: 'Supply',    href: '/projects',  icon: FolderKanban,  perm: 'page.projects' },
  { label: 'Approvals', href: '/approvals', icon: CheckSquare,   perm: 'page.approvals' },
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
const MARKETING_TOOLS_NAV: NavItem[] = [
  { label: 'Lead Cloud (Capture new)', href: '/marketing/prospects',  icon: Megaphone, perm: 'page.marketing' },
  { label: 'Potentials',               href: '/marketing/potentials', icon: Clock,     perm: 'page.marketing' },
  { label: 'Campaigns & Surveys', href: '/marketing/campaigns', icon: QrCode, perm: 'page.marketing_campaigns' },
];

interface SidebarProps {
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  userName: string;
  userEmail: string;
  logoSrc?: string;
}

function NavLink({ item, perms, pathname, bypassPerm = false }: {
  item: NavItem; perms: Record<string, boolean> | undefined; pathname: string; bypassPerm?: boolean;
}) {
  if (!bypassPerm && !permCan(perms, item.perm)) return null;
  const Icon = item.icon;
  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
  return (
    <Link href={item.href} className={`nav-item${active ? ' active' : ''}`} style={{ marginBottom: 2 }}>
      <Icon size={15} strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

function NavGroup({
  title, icon: GroupIcon, items, perms, pathname, bypassPerm = false, defaultOpen = false, activeOverride,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  items: NavItem[];
  perms: Record<string, boolean> | undefined;
  pathname: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveGroup]);

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { }
      return next;
    });
  }

  if (visible.length === 0) return null;

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={toggle}
        className="nav-item"
        style={{
          width: '100%', background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600,
        }}
        aria-expanded={open}
      >
        <GroupIcon size={15} strokeWidth={1.8} />
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: '10px', opacity: 0.55, marginRight: 2 }}>{visible.length}</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div style={{ marginLeft: 19, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.1)', marginTop: 1 }}>
          {visible.map(item => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? ' active' : ''}`}
                style={{ fontSize: 12.5, padding: '6px 10px', marginBottom: 1 }}
              >
                <Icon size={13} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userRole, userPerms, userName, userEmail, logoSrc }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickDealActive = pathname?.startsWith('/leads/') && searchParams.get('from') === 'quick-deal';

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const ROLE_LABELS: Record<UserRole, string> = {
    ops_manager:    'Ops Manager',
    pm_millwork:    'PM · Millwork',
    pm_ceiling:     'PM · Ceiling',
    trustlines_pm:  'TL Project Manager',
    tlines_pm:      'T-Lines PM',
    qc_responsible: 'QC Responsible',
    logistics:      'Logistics',
    accounting:     'Accounting',
    production_manager: 'Production Manager',
    project_manager:    'Project Manager',
    general_manager:    'General Manager',
    accountant:         'Accountant',
    designer:           'Designer',
    sales_marketing_manager: 'Sales & Marketing Manager',
    sales_rep:               'Sales Rep',
    design_lead:        'Design Lead',
    shop_drawer:        'Shop Drawer',
    supply_manager:     'Supply Manager',
    supply_user:        'Supply User',
    production_user:    'Production User',
    warehouse_manager:  'Warehouse Manager',
    warehouse_user:     'Warehouse User',
    marketing_pr:       'Marketing & PR',
    marketing_manager:  'Marketing Manager',
  };

  const isInternal = userRole !== 'tlines_pm';
  const SALES_ADMIN_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];
  const isSalesAdmin = SALES_ADMIN_ROLES.includes(userRole);
  const isSales = isSalesAdmin || userRole === 'sales_rep';
  const isMarketing = permCan(userPerms, 'page.marketing');

  const isFullAuthority = userRole === 'ops_manager' || userRole === 'general_manager';
  const demoNav: NavItem[] = [
    { label: 'Sales Dashboard',       href: '/live-dashboard-demo',       icon: MonitorPlay, perm: 'page.dashboard' },
    { label: 'Production Dashboard',  href: '/production-dashboard-demo', icon: Factory,     perm: 'page.dashboard' },
    { label: 'Full Pipeline',         href: '/pipeline-dashboard-demo',   icon: Gauge,       perm: 'page.dashboard' },
  ];
  const crmNav: NavItem[] = [
    ...CRM_BOARD_NAV,
    ...(isSales ? [
      ...SALES_NAV,
      ...(isSalesAdmin
        ? [{ label: 'Dashboard',  href: '/sales-dashboard', icon: BarChart3, perm: 'page.sales_dashboard' },
           { label: 'Sales Team', href: '/sales-team',      icon: Users,     perm: 'page.sales_team' }]
        : []),
      { label: 'Trash', href: '/leads/trash', icon: Trash2, perm: 'page.leads' },
    ] : []),
    ...(isMarketing ? MARKETING_TOOLS_NAV : []),
  ];

  return (
    <nav className="sidebar">
      <div
        style={{
          padding: '16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Image
          src={logoSrc || '/logo.png'}
          alt="Trust-Lines"
          width={150}
          height={48}
          style={{ objectFit: 'contain', objectPosition: 'left', maxHeight: 48, width: 'auto' }}
          priority
          unoptimized
        />
      </div>

      <div style={{ flex: 1, padding: '0 6px', overflowY: 'auto' }}>
        <NavLink item={DASHBOARD_ITEM} perms={userPerms} pathname={pathname} />
        <NavLink item={NOTIFICATIONS_ITEM} perms={userPerms} pathname={pathname} />

        {(isSales || isMarketing) && (
          <NavGroup
            title="CRM" icon={Target} items={crmNav} perms={userPerms} pathname={pathname} bypassPerm defaultOpen
            activeOverride={quickDealActive ? '/leads/new' : undefined}
          />
        )}

        <NavGroup title="Design" icon={Palette} items={[DESIGN_ITEM]} perms={userPerms} pathname={pathname} />
        <NavGroup title="Projects" icon={ClipboardList} items={PROJECTS_NAV} perms={userPerms} pathname={pathname} />

        <NavLink item={CUSTOMERS_ITEM} perms={userPerms} pathname={pathname} />

        {isInternal && (
          <NavGroup title="Operations" icon={Factory} items={OPERATIONS_NAV} perms={userPerms} pathname={pathname} />
        )}
        {isFullAuthority && (
          <NavGroup title="Demo Dashboards" icon={MonitorPlay} items={demoNav} perms={userPerms} pathname={pathname} bypassPerm />
        )}
        {isInternal && (
          <NavGroup title="Admin" icon={ShieldCheck} items={ADMIN_NAV} perms={userPerms} pathname={pathname} />
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          className="avatar avatar-sm"
          style={{ flexShrink: 0, fontSize: '10px' }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'white',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {userName}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
            {ROLE_LABELS[userRole]}
          </div>
        </div>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            title="Sign out"
            onClick={() => {
              try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                  const k = localStorage.key(i);
                  if (k && k.startsWith('docgen_')) localStorage.removeItem(k);
                }
              } catch { }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LogOut size={14} />
          </button>
        </form>
      </div>
    </nav>
  );
}
