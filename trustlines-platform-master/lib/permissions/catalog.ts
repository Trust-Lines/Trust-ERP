import { SALES_HANDOFF_ROLES, SALES_INTAKE_ROLES, SALES_TEAM_ADMIN_ROLES } from '@/lib/sales/roles';

export type PermCategory = 'page' | 'edit' | 'sign' | 'view' | 'notify' | 'progress';

export const PAGE_ROUTES: { key: string; route: string }[] = [
  { key: 'page.dashboard',       route: '/dashboard' },
  { key: 'page.projects',        route: '/projects' },
  { key: 'page.pm',              route: '/pm' },
  { key: 'page.customers',       route: '/customers' },
  { key: 'page.design',          route: '/design' },
  { key: 'page.design_assets',   route: '/design/assets' },
  { key: 'page.design_brands',   route: '/design/brands' },
  { key: 'page.design_materials', route: '/design/materials' },
  { key: 'page.design_reviews',  route: '/design/reviews' },
  { key: 'page.approvals',       route: '/approvals' },
  { key: 'page.notifications',   route: '/notifications' },
  { key: 'page.clients',         route: '/clients' },
  { key: 'page.marketing',       route: '/marketing' },
  { key: 'page.marketing_contacts', route: '/marketing/prospects' },
  { key: 'page.marketing_contact_manager', route: '/marketing/contact-manager' },
  { key: 'page.marketing_import', route: '/marketing/import' },
  { key: 'page.marketing_email', route: '/marketing/email' },
  { key: 'page.marketing_mail_templates', route: '/marketing/mail-templates' },
  { key: 'page.marketing_campaigns', route: '/marketing/campaigns' },
  { key: 'page.marketing_social', route: '/marketing/social' },
  { key: 'page.marketing_calendar', route: '/marketing/calendar' },
  { key: 'page.marketing_website', route: '/marketing/website' },
  { key: 'page.marketing_trash', route: '/marketing/prospects/trash' },
  { key: 'page.leads',           route: '/leads' },
  { key: 'page.sales_tasks',     route: '/sales-tasks' },
  { key: 'page.sales_handoffs',  route: '/sales-projects' },
  { key: 'page.sales_dashboard', route: '/sales-dashboard' },
  { key: 'page.sales_team',      route: '/sales-team' },
  { key: 'page.leads_trash',     route: '/leads/trash' },
  { key: 'page.production',      route: '/production' },
  { key: 'page.qc',              route: '/qc' },
  { key: 'page.logistics',       route: '/logistics' },
  { key: 'page.management',      route: '/management' },
  { key: 'page.suppliers',       route: '/suppliers' },
  { key: 'page.expenses',        route: '/expenses' },
  { key: 'page.invoices',        route: '/invoices' },
  { key: 'page.payments',        route: '/payments' },
  { key: 'page.budgets',         route: '/budgets' },
  { key: 'page.team',            route: '/team' },
  { key: 'page.roles',           route: '/roles' },
  { key: 'page.audit',           route: '/audit' },
  { key: 'page.dropbox_wizard',  route: '/dropbox-wizard' },
  { key: 'page.trash',           route: '/projects/trash' },
  { key: 'page.settings',        route: '/settings' },
];

export interface PermDef { key: string; label: string; hint?: string }
export interface PermGroup { category: PermCategory; title: string; icon: string; perms: PermDef[] }

// Page access is split by area so every page in the sidebar can be switched on/off per role.
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    category: 'page', title: 'Pages · General', icon: '🗂️',
    perms: [
      { key: 'page.dashboard',      label: 'Dashboard' },
      { key: 'page.approvals',      label: 'Approvals inbox' },
      { key: 'page.notifications',  label: 'Notifications' },
      { key: 'page.settings',       label: 'Settings' },
    ],
  },
  {
    category: 'page', title: 'Pages · Marketing', icon: '📣',
    perms: [
      { key: 'page.marketing',      label: 'Marketing Home', hint: 'The Marketing workspace. A Marketing page you haven’t set separately follows this switch.' },
      { key: 'page.marketing_contacts', label: 'Contacts', hint: 'Contacts query builder, Contact pages, Potentials & Opportunities lists' },
      { key: 'page.marketing_contact_manager', label: 'Contact Manager', hint: 'Browse every Contact without building a query' },
      { key: 'page.marketing_import', label: 'Contact import', hint: 'Excel / business-card import' },
      { key: 'page.marketing_email', label: 'Email Campaigns', hint: 'Email campaigns, sent emails and the do-not-email list' },
      { key: 'page.marketing_mail_templates', label: 'Mail Templates' },
      { key: 'page.marketing_campaigns', label: 'Campaigns & Surveys', hint: 'Trade fair/event campaigns and their public survey link' },
      { key: 'page.marketing_social', label: 'Social Media' },
      { key: 'page.marketing_calendar', label: 'Calendar' },
      { key: 'page.marketing_website', label: 'Website (Store Maker)', hint: 'Public website projects and blog' },
      { key: 'page.marketing_trash', label: 'Marketing Trash', hint: 'Deleted Contacts and Needs' },
    ],
  },
  {
    category: 'page', title: 'Pages · Sales', icon: '🎯',
    perms: [
      { key: 'page.leads',           label: 'CRM Board & Quick Deals', hint: 'Deals board, lead pages and the new-lead form' },
      { key: 'page.sales_tasks',     label: 'Sales Tasks' },
      { key: 'page.sales_handoffs',  label: 'Handoffs', hint: 'Opportunities handed from Marketing to Sales' },
      { key: 'page.sales_dashboard', label: 'Sales Dashboard' },
      { key: 'page.sales_team',      label: 'Sales Team' },
      { key: 'page.customers',       label: 'Customers' },
      { key: 'page.leads_trash',     label: 'Sales Trash', hint: 'Deleted leads' },
    ],
  },
  {
    category: 'page', title: 'Pages · Projects & Supply', icon: '📁',
    perms: [
      { key: 'page.projects',       label: 'Projects' },
      { key: 'page.pm',             label: 'PM workspace', hint: 'Personal project priorities. Follows “Projects” until set separately.' },
      { key: 'page.design',         label: 'Design workspace', hint: 'Sales Design jobs assigned to the designer' },
      { key: 'page.design_assets',  label: 'Design · Asset Library', hint: 'Templates, CAD blocks, standard details. Follows “Design workspace” until set separately.' },
      { key: 'page.design_brands',  label: 'Design · Brand Kits', hint: 'Customer logos, colours, fonts. Follows “Design workspace” until set separately.' },
      { key: 'page.design_materials', label: 'Design · Materials & Finishes', hint: 'Material catalogue with suppliers and prices. Follows “Design workspace” until set separately.' },
      { key: 'page.design_reviews', label: 'Design · Customer Reviews', hint: 'Proposal links sent to customers. Follows “Design workspace” until set separately.' },
      { key: 'page.clients',        label: 'Clients' },
      { key: 'page.suppliers',      label: 'Suppliers & finance', hint: 'Supplier profiles, invoices, payments — vendor cost (hidden from client PM)' },
      { key: 'page.qc',             label: 'QC' },
    ],
  },
  {
    category: 'page', title: 'Pages · Operations', icon: '🏭',
    perms: [
      { key: 'page.production',     label: 'Production board' },
      { key: 'page.logistics',      label: 'Logistics' },
      { key: 'page.management',     label: 'Management workspace', hint: 'Company-wide blockers, workload and project health' },
    ],
  },
  {
    category: 'page', title: 'Pages · Finance', icon: '💰',
    perms: [
      { key: 'page.expenses',       label: 'Expenses', hint: 'Internal operational spend ledger (hidden from client PM). Invoices, Payments and Budgets follow this until set separately.' },
      { key: 'page.invoices',       label: 'Invoices' },
      { key: 'page.payments',       label: 'Payments' },
      { key: 'page.budgets',        label: 'Budgets' },
    ],
  },
  {
    category: 'page', title: 'Pages · Admin', icon: '🛠️',
    perms: [
      { key: 'page.team',           label: 'Team' },
      { key: 'page.roles',          label: 'Roles & Permissions' },
      { key: 'page.audit',          label: 'Audit log' },
      { key: 'page.dropbox_wizard', label: 'Dropbox Wizard' },
      { key: 'page.trash',          label: 'Projects Trash' },
    ],
  },
  {
    category: 'edit', title: 'Editing rights (off = view-only)', icon: '✏️',
    perms: [
      { key: 'edit.projects',  label: 'Create / edit / delete projects', hint: 'Off → can open projects but not change them' },
      { key: 'edit.clients',   label: 'Manage clients & services' },
      { key: 'edit.customers', label: 'Manage customers & contacts' },
      { key: 'edit.marketing', label: 'Manage Marketing records', hint: 'Prospects, Contacts, Locations, Potentials, intake forms (Phase 00.3+)' },
      { key: 'edit.team',      label: 'Invite / edit / remove members' },
      { key: 'edit.roles',     label: 'Manage roles & permissions' },
      { key: 'edit.production', label: 'Change production board / statuses' },
    ],
  },
  {
    category: 'sign', title: 'Signatures', icon: '✍️',
    perms: [
      { key: 'sign.production_millwork', label: 'Production Manager — Millwork / Shelving', hint: 'Sign the Production Manager box on Millwork & Shelving docs/PFs' },
      { key: 'sign.production_ceiling',  label: 'Production Manager — Ceiling / Image / Decoration', hint: 'Sign the Production Manager box on the other categories' },
      { key: 'sign.trust_pm',            label: 'Trust-Lines PM', hint: 'Trust PM on construction & production bundle; Project Manager box on PF' },
      { key: 'sign.client_pm',           label: 'Client PM (T-Lines PM)', hint: 'Plan Layout, Design Proposal, production bundle & PO Client PM' },
      { key: 'sign.general_manager',     label: 'General Manager', hint: 'General Manager box on PO and PF' },
      { key: 'sign.accountant',          label: 'Accountant (optional)', hint: 'Accountant box on PO and PF — optional, any time' },
      { key: 'sign.pm_supervisor',       label: 'Project Management Supervisor', hint: 'Optional supervisor box on PO — any time' },
    ],
  },
  {
    category: 'view', title: 'Visibility', icon: '👁️',
    perms: [
      { key: 'view.tab_overview',        label: 'Overview tab' },
      { key: 'view.tab_plan_layout',     label: 'Plan Layout tab' },
      { key: 'view.tab_design_proposal', label: 'Design Proposal tab' },
      { key: 'view.tab_construction',    label: 'Construction Drawing tab' },
      { key: 'view.tab_millwork',        label: 'Millwork tab' },
      { key: 'view.tab_shelving',        label: 'Shelving tab' },
      { key: 'view.tab_ceiling',         label: 'Ceiling tab' },
      { key: 'view.tab_image',           label: 'Image tab' },
      { key: 'view.tab_decoration',      label: 'Decoration tab' },
      { key: 'view.pf',                  label: 'Production Forms (PF)', hint: 'See the PF sub-tab inside a category' },
      { key: 'view.po',                  label: 'Purchase Orders (PO)', hint: 'See the PO sub-tab inside a category' },
      { key: 'view.prices',              label: 'Prices & financials', hint: 'PO amounts, price lists, margins' },
      { key: 'view.production_board',    label: 'Production board', hint: 'The operational board / Excel view' },
    ],
  },
  {
    category: 'notify', title: 'Notifications', icon: '🔔',
    perms: [
      { key: 'notify.approval_request',  label: 'Approval needed (my signature)', hint: 'Emailed when a document is waiting for my role to sign' },
      { key: 'notify.approval_complete', label: 'Approval completed', hint: 'Emailed when a document is fully approved' },
      { key: 'notify.revision',          label: 'Document revised', hint: 'Emailed when a file is replaced and approval resets' },
      { key: 'notify.hold_t',            label: 'HOLD / T placed', hint: 'Emailed when an order is put on HOLD / T' },
      { key: 'notify.payment',           label: 'Payment due', hint: 'Waiting Payment / Ready to Receive (accountant)' },
      { key: 'notify.ready',             label: 'Order READY', hint: 'Emailed when a PF is marked READY (Client PM)' },
    ],
  },
  {
    category: 'progress', title: 'Progress visibility', icon: '📈',
    perms: [
      { key: 'progress.finalization', label: 'Phase 1 · Finalization' },
      { key: 'progress.construction', label: 'Phase 2 · Construction Documents' },
      { key: 'progress.production',   label: 'Phase 3 · Production' },
      { key: 'progress.delivery',     label: 'Phase 4 · Delivery' },
    ],
  },
];

export const ALL_PERM_KEYS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

export type PermMap = Record<string, boolean>;

export function permCan(perms: PermMap | null | undefined, key: string): boolean {
  if (!perms) return false;
  return perms.all === true || perms[key] === true;
}

// Page keys added after roles were already saved. A role's stored map is used WHOLE (see
// effectivePermissions), so a brand-new key would read as "off" for every saved role and lock
// people out. Instead, until an admin sets the key for a role, it follows what used to decide
// access to that page: its parent key, or the fixed role list the page used to check in code.
// An explicit true/false in the role's map (set on the Roles page) always wins.
export const PAGE_PARENT: Record<string, string> = {
  'page.marketing_contacts': 'page.marketing',
  'page.marketing_contact_manager': 'page.marketing',
  'page.marketing_import': 'page.marketing',
  'page.marketing_email': 'page.marketing',
  'page.marketing_mail_templates': 'page.marketing',
  'page.marketing_social': 'page.marketing',
  'page.marketing_calendar': 'page.marketing',
  'page.marketing_website': 'page.marketing',
  'page.marketing_trash': 'page.marketing',
  'page.invoices': 'page.expenses',
  'page.payments': 'page.expenses',
  'page.budgets': 'page.expenses',
  'page.pm': 'page.projects',
  'page.design_assets': 'page.design',
  'page.design_brands': 'page.design',
  'page.design_materials': 'page.design',
  'page.design_reviews': 'page.design',
};

/** Sales pages were guarded by these lists in code (app/(platform)/leads, sales-*); they stay the default. */
export const PAGE_LEGACY_ROLES: Record<string, string[]> = {
  'page.leads': SALES_INTAKE_ROLES,
  'page.leads_trash': SALES_INTAKE_ROLES,
  'page.sales_tasks': SALES_INTAKE_ROLES,
  'page.sales_handoffs': SALES_HANDOFF_ROLES,
  'page.sales_dashboard': SALES_TEAM_ADMIN_ROLES,
  'page.sales_team': SALES_TEAM_ADMIN_ROLES,
};

/** Whether `role` (with its effective permission map) may open the page behind `key`. */
export function pageAllowed(role: string | null | undefined, perms: PermMap | null | undefined, key: string): boolean {
  if (!perms) return false;
  if (perms.all === true) return true;
  if (key in perms) return perms[key] === true;
  const parent = PAGE_PARENT[key];
  if (parent) return pageAllowed(role, perms, parent);
  const legacy = PAGE_LEGACY_ROLES[key];
  return !!role && !!legacy && legacy.includes(role);
}

/** True when the role hasn't set this page itself and is following its parent / old default. */
export function pageInherited(perms: PermMap | null | undefined, key: string): boolean {
  return !!perms && perms.all !== true && !(key in perms) && (key in PAGE_PARENT || key in PAGE_LEGACY_ROLES);
}

const ALL: PermMap = { all: true };
const on = (...keys: string[]): PermMap => Object.fromEntries(keys.map(k => [k, true]));

const VIEW_ALL_TABS = [
  'view.tab_overview', 'view.tab_plan_layout', 'view.tab_design_proposal', 'view.tab_construction',
  'view.tab_millwork', 'view.tab_shelving', 'view.tab_ceiling', 'view.tab_image', 'view.tab_decoration',
];

const VIEW_INTERNAL_DOCS = ['view.pf', 'view.po', 'view.production_board'];
const PROGRESS_ALL = ['progress.finalization', 'progress.construction', 'progress.production', 'progress.delivery'];

const PAGES_BASIC = ['page.dashboard', 'page.projects', 'page.approvals', 'page.notifications', 'page.settings'];

export const DEFAULT_PERMISSIONS: Record<string, PermMap> = {
  ops_manager: ALL,

  trustlines_pm: on(...PAGES_BASIC, 'page.clients', 'page.customers', 'page.production', 'page.qc', 'page.logistics', 'page.suppliers', 'page.expenses', 'page.dropbox_wizard',
    'edit.projects',
    'sign.trust_pm', ...VIEW_ALL_TABS, ...VIEW_INTERNAL_DOCS, 'view.prices', ...PROGRESS_ALL,
    'notify.approval_request', 'notify.approval_complete', 'notify.revision', 'notify.hold_t'),

  tlines_pm: on(...PAGES_BASIC, 'page.customers',
    'sign.client_pm', ...VIEW_ALL_TABS, 'view.po', ...PROGRESS_ALL,
    'notify.approval_request', 'notify.approval_complete', 'notify.ready'),

  project_manager: on(...PAGES_BASIC, 'page.production', 'edit.projects',
    'sign.trust_pm', ...VIEW_ALL_TABS, ...VIEW_INTERNAL_DOCS, 'view.prices', ...PROGRESS_ALL, 'notify.approval_request'),

  general_manager: ALL,

  designer: on('page.dashboard', 'page.design', 'page.notifications', 'page.settings'),

  design_lead: on('page.dashboard', 'page.design', 'page.projects', 'page.customers',
    'page.notifications', 'page.settings',
    'view.tab_overview', 'view.tab_plan_layout', 'view.tab_design_proposal', 'view.tab_construction',
    'progress.finalization', 'progress.construction', 'notify.approval_request', 'notify.revision'),

  shop_drawer: on('page.dashboard', 'page.design', 'page.projects', 'page.notifications', 'page.settings',
    'view.tab_overview', 'view.tab_construction', 'view.tab_millwork', 'view.tab_shelving',
    'progress.construction', 'notify.approval_request', 'notify.revision'),

  supply_manager: on(...PAGES_BASIC, 'page.clients', 'page.customers', 'page.production', 'page.qc',
    'page.suppliers', 'page.expenses', 'edit.projects', 'edit.production',
    ...VIEW_ALL_TABS, ...VIEW_INTERNAL_DOCS, 'view.prices', ...PROGRESS_ALL,
    'notify.approval_request', 'notify.approval_complete', 'notify.revision'),
  supply_user: on(...PAGES_BASIC, 'page.production', 'page.suppliers', 'edit.production',
    ...VIEW_ALL_TABS, ...VIEW_INTERNAL_DOCS, 'progress.production', 'notify.approval_request'),

  production_user: on(...PAGES_BASIC, 'page.production', 'edit.production',
    'view.tab_overview', 'view.tab_millwork', 'view.tab_shelving', 'view.tab_ceiling', 'view.tab_image',
    'view.tab_decoration', 'view.pf', 'view.production_board', 'progress.production'),

  warehouse_manager: on(...PAGES_BASIC, 'page.production', 'page.logistics', 'edit.production',
    'view.tab_overview', 'view.production_board', 'progress.production', 'progress.delivery',
    'notify.ready'),
  warehouse_user: on(...PAGES_BASIC, 'page.production', 'page.logistics',
    'view.tab_overview', 'view.production_board', 'progress.delivery'),

  production_manager: on(...PAGES_BASIC, 'page.clients', 'page.production', 'edit.production',
    'sign.production_millwork', 'sign.production_ceiling',
    'view.tab_overview', 'view.tab_millwork', 'view.tab_shelving', 'view.tab_ceiling', 'view.tab_image',
    'view.tab_decoration', 'view.pf', 'view.po', 'view.production_board',
    'progress.production', 'progress.delivery', 'notify.approval_request'),

  pm_millwork: on(...PAGES_BASIC, 'page.clients', 'page.production', 'page.qc', 'edit.production',
    'sign.production_millwork',
    'view.tab_overview', 'view.tab_millwork', 'view.tab_shelving', 'view.pf', 'view.po', 'view.production_board',
    'progress.production', 'notify.approval_request'),

  pm_ceiling: on(...PAGES_BASIC, 'page.clients', 'page.production', 'page.qc', 'edit.production',
    'sign.production_ceiling',
    'view.tab_overview', 'view.tab_ceiling', 'view.tab_image', 'view.tab_decoration', 'view.pf', 'view.po', 'view.production_board',
    'progress.production', 'notify.approval_request'),

  accountant: on(...PAGES_BASIC, 'page.production', 'page.suppliers', 'page.expenses',
    'sign.accountant', 'view.tab_overview', 'view.po', 'view.pf', 'view.prices', 'view.production_board',
    'progress.production', 'progress.delivery', 'notify.payment', 'notify.approval_request'),
  accounting: on(...PAGES_BASIC, 'page.production', 'page.suppliers', 'page.expenses',
    'sign.accountant', 'view.tab_overview', 'view.po', 'view.pf', 'view.prices', 'view.production_board',
    'progress.production', 'progress.delivery', 'notify.payment'),

  qc_responsible: on(...PAGES_BASIC, 'page.production', 'page.qc',
    'view.tab_overview', 'view.production_board', 'progress.production', 'progress.delivery'),
  logistics:      on(...PAGES_BASIC, 'page.production', 'page.logistics',
    'view.tab_overview', 'view.production_board', 'progress.delivery', 'notify.ready'),

  sales_marketing_manager: on('page.dashboard', 'page.customers', 'edit.customers', 'page.design'),
  sales_rep:               on('page.dashboard', 'page.customers', 'edit.customers', 'page.design'),

  marketing_pr: on('page.dashboard', 'page.marketing', 'page.marketing_campaigns', 'page.notifications', 'page.settings', 'edit.marketing'),
  marketing_manager: on('page.dashboard', 'page.marketing', 'page.marketing_campaigns', 'page.notifications', 'page.settings', 'edit.marketing'),
};

export function effectivePermissions(roleName: string, stored: PermMap | null | undefined): PermMap {
  if (stored && Object.keys(stored).length) return stored;
  return DEFAULT_PERMISSIONS[roleName] ?? {};
}
