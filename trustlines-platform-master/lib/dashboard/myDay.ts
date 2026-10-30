
import { focusFromMissing, parseQuickView, quickViewLink, type QuickViewTarget } from '@/lib/marketing/quickViewLink';
import { canSeeInternalSupply } from '@/lib/lifecycle/projectLifecycle';
import { skillForType } from '@/lib/team/derive';
import { buildQcQueue, isInspectable, type QcItem, type QcInspection } from '@/lib/qc/queue';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MyDayItem {
  label:    string;
  sublabel?: string;
  href:     string;
  badge?:   string;
  tone?:    'default' | 'warn' | 'danger' | 'good';
  /** Open this deal's quick view in place instead of navigating (lib/marketing/quickViewLink.ts). */
  quickView?: QuickViewTarget;
  /** The notifications row behind this item (marked read when opened). */
  notificationId?: string;
}

export interface MyDaySection {
  key:   string;
  title: string;
  items: MyDayItem[];
}

export interface MyDayData {
  role:     string;
  sections: MyDaySection[];
}

export type SectionKey =
  | 'signatures'
  | 'notifications'
  | 'assigned_to_me'
  | 'qc_queue'
  | 'overdue_followups'
  | 'site_not_ready'
  | 'open_crs'
  | 'vendor_needed'
  | 'items_on_hold'
  | 'open_containers'
  | 'my_design_jobs'
  | 'unpaid_invoices'
  | 'waiting_payment'
  | 'prospects_assigned'
  | 'potentials_due'
  | 'nurture_overdue'
  | 'handoffs_waiting';

export const PRICEY_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  'vendor_needed', 'items_on_hold', 'unpaid_invoices', 'waiting_payment',
]);

export const SECTIONS_FOR_ROLE: Record<string, SectionKey[]> = {
  tlines_pm: ['signatures', 'notifications', 'overdue_followups', 'site_not_ready', 'open_crs'],
  designer:  ['signatures', 'notifications', 'my_design_jobs', 'assigned_to_me'],
  sales_rep: ['signatures', 'notifications'],
  sales_marketing_manager: ['signatures', 'notifications'],

  design_lead: ['signatures', 'notifications', 'my_design_jobs', 'assigned_to_me'],
  shop_drawer: ['signatures', 'notifications', 'assigned_to_me'],

  trustlines_pm:      ['signatures', 'notifications', 'open_crs', 'assigned_to_me', 'vendor_needed'],
  project_manager:    ['signatures', 'notifications', 'open_crs', 'assigned_to_me', 'vendor_needed'],
  production_manager: ['signatures', 'notifications', 'assigned_to_me', 'vendor_needed', 'items_on_hold'],
  production_user:    ['signatures', 'notifications', 'assigned_to_me', 'items_on_hold'],
  pm_millwork:        ['signatures', 'notifications', 'vendor_needed', 'items_on_hold'],
  pm_ceiling:         ['signatures', 'notifications', 'vendor_needed', 'items_on_hold'],
  supply_manager:     ['signatures', 'notifications', 'assigned_to_me', 'vendor_needed', 'items_on_hold'],
  supply_user:        ['signatures', 'notifications', 'assigned_to_me', 'vendor_needed'],
  qc_responsible:     ['signatures', 'notifications', 'qc_queue', 'assigned_to_me'],
  warehouse_manager:  ['signatures', 'notifications', 'assigned_to_me', 'open_containers'],
  warehouse_user:     ['signatures', 'notifications', 'assigned_to_me', 'open_containers'],
  logistics:          ['signatures', 'notifications', 'open_containers'],
  accounting:         ['signatures', 'notifications', 'unpaid_invoices', 'waiting_payment'],
  accountant:         ['signatures', 'notifications', 'unpaid_invoices', 'waiting_payment'],
  ops_manager:        ['signatures', 'notifications', 'open_crs', 'assigned_to_me', 'qc_queue', 'vendor_needed', 'items_on_hold', 'open_containers'],
  general_manager:    ['signatures', 'notifications', 'open_crs', 'assigned_to_me', 'qc_queue', 'vendor_needed', 'items_on_hold', 'open_containers'],

  marketing_pr:      ['signatures', 'notifications', 'prospects_assigned', 'potentials_due', 'nurture_overdue', 'handoffs_waiting'],
  marketing_manager: ['signatures', 'notifications', 'prospects_assigned', 'potentials_due', 'nurture_overdue', 'handoffs_waiting'],
};

export function sectionsForRole(role: string | null | undefined): SectionKey[] {
  const base = (role && SECTIONS_FOR_ROLE[role]) || ['signatures', 'notifications'];
  if (canSeeInternalSupply(role)) return base;
  return base.filter(k => !PRICEY_SECTIONS.has(k));
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const POTENTIALS_DUE_WINDOW_DAYS = 7;

async function buildSignatures(admin: any, userId: string): Promise<MyDaySection> {
  const { data } = await admin.from('document_approvals')
    .select('id, doc_type, project_id').eq('assigned_to', userId).eq('status', 'pending').limit(50) as {
      data: { id: string; doc_type: string | null; project_id: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'signatures', title: 'Waiting for your signature',
    items: rows.length === 0 ? [] : [{
      label: `${rows.length} document${rows.length === 1 ? '' : 's'} awaiting your approval`,
      href: '/approvals', badge: String(rows.length), tone: rows.length ? 'warn' : 'default',
    }],
  };
}

const INBOX_SIZE = 8;

async function buildNotifications(admin: any, userId: string): Promise<MyDaySection> {
  // A few extra rows: the ones whose record was deleted are dropped below.
  const { data } = await admin.from('notifications')
    .select('id, type, title, link, created_at').eq('user_id', userId).eq('is_read', false)
    .order('created_at', { ascending: false }).limit(INBOX_SIZE * 3) as {
      data: { id: string; type: string; title: string; link: string | null; created_at: string }[] | null;
    };
  const rows = data ?? [];

  const targets = new Map<string, QuickViewTarget | null>();
  for (const n of rows) {
    let quickView = parseQuickView(n.link);
    // Older "<name> needs region/state" notifications only linked to the Sales CRM board ('/leads',
    // which Marketing can't open): find the deal by the name in the title.
    if (!quickView && n.type === 'survey.incomplete_submission') quickView = await findIncompleteDeal(admin, n.title);
    targets.set(n.id, quickView);
  }

  // Does each linked deal still exist? (One query per kind.)
  const live = new Set<string>();
  for (const [kind, table] of [['opportunity', 'opportunities'], ['potential', 'prospect_potentials']] as const) {
    const ids = [...targets.values()].filter(t => t?.kind === kind).map(t => t!.id);
    if (!ids.length) continue;
    const { data: found } = await admin.from(table).select('id').in('id', ids).is('deleted_at', null);
    for (const r of (found ?? []) as { id: string }[]) live.add(r.id);
  }

  // A deal notification whose record is gone is not shown, and is marked read so it doesn't
  // linger on the Notifications page either.
  const gone = rows.filter(n => {
    const t = targets.get(n.id);
    return t ? !live.has(t.id) : n.type === 'survey.incomplete_submission';
  });
  if (gone.length) await admin.from('notifications').update({ is_read: true }).in('id', gone.map(n => n.id));
  const goneIds = new Set(gone.map(n => n.id));

  const items: MyDayItem[] = rows.filter(n => !goneIds.has(n.id)).slice(0, INBOX_SIZE).map(n => {
    const quickView = targets.get(n.id) ?? null;
    return {
      label: n.title, notificationId: n.id, quickView: quickView ?? undefined,
      href: quickView ? quickViewLink(quickView.kind, quickView.id, quickView.focus) : (n.link ?? '/notifications'),
    };
  });
  return { key: 'notifications', title: 'Unread notifications', items };
}

/** "<name> needs …" → that Prospect's newest open Opportunity (else Potential), plus the fields to fill. */
async function findIncompleteDeal(admin: any, title: string): Promise<QuickViewTarget | null> {
  const m = title.match(/^(.*?)\s+needs\s+(.+)$/i);
  if (!m) return null;
  const { data: prospects } = await admin.from('prospects').select('id')
    .ilike('display_name', m[1].replace(/[%_\\]/g, ch => `\\${ch}`)).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1);
  const prospectId = (prospects as { id: string }[] | null)?.[0]?.id;
  if (!prospectId) return null;
  const focus = focusFromMissing(m[2]);
  const { data: opp } = await admin.from('opportunities').select('id').eq('prospect_id', prospectId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1);
  if (opp?.[0]?.id) return { kind: 'opportunity', id: opp[0].id, focus };
  const { data: pot } = await admin.from('prospect_potentials').select('id').eq('prospect_id', prospectId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1);
  return pot?.[0]?.id ? { kind: 'potential', id: pot[0].id, focus } : null;
}

async function myProjects(admin: any, userId: string, slot: 'tlines_pm_id' | 'trustlines_pm_id'): Promise<{ id: string; code: string; name: string }[]> {
  const { data } = await admin.from('projects')
    .select('id, code, name').eq(slot, userId).eq('is_archived', false).limit(100) as {
      data: { id: string; code: string; name: string }[] | null;
    };
  return data ?? [];
}

async function buildOverdueFollowups(admin: any, userId: string): Promise<MyDaySection> {
  const { data } = await admin.from('customer_follow_ups')
    .select('id, note, due_date, project_id').eq('assignee_id', userId).eq('status', 'open')
    .lt('due_date', todayIso()).order('due_date', { ascending: true }).limit(20) as {
      data: { id: string; note: string; due_date: string; project_id: string | null }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'overdue_followups', title: 'Overdue follow-ups',
    items: rows.map(f => ({
      label: f.note, sublabel: `due ${f.due_date}`,
      href: f.project_id ? `/projects/${f.project_id}/finalization` : '/customers',
      tone: 'danger' as const,
    })),
  };
}

async function buildSiteNotReady(admin: any, userId: string): Promise<MyDaySection> {
  const projects = await myProjects(admin, userId, 'tlines_pm_id');
  if (!projects.length) return { key: 'site_not_ready', title: 'Sites not ready', items: [] };
  const ids = projects.map(p => p.id);
  const { data } = await admin.from('site_readiness')
    .select('project_id, overall_status').in('project_id', ids).limit(100) as {
      data: { project_id: string; overall_status: string }[] | null;
    };
  const byProject = new Map((data ?? []).map(s => [s.project_id, s.overall_status]));
  return {
    key: 'site_not_ready', title: 'Sites not ready',
    items: projects
      .filter(p => (byProject.get(p.id) ?? 'not_ready') !== 'ready')
      .map(p => ({ label: p.code, sublabel: byProject.get(p.id) ? byProject.get(p.id)!.replace(/_/g, ' ') : 'not started', href: `/projects/${p.id}/finalization`, tone: 'warn' as const })),
  };
}

async function buildOpenCRs(admin: any, userId: string, slot: 'tlines_pm_id' | 'trustlines_pm_id'): Promise<MyDaySection> {
  const projects = await myProjects(admin, userId, slot);
  if (!projects.length) return { key: 'open_crs', title: 'Open change requests', items: [] };
  const byId = new Map(projects.map(p => [p.id, p]));
  const { data } = await admin.from('change_requests')
    .select('id, title, project_id, status').in('project_id', [...byId.keys()])
    .in('status', ['open', 'under_review']).is('deleted_at', null).limit(50) as {
      data: { id: string; title: string; project_id: string; status: string }[] | null;
    };
  return {
    key: 'open_crs', title: 'Open change requests',
    items: (data ?? []).map(cr => ({
      label: cr.title, sublabel: byId.get(cr.project_id)?.code,
      href: `/projects/${cr.project_id}/finalization`, tone: 'warn' as const,
    })),
  };
}

async function buildVendorNeeded(admin: any): Promise<MyDaySection> {
  const { data } = await admin.from('production_items')
    .select('id, type, project_id, po_sign_status').eq('source', 'project').is('vendor_id', null).is('deleted_at', null)
    .eq('po_sign_status', 'SIGNED').limit(50) as {
      data: { id: string; type: string; project_id: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'vendor_needed', title: 'Types awaiting a vendor',
    items: rows.map(i => ({ label: `${i.type} — assign a vendor`, href: `/projects/${i.project_id}/types`, tone: 'warn' as const })),
  };
}

async function buildItemsOnHold(admin: any): Promise<MyDaySection> {
  const { data } = await admin.from('production_items')
    .select('id, type, project_id, status').eq('source', 'project').in('status', ['HOLD_T', 'HOLD_PM']).is('deleted_at', null).limit(50) as {
      data: { id: string; type: string; project_id: string; status: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'items_on_hold', title: 'Items on hold',
    items: rows.map(i => ({ label: `${i.type} (${i.status.replace('_', '/')})`, href: `/projects/${i.project_id}/types`, tone: 'danger' as const })),
  };
}

async function buildOpenContainers(admin: any): Promise<MyDaySection> {
  const { data } = await admin.from('containers')
    .select('id, container_no, status, estimated_arrival_date').is('deleted_at', null)
    .not('status', 'in', '(COMPLETED,CANCELLED)').order('estimated_arrival_date', { ascending: true, nullsFirst: false }).limit(30) as {
      data: { id: string; container_no: string | null; status: string; estimated_arrival_date: string | null }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'open_containers', title: 'Containers in transit',
    items: rows.map(c => ({
      label: c.container_no ?? 'Container', sublabel: c.status.replace(/_/g, ' '),
      href: '/logistics', badge: c.estimated_arrival_date ? `ETA ${c.estimated_arrival_date}` : undefined,
    })),
  };
}

async function buildMyDesignJobs(admin: any, userId: string): Promise<MyDaySection> {
  const { data } = await admin.from('sales_design_jobs')
    .select('id, title, status').eq('assigned_designer_id', userId).is('deleted_at', null)
    .in('status', ['assigned', 'working_on_it', 'revision_requested']).limit(30) as {
      data: { id: string; title: string; status: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'my_design_jobs', title: 'My design jobs',
    items: rows.map(j => ({ label: j.title, sublabel: j.status.replace(/_/g, ' '), href: '/design', tone: j.status === 'revision_requested' ? 'warn' : 'default' })),
  };
}

async function buildUnpaidInvoices(admin: any): Promise<MyDaySection> {
  const { data } = await admin.from('supplier_invoices')
    .select('id, invoice_number, project_id, status').in('status', ['unpaid', 'partial']).is('deleted_at', null).limit(50) as {
      data: { id: string; invoice_number: string | null; project_id: string | null; status: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'unpaid_invoices', title: 'Unpaid supplier invoices',
    items: rows.map(inv => ({ label: inv.invoice_number ?? 'Invoice', sublabel: inv.status, href: inv.project_id ? `/projects/${inv.project_id}/finance` : '/suppliers', tone: 'warn' as const })),
  };
}

async function buildWaitingPayment(admin: any): Promise<MyDaySection> {
  const { data } = await admin.from('production_items')
    .select('id, type, project_id').eq('source', 'project').eq('status', 'WAITING_PAYMENT').is('deleted_at', null).limit(50) as {
      data: { id: string; type: string; project_id: string }[] | null;
    };
  const rows = data ?? [];
  return {
    key: 'waiting_payment', title: 'Items awaiting payment',
    items: rows.map(i => ({ label: i.type, href: `/projects/${i.project_id}/finance`, tone: 'warn' as const })),
  };
}

async function buildAssignedToMe(admin: any, userId: string): Promise<MyDaySection> {
  const { data: me } = await admin.from('profiles').select('skills').eq('id', userId).maybeSingle() as {
    data: { skills: string[] | null } | null;
  };
  const mySkills = new Set((me?.skills ?? []).filter(Boolean));
  if (mySkills.size === 0) return { key: 'assigned_to_me', title: 'Assigned to me', items: [] };

  const { data: projects } = await admin.from('projects')
    .select('id, code, categories').eq('is_draft', false).eq('is_archived', false).limit(300) as {
      data: { id: string; code: string; categories: string[] | null }[] | null;
    };

  const items: MyDayItem[] = [];
  for (const p of projects ?? []) {
    const matched = [...new Set((p.categories ?? [])
      .map(c => skillForType(c))
      .filter((s): s is NonNullable<typeof s> => !!s && mySkills.has(s)))];
    if (matched.length === 0) continue;
    items.push({
      label: p.code, sublabel: `needs ${matched.join(', ')}`,
      href: `/projects/${p.id}`,
    });
    if (items.length >= 20) break;
  }
  return { key: 'assigned_to_me', title: 'Projects needing your skills', items };
}

async function buildQcSection(admin: any, userId: string): Promise<MyDaySection> {
  const [itemsRes, inspRes] = await Promise.all([
    admin.from('production_items')
      .select('id, project_id, type, status').is('deleted_at', null)
      .in('status', ['RECEIVED', 'READY', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT']).limit(500),
    admin.from('qc_checklists')
      .select('id, project_id, production_item_id, overall_result, conducted_by, conducted_at, rework_of_id')
      .is('deleted_at', null).limit(1000),
  ]);
  const items = (itemsRes.error ? [] : (itemsRes.data ?? [])) as QcItem[];
  const inspections = (inspRes.error ? [] : (inspRes.data ?? [])) as QcInspection[];
  const q = buildQcQueue(items, inspections, userId);

  const items_: MyDayItem[] = [];
  if (q.readyForQc.length) {
    items_.push({ label: `${q.readyForQc.length} item${q.readyForQc.length === 1 ? '' : 's'} ready for inspection`, href: '/qc', badge: String(q.readyForQc.length), tone: 'warn' });
  }
  for (const r of q.myInspections) {
    items_.push({ label: `${r.type ?? 'Item'} — finish your inspection`, href: '/qc', tone: 'default' });
  }
  if (q.rework.length) {
    items_.push({ label: `${q.rework.length} item${q.rework.length === 1 ? '' : 's'} to re-inspect`, href: '/qc', badge: String(q.rework.length), tone: 'danger' });
  }
  void isInspectable;
  return { key: 'qc_queue', title: 'Quality control', items: items_ };
}

function pendingSection(key: SectionKey, title: string, note: string, phase: string): MyDaySection {
  return {
    key, title,
    items: [{ label: note, sublabel: `Coming in ${phase}`, href: '/marketing', tone: 'default' }],
  };
}

async function buildProspectsAssigned(admin: any, userId: string): Promise<MyDaySection> {
  // 🔴 2026-09-17: .limit(20) here was a genuine display cap on a section the UI shows as
  // "20 of 20" with no way to see the rest — the account this ran under owns/is assigned
  // thousands of Contacts (ran the ClickUp imports), so this silently hid almost all of it.
  // The dashboard now paginates ("Load More", 20 at a time) client-side instead, so this
  // needs to actually fetch everything — PostgREST caps any single request at 1000 rows
  // regardless of .limit() (this exact module's own well-known gotcha), so page through with
  // .range() instead of one big .limit().
  type ProspectAssignedRow = { id: string; organization_name: string; status: string };
  const rows: ProspectAssignedRow[] = [];
  let queryError: unknown = null;
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data: page, error } = await admin.from('prospects')
      .select('id, organization_name, status')
      .is('deleted_at', null).eq('is_archived', false)
      .or(`created_by.eq.${userId},assigned_marketing_user_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + 999) as { data: ProspectAssignedRow[] | null; error: unknown };
    if (error) { queryError = error; break; }
    rows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  if (queryError) return pendingSection('prospects_assigned', 'My Leads', 'Lead Cloud is not ready yet', 'Phase 00.3');
  return {
    key: 'prospects_assigned', title: 'My Leads',
    items: rows.map(p => ({
      label: p.organization_name, sublabel: p.status.replace(/_/g, ' '),
      href: `/marketing/prospects/${p.id}`,
    })),
  };
}
async function buildPotentialsDue(admin: any, userId: string): Promise<MyDaySection> {
  const { data, error } = await admin.from('prospect_potentials')
    .select('id, need_id, prospect_id, title, target_contact_date')
    .eq('assigned_to', userId).is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)')
    .order('target_contact_date', { ascending: true }).limit(50) as {
      data: { id: string; need_id: string; prospect_id: string; title: string; target_contact_date: string | null }[] | null; error: unknown;
    };
  if (error) return pendingSection('potentials_due', 'Potentials due for contact', 'Potential/nurture tracking is not ready yet', 'Phase 00.4');
  const today = todayIso();
  const horizon = addDaysIso(POTENTIALS_DUE_WINDOW_DAYS);
  const due = (data ?? []).filter(p => p.target_contact_date && p.target_contact_date >= today && p.target_contact_date <= horizon);
  return {
    key: 'potentials_due', title: 'Potentials due for contact',
    items: due.map(p => ({
      label: p.title, sublabel: `Contact by ${p.target_contact_date}`,
      href: `/marketing/prospects/${p.prospect_id}`,
      tone: p.target_contact_date === today ? 'warn' : 'default',
    })),
  };
}

async function buildNurtureOverdue(admin: any, userId: string): Promise<MyDaySection> {
  const { data, error } = await admin.from('prospect_potentials')
    .select('id, need_id, prospect_id, title, target_contact_date')
    .eq('assigned_to', userId).is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)')
    .order('target_contact_date', { ascending: true }).limit(50) as {
      data: { id: string; need_id: string; prospect_id: string; title: string; target_contact_date: string | null }[] | null; error: unknown;
    };
  if (error) return pendingSection('nurture_overdue', 'Overdue nurture follow-ups', 'Nurture reminders are not ready yet', 'Phase 00.4');
  const today = todayIso();
  const overdue = (data ?? []).filter(p => p.target_contact_date && p.target_contact_date < today);
  return {
    key: 'nurture_overdue', title: 'Overdue nurture follow-ups',
    items: overdue.map(p => ({
      label: p.title, sublabel: `Was due ${p.target_contact_date}`,
      href: `/marketing/prospects/${p.prospect_id}`, tone: 'danger',
    })),
  };
}
async function buildHandoffsWaiting(admin: any, userId: string): Promise<MyDaySection> {
  const { data, error } = await admin.from('opportunities')
    .select('id, prospect_id, title, return_reason')
    .eq('marketing_owner_id', userId).eq('stage', 'marketing_qualification').is('deleted_at', null)
    .order('updated_at', { ascending: false }).limit(50) as {
      data: { id: string; prospect_id: string; title: string; return_reason: string | null }[] | null; error: unknown;
    };
  if (error) return pendingSection('handoffs_waiting', 'Opportunity handoffs waiting on Marketing', 'Sales handoff is not ready yet', 'Phase 00.5');
  const returned = (data ?? []).filter(o => o.return_reason);
  return {
    key: 'handoffs_waiting', title: 'Opportunity handoffs waiting on Marketing',
    items: returned.map(o => ({
      label: o.title, sublabel: `Returned by Sales: ${o.return_reason}`,
      href: `/marketing/prospects/${o.prospect_id}`, tone: 'warn',
    })),
  };
}

const BUILDERS: Record<SectionKey, (admin: any, userId: string) => Promise<MyDaySection>> = {
  signatures:        (a, u) => buildSignatures(a, u),
  notifications:     (a, u) => buildNotifications(a, u),
  assigned_to_me:    (a, u) => buildAssignedToMe(a, u),
  qc_queue:          (a, u) => buildQcSection(a, u),
  overdue_followups: (a, u) => buildOverdueFollowups(a, u),
  site_not_ready:    (a, u) => buildSiteNotReady(a, u),
  open_crs:          (a, u) => buildOpenCRs(a, u, 'tlines_pm_id'),
  vendor_needed:     (a) => buildVendorNeeded(a),
  items_on_hold:     (a) => buildItemsOnHold(a),
  open_containers:   (a) => buildOpenContainers(a),
  my_design_jobs:    (a, u) => buildMyDesignJobs(a, u),
  unpaid_invoices:   (a) => buildUnpaidInvoices(a),
  waiting_payment:   (a) => buildWaitingPayment(a),
  prospects_assigned: (a, u) => buildProspectsAssigned(a, u),
  potentials_due:     (a, u) => buildPotentialsDue(a, u),
  nurture_overdue:    (a, u) => buildNurtureOverdue(a, u),
  handoffs_waiting:   (a, u) => buildHandoffsWaiting(a, u),
};

export async function buildMyDay(admin: any, userId: string, role: string | null | undefined): Promise<MyDayData> {
  const keys = sectionsForRole(role);
  const isTrustSide = role === 'trustlines_pm' || role === 'ops_manager' || role === 'general_manager';

  const sections = await Promise.all(keys.map(async key => {
    try {
      if (key === 'open_crs') return await buildOpenCRs(admin, userId, isTrustSide ? 'trustlines_pm_id' : 'tlines_pm_id');
      return await BUILDERS[key](admin, userId);
    } catch (e) {
      console.error(`[my-day] section ${key} failed:`, e instanceof Error ? e.message : e);
      return { key, title: key, items: [] as MyDayItem[] };
    }
  }));

  return { role: role ?? '', sections };
}
