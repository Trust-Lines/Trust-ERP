// IT tickets and equipment: who may do what, and the reads the IT pages share (migration 155).
// Service-role client only after the checks below — RLS has no policies on these tables.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { notifyUsers } from '@/lib/events/notify';
import {
  COMPUTER_CATEGORIES,
  SPEC_KEYS,
  SPEC_LABEL,
  TICKET_CATEGORY_LABEL,
  ticketCategoryTone,
  type ItemCategory,
  type ItemStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from './constants';
import type { ItemInput } from './validate';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ItContext {
  userId: string;
  role: string | null;
  admin: any;
  /** page.it_requests — send and follow your own tickets. */
  canRequest: boolean;
  /** page.it — every ticket, the Items Library and IT staff. */
  canManage: boolean;
  /** edit.it — close tickets, Access Computer, add / edit / delete items. */
  canEdit: boolean;
}

export async function itContext(): Promise<ItContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  const canManage = pageAllowed(role, perms, 'page.it');
  return {
    userId: user.id, role, admin,
    canRequest: pageAllowed(role, perms, 'page.it_requests'),
    canManage,
    canEdit: canManage && pageAllowed(role, perms, 'edit.it'),
  };
}

/** API guard: 401 / 403 JSON unless `need` holds for the signed-in user. */
export async function itApi(need: 'request' | 'manage' | 'edit'): Promise<{ ctx: ItContext; deny: null } | { ctx: null; deny: NextResponse }> {
  const ctx = await itContext();
  if (!ctx) return { ctx: null, deny: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = need === 'request' ? ctx.canRequest || ctx.canManage : need === 'manage' ? ctx.canManage : ctx.canEdit;
  if (!allowed) return { ctx: null, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ctx, deny: null };
}

// ── Rows ────────────────────────────────────────────────────────────────────────────────────────

export interface TicketFile { id: string; name: string; path: string; size: number; type: string }

export interface TicketRow {
  id: string;
  requester_id: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string | null;
  needed_by: string | null;
  files: TicketFile[] | null;
  status: TicketStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const TICKET_COLS = 'id, requester_id, subject, category, priority, description, needed_by, files, status, resolution_note, resolved_by, resolved_at, created_at, updated_at';

export interface ItemRow {
  id: string;
  name: string;
  model: string | null;
  category: ItemCategory;
  location: string | null;
  status: ItemStatus;
  assignee_id: string | null;
  assigned_at: string | null;
  set_label: string | null;
  notes: string | null;
  specs: Record<string, string> | null;
  remote_address: string | null;
  image_path: string | null;
  image_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ITEM_COLS = 'id, name, model, category, location, status, assignee_id, assigned_at, set_label, notes, specs, remote_address, image_path, image_updated_at, created_at, updated_at';

interface Person { id: string; full_name: string | null; email: string | null; role: string | null }

async function people(admin: any, ids: (string | null)[]): Promise<Map<string, Person>> {
  const want = [...new Set(ids.filter((v): v is string => !!v))];
  if (!want.length) return new Map();
  const { data } = await admin.from('profiles').select('id, full_name, email, role').in('id', want);
  return new Map(((data ?? []) as Person[]).map(p => [p.id, p]));
}

const nameOf = (p: Person | undefined) => p?.full_name || p?.email || 'Unknown';

// ── Tickets ─────────────────────────────────────────────────────────────────────────────────────

export interface TicketListItem {
  id: string;
  subject: string;
  requesterName: string;
  /** Role key; the screen turns it into a label. */
  requesterRole: string;
  priority: TicketPriority;
  status: 'active' | 'closed';
  categoryLabel: string;
  categoryTone: 'success' | 'teal' | 'neutral';
  neededBy: string | null;
  createdAt: string;
}

/** Every ticket for IT, otherwise the person's own. Newest first, at most 500. */
export async function loadTickets(ctx: ItContext): Promise<{ tickets: TicketListItem[]; error: string | null }> {
  let q = ctx.admin.from('it_tickets').select(TICKET_COLS).order('created_at', { ascending: false }).limit(500);
  if (!ctx.canManage) q = q.eq('requester_id', ctx.userId);
  const { data, error } = await q;
  if (error) return { tickets: [], error: /it_tickets/.test(error.message) ? 'IT tickets are not set up yet — run migration 155_it_tickets_items.sql.' : error.message };
  const rows = (data ?? []) as TicketRow[];
  const who = await people(ctx.admin, rows.map(r => r.requester_id));
  return {
    error: null,
    tickets: rows.map(r => ({
      id: r.id,
      subject: r.subject,
      requesterName: nameOf(who.get(r.requester_id ?? '')),
      requesterRole: who.get(r.requester_id ?? '')?.role ?? '',
      priority: r.priority,
      status: r.status === 'open' ? 'active' : 'closed',
      categoryLabel: TICKET_CATEGORY_LABEL[r.category] ?? r.category,
      categoryTone: ticketCategoryTone(r.category),
      neededBy: r.needed_by,
      createdAt: r.created_at,
    })),
  };
}

/** The ticket when `ctx` may see it (IT, or the person who sent it), else null. */
export async function ticketFor(ctx: ItContext, id: string): Promise<TicketRow | null> {
  const { data } = await ctx.admin.from('it_tickets').select(TICKET_COLS).eq('id', id).maybeSingle();
  const row = data as TicketRow | null;
  if (!row) return null;
  if (!ctx.canManage && row.requester_id !== ctx.userId) return null;
  return row;
}

export interface TicketDetail {
  id: string;
  subject: string;
  createdAt: string;
  priority: TicketPriority;
  categoryLabel: string;
  categoryTone: 'success' | 'teal' | 'neutral';
  requesterId: string | null;
  requesterName: string;
  requesterRole: string;
  description: string;
  details: { label: string; value: string | null }[];
  resolution: 'open' | 'solved' | 'not_solved';
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  attachments: { id: string; name: string; errorCode: string | null; downloadUrl: string | null }[];
  /** The requester's computer with a remote address — what "Access Computer" connects to. */
  remote: { itemId: string; name: string } | null;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null);

export async function loadTicketDetail(ctx: ItContext, id: string): Promise<TicketDetail | null> {
  const row = await ticketFor(ctx, id);
  if (!row) return null;
  const who = await people(ctx.admin, [row.requester_id, row.resolved_by]);
  const requester = who.get(row.requester_id ?? '');

  // What the requester holds: computer for Access Computer, location for the details grid.
  let held: ItemRow[] = [];
  if (row.requester_id) {
    const { data } = await ctx.admin.from('it_items').select(ITEM_COLS)
      .eq('assignee_id', row.requester_id).eq('status', 'assigned').is('deleted_at', null).limit(50);
    held = (data ?? []) as ItemRow[];
  }
  const computers = held.filter(i => COMPUTER_CATEGORIES.includes(i.category));
  const remoteItem = computers.find(i => i.remote_address);
  const location = held.find(i => i.location)?.location ?? null;

  return {
    id: row.id,
    subject: row.subject,
    createdAt: row.created_at,
    priority: row.priority,
    categoryLabel: TICKET_CATEGORY_LABEL[row.category] ?? row.category,
    categoryTone: ticketCategoryTone(row.category),
    requesterId: row.requester_id,
    requesterName: nameOf(requester),
    requesterRole: requester?.role ?? '',
    description: row.description ?? '',
    details: [
      { label: 'Email', value: requester?.email ?? null },
      { label: 'Location', value: location },
      { label: 'Computer', value: computers.map(c => c.name).join(', ') || null },
      { label: 'Sent', value: fmtDate(row.created_at) },
      { label: 'Needed by', value: fmtDate(row.needed_by) },
      { label: row.status === 'open' ? 'Status' : 'Closed', value: row.status === 'open' ? 'Waiting for IT' : fmtDate(row.resolved_at) },
    ],
    resolution: row.status,
    resolutionNote: row.resolution_note,
    resolvedByName: row.resolved_by ? nameOf(who.get(row.resolved_by)) : null,
    resolvedAt: row.resolved_at,
    attachments: (row.files ?? []).map(f => ({
      id: f.id, name: f.name, errorCode: null,
      downloadUrl: `/api/it/tickets/${row.id}/files/${f.id}`,
    })),
    remote: ctx.canEdit && remoteItem ? { itemId: remoteItem.id, name: remoteItem.name } : null,
  };
}

/** Everyone who handles IT tickets (edit.it), for the "new ticket" notification. */
export async function itHandlers(admin: any): Promise<string[]> {
  const { data } = await admin.from('profiles').select('id, role').eq('is_active', true).limit(1000);
  const rows = (data ?? []) as { id: string; role: string | null }[];
  const byRole = new Map<string, boolean>();
  for (const role of new Set(rows.map(r => r.role).filter((r): r is string => !!r))) {
    const perms = await getRolePermissions(admin, role);
    byRole.set(role, pageAllowed(role, perms, 'page.it') && pageAllowed(role, perms, 'edit.it'));
  }
  return rows.filter(r => r.role && byRole.get(r.role)).map(r => r.id);
}

export async function notifyTicket(admin: any, p: { userIds: (string | null)[]; actorId: string; title: string; body: string; ticketId: string; type: string }) {
  await notifyUsers(admin, {
    userIds: p.userIds, projectId: null, type: p.type, title: p.title, body: p.body,
    link: `/it/tickets/${p.ticketId}`, actorId: p.actorId,
  });
}

// ── Items ───────────────────────────────────────────────────────────────────────────────────────

export interface ItemCard {
  id: string;
  name: string;
  model: string | null;
  category: ItemCategory;
  addedAt: string;
  setLabel: string | null;
  location: string | null;
  status: ItemStatus;
  assigneeName: string | null;
  imageUrl: string | null;
}

export const itemImageUrl = (r: ItemRow) =>
  r.image_path ? `/api/it/items/${r.id}/image?v=${Date.parse(r.image_updated_at ?? r.updated_at) || 0}` : null;

function toCard(r: ItemRow, who: Map<string, Person>): ItemCard {
  return {
    id: r.id, name: r.name, model: r.model, category: r.category, addedAt: r.created_at,
    setLabel: r.set_label, location: r.location, status: r.status,
    assigneeName: r.status === 'assigned' ? nameOf(who.get(r.assignee_id ?? '')) : null,
    imageUrl: itemImageUrl(r),
  };
}

export async function loadItems(ctx: ItContext): Promise<{ items: ItemCard[]; error: string | null }> {
  const { data, error } = await ctx.admin.from('it_items').select(ITEM_COLS).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(2000);
  if (error) return { items: [], error: /it_items/.test(error.message) ? 'IT items are not set up yet — run migration 155_it_tickets_items.sql.' : error.message };
  const rows = (data ?? []) as ItemRow[];
  const who = await people(ctx.admin, rows.map(r => r.assignee_id));
  return { items: rows.map(r => toCard(r, who)), error: null };
}

export interface ItemDetail extends ItemCard {
  updatedAt: string | null;
  notes: string | null;
  specs: { key: string; label: string; value: string }[];
  assignee: { name: string; role: string | null; acquiredAt: string | null } | null;
  groupedWith: ItemCard[];
  /** Raw values for the Edit form. */
  form: {
    assigneeId: string | null;
    remoteAddress: string | null;
    specs: Record<string, string>;
  };
}

export async function loadItemDetail(ctx: ItContext, id: string): Promise<ItemDetail | null> {
  const { data } = await ctx.admin.from('it_items').select(ITEM_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  const row = data as ItemRow | null;
  if (!row) return null;
  let group: ItemRow[] = [];
  if (row.set_label) {
    const { data: g } = await ctx.admin.from('it_items').select(ITEM_COLS).eq('set_label', row.set_label)
      .is('deleted_at', null).neq('id', row.id).limit(50);
    group = (g ?? []) as ItemRow[];
  }
  const who = await people(ctx.admin, [row.assignee_id, ...group.map(g => g.assignee_id)]);
  const holder = row.status === 'assigned' ? who.get(row.assignee_id ?? '') : undefined;
  const specs = row.specs ?? {};
  return {
    ...toCard(row, who),
    updatedAt: row.updated_at,
    notes: row.notes,
    specs: SPEC_KEYS.filter(k => specs[k]).map(k => ({ key: k, label: SPEC_LABEL[k], value: specs[k] })),
    assignee: row.status === 'assigned' ? { name: nameOf(holder), role: holder?.role ?? null, acquiredAt: row.assigned_at } : null,
    groupedWith: group.map(g => toCard(g, who)),
    form: { assigneeId: row.assignee_id, remoteAddress: row.remote_address, specs },
  };
}

/** For IT → Staff Members: per person, the office and the items they hold. */
export async function loadStaffItems(ctx: ItContext): Promise<Map<string, { location: string | null; items: { id: string; label: string; isSet: boolean }[] }>> {
  const { data } = await ctx.admin.from('it_items').select('id, name, set_label, location, assignee_id')
    .eq('status', 'assigned').is('deleted_at', null).not('assignee_id', 'is', null).limit(3000);
  const out = new Map<string, { location: string | null; items: { id: string; label: string; isSet: boolean }[] }>();
  for (const r of (data ?? []) as { id: string; name: string; set_label: string | null; location: string | null; assignee_id: string }[]) {
    const e = out.get(r.assignee_id) ?? { location: null, items: [] };
    if (!e.location && r.location) e.location = r.location;
    // A set shows once ("PC 1"), not once per piece in it.
    if (r.set_label) {
      if (!e.items.some(i => i.isSet && i.label === r.set_label)) e.items.push({ id: r.id, label: r.set_label, isSet: true });
    } else {
      e.items.push({ id: r.id, label: r.name, isSet: false });
    }
    out.set(r.assignee_id, e);
  }
  return out;
}

/** Active people IT can assign items to. */
export async function loadAssignees(ctx: ItContext): Promise<{ id: string; name: string }[]> {
  const { data } = await ctx.admin.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name').limit(1000);
  return ((data ?? []) as { id: string; full_name: string | null; email: string | null }[])
    .map(p => ({ id: p.id, name: p.full_name || p.email || 'Unknown' }));
}

/** An assigned item's holder must be an active person. */
export async function assigneeError(admin: any, input: ItemInput): Promise<string | null> {
  if (input.status !== 'assigned' || !input.assignee_id) return null;
  const { data } = await admin.from('profiles').select('id').eq('id', input.assignee_id).eq('is_active', true).maybeSingle();
  return data ? null : 'That person was not found or is not active';
}

/** IT → Staff member: the items one person holds (newest first). */
export async function loadPersonItems(ctx: ItContext, personId: string): Promise<ItemCard[]> {
  const { data } = await ctx.admin.from('it_items').select(ITEM_COLS).eq('assignee_id', personId)
    .eq('status', 'assigned').is('deleted_at', null).order('assigned_at', { ascending: false, nullsFirst: false }).limit(200);
  const rows = (data ?? []) as ItemRow[];
  const who = await people(ctx.admin, [personId]);
  return rows.map(r => toCard(r, who));
}

/** IT → Staff member: tickets the person sent (newest first, at most 50). */
export async function loadPersonTickets(ctx: ItContext, personId: string): Promise<{ id: string; subject: string; priority: TicketPriority; status: 'active' | 'closed'; categoryLabel: string; categoryTone: 'success' | 'teal' | 'neutral'; createdAt: string }[]> {
  const { data } = await ctx.admin.from('it_tickets').select('id, subject, category, priority, status, created_at')
    .eq('requester_id', personId).order('created_at', { ascending: false }).limit(50);
  return ((data ?? []) as Pick<TicketRow, 'id' | 'subject' | 'category' | 'priority' | 'status' | 'created_at'>[]).map(r => ({
    id: r.id, subject: r.subject, priority: r.priority,
    status: r.status === 'open' ? 'active' as const : 'closed' as const,
    categoryLabel: TICKET_CATEGORY_LABEL[r.category] ?? r.category,
    categoryTone: ticketCategoryTone(r.category),
    createdAt: r.created_at,
  }));
}
