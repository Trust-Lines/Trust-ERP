'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Factory,
  ClipboardCheck,
  ClipboardList,
  Gauge,
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
  Globe,
  Target,
  FilePlus,
  BarChart3,
  ListChecks,
  Package,
  Receipt,
  Megaphone,
  Inbox,
  QrCode,
  Mail,
  UserSearch,
  PanelLeftClose,
  PanelLeftOpen,
  DraftingCompass,
  BriefcaseBusiness,
  Wrench,
  Landmark,
  CreditCard,
  PieChart,
  Wallet,
  Share2,
  CalendarDays,
  MailOpen,
} from 'lucide-react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { UserRole } from '@/types/database';
import { pageAllowed } from '@/lib/permissions/catalog';
import { DEFAULT_LOGO } from '@/lib/regionLogo';
import { UserMenu } from './UserMenu';

// Design: Figma "TRUST-LINES ERP" → "Shell (Task 11)" (112:15713): 72px icon rail + 232px panel
// that lists the selected group's pages; collapsing hides the panel. Light + dark.
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  perm: string;
  exact?: boolean;
}

export const ROLE_LABELS: Record<string, string> = {
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
// Personal Google Calendar view — everyone who has the Dashboard has their own meetings.
const MEETINGS_ITEM: NavItem = { label: 'My meetings', href: '/meetings', icon: CalendarDays, perm: 'page.dashboard' };
const CUSTOMERS_ITEM: NavItem = { label: 'Customers', href: '/customers', icon: Contact, perm: 'page.customers' };
const DESIGN_ITEM: NavItem = { label: 'Design', href: '/design', icon: Palette, perm: 'page.design' };

// "Supply" → /projects. User feedback 2026-08-28: a separate /supply route next to the project
// list was one extra page too many ("fazladan sayfa lazım değil, yeterli sayfada lazım"). The
// "waiting on me / blocked" summary (item-plan/list/PO/PF status for pm_millwork/pm_ceiling) now
// lives at the TOP of this same /projects page instead of a second destination.
// 2026-10-21 (Figma "All Pages"): the old "Projects" group is now "Supply" and its /projects
// item is labelled "Projects"; Clients, Suppliers and QC moved here from Operations (Expenses
// went to Finance).
// `internal` marks the items that came from Operations — they stay hidden from external
// (tlines_pm) users exactly as before, when the whole Operations group was internal-only.
const SUPPLY_NAV: (NavItem & { internal?: boolean })[] = [
  { label: 'Projects',  href: '/projects',  icon: FolderKanban,   perm: 'page.projects' },
  { label: 'PM',        href: '/pm',        icon: ClipboardList,  perm: 'page.pm' },
  { label: 'Clients',   href: '/clients',   icon: Building2,      perm: 'page.clients',   internal: true },
  { label: 'Suppliers', href: '/suppliers', icon: Package,        perm: 'page.suppliers', internal: true },
  { label: 'QC',        href: '/qc',        icon: ClipboardCheck, perm: 'page.qc',        internal: true },
  { label: 'Approvals', href: '/approvals', icon: CheckSquare,    perm: 'page.approvals' },
];

// Invoices, Payments and Budgets are placeholder pages for now, gated like Expenses.
const FINANCE_NAV: NavItem[] = [
  { label: 'Invoices', href: '/invoices', icon: Landmark,   perm: 'page.invoices' },
  { label: 'Payments', href: '/payments', icon: CreditCard, perm: 'page.payments' },
  { label: 'Expenses', href: '/expenses', icon: Receipt,    perm: 'page.expenses' },
  { label: 'Budgets',  href: '/budgets',  icon: PieChart,   perm: 'page.budgets' },
];

const OPERATIONS_NAV: NavItem[] = [
  { label: 'Production', href: '/production', icon: Factory,          perm: 'page.production' },
  { label: 'Logistics',  href: '/logistics',  icon: Truck,            perm: 'page.logistics' },
  { label: 'Management', href: '/management', icon: Gauge,            perm: 'page.management' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Team',                href: '/team',           icon: Users,        perm: 'page.team' },
  { label: 'Roles & permissions', href: '/roles',          icon: ShieldCheck,  perm: 'page.roles' },
  { label: 'Trash',               href: '/projects/trash', icon: Trash2,       perm: 'page.trash' },
  { label: 'Dropbox Wizard',      href: '/dropbox-wizard', icon: FolderSearch, perm: 'page.dropbox_wizard' },
  { label: 'Audit Log',           href: '/audit',          icon: ScrollText,   perm: 'page.audit' },
  { label: 'Settings',            href: '/settings',       icon: Settings,     perm: 'page.settings' },
];

const CRM_BOARD_NAV: NavItem[] = [
  { label: 'CRM Board', href: '/leads', icon: Target, perm: 'page.leads', exact: true },
];
const SALES_NAV: NavItem[] = [
  { label: 'Quick Deals',        href: '/leads/new',      icon: FilePlus,   perm: 'page.leads' },
  { label: 'Tasks',              href: '/sales-tasks',    icon: ListChecks, perm: 'page.sales_tasks' },
  { label: 'Handoffs',           href: '/sales-projects', icon: Inbox,      perm: 'page.sales_handoffs' },
];
// Marketing Home (`/marketing`) comes first on purpose — it's the actual landing page for the
// whole module (MarketingWorkspaceClient), and it was previously reachable from NOWHERE in the
// sidebar.
//
// 🔴 2026-09-23: "Potentials" direct nav link removed — that free-browsing list (122+ rows,
// no query required) is exactly what the Contacts query-builder restriction was just added to
// close off. Its data is still reachable, just query-first now: Contacts' "project status:
// none/active" quick-query buttons cover the same ground. Route itself
// (/marketing/opportunities) is untouched in case something still links to it directly.
const MARKETING_NAV: NavItem[] = [
  { label: 'Marketing Home',      href: '/marketing',               icon: Megaphone,    perm: 'page.marketing' },
  { label: 'Contacts',            href: '/marketing/prospects',     icon: FolderSearch, perm: 'page.marketing_contacts' },
  // 2026-09-28: query-builder Contacts still requires a criterion — this is the one deliberate
  // exception, "type a name, see everyone" for whoever just needs to look a person up.
  { label: 'Contact Manager',     href: '/marketing/contact-manager', icon: UserSearch,  perm: 'page.marketing_contact_manager' },
  { label: 'Email Campaigns',     href: '/marketing/email',         icon: MailOpen,     perm: 'page.marketing_email' },
  { label: 'Mail Templates',      href: '/marketing/mail-templates', icon: Mail,        perm: 'page.marketing_mail_templates' },
  { label: 'Campaigns & Surveys', href: '/marketing/campaigns',     icon: QrCode,       perm: 'page.marketing_campaigns' },
  // Marketing & PR workspace (migration 127): social media tracking + the team calendar.
  { label: 'Social Media',        href: '/marketing/social',        icon: Share2,       perm: 'page.marketing_social' },
  { label: 'Calendar',            href: '/marketing/calendar',      icon: CalendarDays, perm: 'page.marketing_calendar' },
  { label: 'Website (Store Maker)', href: '/marketing/website',     icon: Globe,        perm: 'page.marketing_website' },
  { label: 'Trash',               href: '/marketing/prospects/trash', icon: Trash2,     perm: 'page.marketing_trash' },
];

export function roleLabel(role: string) {
  return ROLE_LABELS[role] || role.replace(/_/g, ' ');
}

interface SidebarProps {
  userRole: UserRole;
  userPerms?: Record<string, boolean>;
  userName: string;
  userEmail: string;
  logoSrc?: string;
}

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;
export interface NavSection {
  key: string;
  title: string;
  icon: IconType;
  items: NavItem[];
  activeOverride?: string;
}

const COLLAPSE_KEY = 'trustlines_sidebar_collapsed';
const RAIL_ICON = 'h-6 w-6';
const RAIL_ITEM_BASE = 'flex w-full items-center justify-center rounded-md px-2.5 transition-colors';
const RAIL_IDLE = 'h-[30px] text-[#787881] hover:bg-primary-50 hover:text-secondary-700 dark:hover:bg-primary-800 dark:hover:text-primary-50';
const RAIL_ACTIVE = 'h-12 bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950';
const DIVIDER = 'h-px w-full bg-primary-100 dark:bg-primary-600';

function isOn(pathname: string, item: NavItem) {
  return pathname === item.href || (!item.exact && !!pathname?.startsWith(`${item.href}/`));
}

/** Longest matching href in a section (so /leads/new beats /leads), or the override. */
function activeHrefIn(section: NavSection, pathname: string) {
  if (section.activeOverride && section.items.some(i => i.href === section.activeOverride)) return section.activeOverride;
  return section.items
    .filter(i => isOn(pathname, i))
    .reduce((best, i) => (i.href.length > best.length ? i.href : best), '');
}

/** Groups and pages this user may open — shared by the sidebar and the top-bar page search. */
export function buildNavSections(userRole: UserRole, userPerms: Record<string, boolean> | undefined, quickDealActive = false): NavSection[] {
  const isInternal = userRole !== 'tlines_pm';
  // Every link checks its own page key (Roles & Permissions); a page a role hasn't set yet
  // follows its old default — see pageAllowed in lib/permissions/catalog.ts.
  const allowed = (items: NavItem[]) => items.filter(i => pageAllowed(userRole, userPerms, i.perm));
  const marketingNav = allowed(MARKETING_NAV);

  // Sales and Marketing are two different teams working two different jobs (Sales works deals
  // through to a Trust project; Marketing works leads through to a qualified Opportunity) — they
  // used to share one "CRM" nav group, which is exactly what made the sidebar hard to read. Split
  // into two groups so each team sees only its own destinations under its own name.
  const salesNav: NavItem[] = [
    ...CRM_BOARD_NAV,
    ...SALES_NAV,
    { label: 'Dashboard', href: '/sales-dashboard', icon: BarChart3, perm: 'page.sales_dashboard' },
    { label: 'Sales Team', href: '/sales-team', icon: Users, perm: 'page.sales_team' },
    // Customers = the real end-customer record, used AFTER a project is won/delivered
    // (addresses, contacts, meetings, follow-ups, handover). That's a Sales/T-Lines
    // relationship concern, not something Trust Lines' internal ops/production side needs —
    // it used to be its own standalone sidebar item between Projects and Operations, visible
    // to everyone including roles that never touch a customer relationship. Living inside
    // this group means it only shows for Sales-side roles (showSales below), same as the rest
    // of the Sales nav.
    CUSTOMERS_ITEM,
    { label: 'Trash', href: '/leads/trash', icon: Trash2, perm: 'page.leads_trash' },
  ];

  // The Sales group shows when the person can open a Sales page; Customers alone (which
  // internal roles also have) doesn't make it a Sales group.
  const salesItems = allowed(salesNav);
  const showSales = salesItems.some(i => i !== CUSTOMERS_ITEM);
  const sections: NavSection[] = [
    { key: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, items: allowed([DASHBOARD_ITEM, MEETINGS_ITEM]) },
    { key: 'marketing', title: 'Marketing', icon: Megaphone, items: marketingNav },
    ...(showSales ? [{ key: 'sales', title: 'Sales', icon: Target, items: salesItems, activeOverride: quickDealActive ? '/leads/new' : undefined }] : []),
    { key: 'design', title: 'Design', icon: DraftingCompass, items: allowed([DESIGN_ITEM]) },
    { key: 'supply', title: 'Supply', icon: BriefcaseBusiness, items: allowed(SUPPLY_NAV.filter(i => isInternal || !i.internal)) },
    ...(isInternal ? [{ key: 'operations', title: 'Operations', icon: Factory, items: allowed(OPERATIONS_NAV) }] : []),
    ...(isInternal ? [{ key: 'finance', title: 'Finance', icon: Wallet, items: allowed(FINANCE_NAV) }] : []),
    ...(isInternal ? [{ key: 'admin', title: 'Admin', icon: Wrench, items: allowed(ADMIN_NAV) }] : []),
  ].filter(s => s.items.length > 0);
  return sections;
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
  const [browsing, setBrowsing] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored !== null) setCollapsed(stored === '1');
    } catch { }
  }, []);

  // A rail click previews another group; navigating anywhere snaps back to the page's own group.
  useEffect(() => { setBrowsing(null); }, [pathname]);

  function setCollapsedPersisted(next: boolean) {
    setCollapsed(next);
    try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { }
  }

  const roleDisplay = roleLabel(userRole);

  const sections = buildNavSections(userRole, userPerms, quickDealActive);

  // The page's own group: the one holding the longest matching href.
  const pageSectionKey = sections
    .map(s => ({ key: s.key, len: activeHrefIn(s, pathname).length }))
    .filter(s => s.len > 0)
    .sort((a, b) => b.len - a.len)[0]?.key ?? null;
  const shownKey = browsing ?? pageSectionKey ?? sections[0]?.key ?? null;
  const shown = sections.find(s => s.key === shownKey);
  const shownActiveHref = shown && shown.key === pageSectionKey ? activeHrefIn(shown, pathname) : '';
  const canSettings = pageAllowed(userRole, userPerms, 'page.settings');

  return (
    <aside
      // sticky, not the old fixed-shell/overflow-hidden trick — AppShell's outer container no
      // longer clips to h-screen (2026-09-23, so short pages don't force-fill the viewport
      // with empty content-area background), so the sidebar has to pin itself instead.
      className="sticky top-0 z-20 flex h-screen shrink-0 select-none font-ui"
    >
      {/* ── Icon rail ─────────────────────────────────────────── */}
      <nav
        aria-label="Workspace groups"
        className="flex h-full w-[72px] flex-col items-center justify-between overflow-y-auto overflow-x-hidden border-r border-primary-100 bg-white px-3 pt-[30px] pb-5 scrollbar-none dark:border-primary-600 dark:bg-primary-950"
      >
        <div className="flex w-full flex-col items-center gap-10">
          <RailTip
            label={collapsed ? 'Open sidebar' : 'Close sidebar'}
            render={
              <button
                type="button"
                onClick={() => setCollapsedPersisted(!collapsed)}
                aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
                className="grid h-6 w-6 cursor-pointer place-items-center rounded text-secondary-700 hover:text-primary-500 dark:text-primary-50 dark:hover:text-primary-200"
              />
            }
          >
            {collapsed ? <PanelLeftOpen className={RAIL_ICON} strokeWidth={1.5} /> : <PanelLeftClose className={RAIL_ICON} strokeWidth={1.5} />}
          </RailTip>

          <div className="flex w-full flex-col items-center gap-[30px]">
            <div className="flex h-4 w-full items-center"><div className={DIVIDER} /></div>
            {sections.map(s => {
              const Icon = s.icon;
              const active = s.key === shownKey;
              const cls = `${RAIL_ITEM_BASE} ${active ? RAIL_ACTIVE : RAIL_IDLE}`;
              // A single-page group (Dashboard, Design) goes straight to its page.
              if (s.items.length === 1) {
                return (
                  <RailTip
                    key={s.key}
                    label={s.title}
                    render={<Link href={s.items[0].href} aria-label={s.title} aria-current={s.key === pageSectionKey ? 'page' : undefined} className={cls} />}
                  >
                    <Icon className={RAIL_ICON} strokeWidth={1.5} />
                  </RailTip>
                );
              }
              return (
                <RailTip
                  key={s.key}
                  label={s.title}
                  render={
                    <button
                      type="button"
                      aria-label={s.title}
                      aria-pressed={active}
                      onClick={() => { setBrowsing(s.key); if (collapsed) setCollapsedPersisted(false); }}
                      className={`${cls} cursor-pointer`}
                    />
                  }
                >
                  <Icon className={RAIL_ICON} strokeWidth={1.5} />
                </RailTip>
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-10 pt-10">
          <div className={DIVIDER} />
          <div className="flex flex-col items-center gap-[30px]">
            <RailTip label="Notifications" render={<Link href="/notifications" aria-label="Notifications" className="text-[#787881] hover:text-secondary-700 dark:hover:text-primary-50" />}>
              <Bell className={RAIL_ICON} strokeWidth={1.5} />
            </RailTip>
            {canSettings && (
              <RailTip label="Settings" render={<Link href="/settings" aria-label="Settings" className="text-[#787881] hover:text-secondary-700 dark:hover:text-primary-50" />}>
                <Settings className={RAIL_ICON} strokeWidth={1.5} />
              </RailTip>
            )}
          </div>
          <div className={DIVIDER} />
          <UserMenu userName={userName} userEmail={userEmail} roleDisplay={roleDisplay} variant="rail" />
        </div>
      </nav>

      {/* ── Group panel ───────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex h-full w-[232px] flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-primary-100 bg-white px-4 pt-6 pb-5 scrollbar-none dark:border-primary-600 dark:bg-primary-950">
          <div className="flex w-full flex-col gap-[52px]">
            <BrandLogo logoSrc={logoSrc} />

            {shown && (
              <div className="flex w-full flex-col gap-2.5">
                <p className="flex h-6 items-start pl-2.5 text-xs font-medium leading-4 text-primary-300 dark:text-primary-400">{shown.title}</p>
                {shown.items.map(item => {
                  const Icon = item.icon;
                  const active = item.href === shownActiveHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${
                        active
                          ? 'bg-secondary-700 font-semibold text-primary-50 dark:bg-secondary-50 dark:text-primary-950'
                          : 'text-[#787881] hover:bg-primary-50 hover:text-secondary-700 dark:hover:bg-primary-800 dark:hover:text-primary-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 pt-6 text-[11px] leading-[1.4] text-primary-400 dark:text-primary-200">
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 truncate">{roleDisplay}</span>
          </p>
        </div>
      )}
    </aside>
  );
}

/**
 * Rail hover label (Figma "Hover title"): 30px pill to the right of the icon — primary-50 fill,
 * primary-100 1px border, 6px radius, 13px/500 body-text label. Portalled so the rail's
 * overflow clipping doesn't cut it off.
 */
function RailTip({ label, render, children }: { label: string; render: React.ReactElement; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={150} render={render}>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="right" sideOffset={12} className="isolate z-50">
          <TooltipPrimitive.Popup className="flex h-[30px] items-center whitespace-nowrap rounded-md border border-primary-100 bg-primary-50 px-2.5 font-ui text-[13px] font-medium leading-none text-primary-500 transition-opacity duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 dark:border-primary-600 dark:bg-primary-800 dark:text-primary-50">
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** T Holding mark for the default workspace; region workspaces keep their own logo. */
function BrandLogo({ logoSrc }: { logoSrc?: string }) {
  if (!logoSrc || logoSrc === DEFAULT_LOGO) {
    return (
      <div className="flex h-[54px] w-full items-center pl-[3px]">
        <Image src="/login/t-holding-logo.svg" alt="T Holding" width={130} height={54} priority className="h-[54px] w-auto dark:hidden" />
        <Image src="/login/t-holding-logo-dark.svg" alt="T Holding" width={130} height={54} priority className="hidden h-[54px] w-auto dark:block" />
      </div>
    );
  }
  return (
    <div className="flex h-[54px] w-full items-center pl-[3px]">
      <Image src={logoSrc} alt="Workspace logo" width={130} height={54} priority unoptimized className="max-h-[54px] w-auto object-contain dark:brightness-0 dark:invert" />
    </div>
  );
}
