/* eslint-disable @typescript-eslint/no-explicit-any */

import { logAudit } from '@/lib/audit/log';
import { otherContactOf, planMerge } from './merge';
import type { ImportAction, ImportPerson } from './types';

// Server side of "Import Excel": writes the groups the user approved. Nothing here ever
// overwrites or deletes existing data — a merge only fills EMPTY fields and adds missing
// Contacts / Activity notes.

export interface CommitGroup {
  id: string;
  action: ImportAction;
  targetProspectId?: string | null;
  company: string | null;
  people: ImportPerson[];
}

export interface CommitContext {
  userId: string;
  fileLabel: string;
  campaign: { id: string; name: string; source: string } | null;
}

export interface CommitResult {
  id: string;
  action: ImportAction;
  prospectId: string | null;
  contactsAdded: number;
  error?: string;
}

const clip = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? '').toString().trim();
  return t ? t.slice(0, max) : null;
};

/** Cleans what the browser sent (never trust it): lengths, shapes, list sizes. */
export function sanitizeGroup(raw: any): CommitGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const action = ['create', 'merge', 'skip'].includes(raw.action) ? (raw.action as ImportAction) : null;
  if (!action) return null;
  const people: ImportPerson[] = (Array.isArray(raw.people) ? raw.people : []).slice(0, 30).map((p: any): ImportPerson => ({
    sources: (Array.isArray(p?.sources) ? p.sources : []).slice(0, 12).map((s: unknown) => String(s).slice(0, 160)),
    name: clip(p?.name, 160), title: clip(p?.title, 160), company: clip(p?.company, 200),
    email: clip(p?.email, 200), email2: clip(p?.email2, 200),
    phone: clip(p?.phone, 60), phone2: clip(p?.phone2, 60), website: clip(p?.website, 200),
    address: clip(p?.address, 300), city: clip(p?.city, 120), state: clip(p?.state, 60), zip: clip(p?.zip, 20),
    businessTypes: (Array.isArray(p?.businessTypes) ? p.businessTypes : []).slice(0, 12).map((b: unknown) => String(b).trim().slice(0, 80)).filter(Boolean),
    notes: (Array.isArray(p?.notes) ? p.notes : []).slice(0, 80).map((n: unknown) => String(n).slice(0, 8000)).filter(Boolean),
    capturedBy: clip(p?.capturedBy, 120),
    capturedAt: typeof p?.capturedAt === 'string' && !Number.isNaN(Date.parse(p.capturedAt)) ? new Date(p.capturedAt).toISOString() : null,
  }));
  return {
    id: String(raw.id ?? '').slice(0, 40), action,
    targetProspectId: typeof raw.targetProspectId === 'string' ? raw.targetProspectId : null,
    company: clip(raw.company, 200), people,
  };
}

function contactName(p: ImportPerson, company: string | null): string {
  return p.name || p.email || p.phone || company || 'Contact';
}

function noteBody(p: ImportPerson, ctx: CommitContext, diffs: string[] = []): string {
  const lines = [`Imported from ${ctx.fileLabel}${ctx.campaign ? ` (${ctx.campaign.name})` : ''}`];
  if (p.capturedBy) lines.push(`Captured by: ${p.capturedBy}`);
  if (p.capturedAt) lines.push(`Captured on: ${new Date(p.capturedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })} (ET)`);
  if (p.sources.length > 1) lines.push(`Combined from ${p.sources.length} rows`);
  lines.push(...p.notes);
  if (diffs.length) lines.push('Different in the imported file (the existing value was kept):', ...diffs.map(d => `  ${d}`));
  return lines.join('\n').slice(0, 40000);
}

async function addInteraction(admin: any, ctx: CommitContext, prospectId: string) {
  if (!ctx.campaign) return;
  // 'excel_import' needs migration 125 on the check constraint; until then this is skipped, not fatal.
  const { error } = await admin.from('campaign_interactions').insert({
    campaign_id: ctx.campaign.id, prospect_id: prospectId, interaction_type: 'excel_import', source: ctx.campaign.source,
  });
  if (error) console.error('[import] campaign interaction not recorded (migration 125 applied?):', error.message);
}

async function insertNotes(admin: any, ctx: CommitContext, entries: { contactId: string; person: ImportPerson; diffs?: string[] }[]) {
  const now = new Date().toISOString();
  const rows = entries.map(e => ({
    prospect_contact_id: e.contactId, author_name: 'Excel import', body: noteBody(e.person, ctx, e.diffs), source_created_at: now,
  }));
  if (rows.length) {
    const { error } = await admin.from('prospect_contact_notes').insert(rows);
    if (error) console.error('[import] notes failed:', error.message);
  }
}

async function insertLocation(admin: any, prospectId: string, p: ImportPerson | undefined) {
  if (!p || !(p.address || p.city || p.state || p.zip)) return;
  const { error } = await admin.from('prospect_locations').insert({
    prospect_id: prospectId, address_line_1: p.address, city: p.city, state: p.state, postal_code: p.zip, is_active: true,
  });
  if (error) console.error('[import] location failed:', error.message);
}

export async function createGroup(admin: any, ctx: CommitContext, g: CommitGroup): Promise<CommitResult> {
  const first = g.people[0];
  const companyName = g.company ?? first?.company ?? null;
  const personName = first ? contactName(first, null) : null;
  if (!companyName && !personName) throw new Error('Row has no company and no person name');

  const withInfo = <T>(pick: (p: ImportPerson) => T | null) => g.people.map(pick).find(v => !!v) ?? null;
  const { data: prospect, error } = await admin.from('prospects').insert({
    entity_type: companyName ? 'organization' : 'person',
    organization_name: companyName,
    person_name: companyName ? null : personName,
    main_email: withInfo(p => p.email), main_phone: withInfo(p => p.phone), website: withInfo(p => p.website),
    business_types: [...new Set(g.people.flatMap(p => p.businessTypes))],
    status: 'captured',
    // The card's "Created" date: when the lead was really captured (earliest of the people), not the upload day.
    external_created_at: g.people.map(p => p.capturedAt).filter((d): d is string => !!d).sort()[0] ?? null,
    source_label: ctx.campaign?.source ?? null, source_raw_label: ctx.campaign?.name ?? null,
    campaign_id: ctx.campaign?.id ?? null,
    latest_source_label: ctx.campaign?.source ?? null, latest_campaign_id: ctx.campaign?.id ?? null,
    created_by: ctx.userId,
  }).select('id').single();
  if (error) throw new Error(error.message);

  const created: { contactId: string; person: ImportPerson }[] = [];
  for (const [i, person] of g.people.entries()) {
    const { data: c, error: cErr } = await admin.from('prospect_contacts').insert({
      prospect_id: prospect.id, name: contactName(person, companyName), title: person.title,
      email: person.email, phone: person.phone, other_contact: otherContactOf(person), is_primary: i === 0, created_by: ctx.userId,
    }).select('id').single();
    if (cErr) { console.error('[import] contact failed:', cErr.message); continue; }
    created.push({ contactId: c.id as string, person });
  }
  await insertNotes(admin, ctx, created);
  await insertLocation(admin, prospect.id, g.people.find(p => p.address || p.city || p.state || p.zip));
  await addInteraction(admin, ctx, prospect.id);
  await logAudit({ actorId: ctx.userId, action: 'prospect.created_via_import', resource: `prospect:${prospect.id}`, newValue: { file: ctx.fileLabel, contacts: created.length } });
  return { id: g.id, action: 'create', prospectId: prospect.id as string, contactsAdded: created.length };
}

export async function mergeGroup(admin: any, ctx: CommitContext, g: CommitGroup): Promise<CommitResult> {
  if (!g.targetProspectId) throw new Error('No Contact selected to merge into');
  const { data: target } = await admin.from('prospects')
    .select('id, organization_name, main_email, main_phone, website, business_types')
    .eq('id', g.targetProspectId).is('deleted_at', null).maybeSingle();
  if (!target) throw new Error('The Contact to merge into no longer exists');

  const { data: existing } = await admin.from('prospect_contacts')
    .select('id, name, title, email, phone, other_contact, is_primary').eq('prospect_id', target.id).limit(300);
  const contacts = ((existing ?? []) as { id: string; name: string; title: string | null; email: string | null; phone: string | null; other_contact: string | null }[])
    .map(c => ({ id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone, otherContact: c.other_contact }));

  // The same plan the user saw before confirming (lib/marketing/import/merge.ts).
  const plan = planMerge({
    organizationName: target.organization_name, email: target.main_email, phone: target.main_phone,
    website: target.website, businessTypes: target.business_types ?? [],
  }, contacts, g);

  // A different street address in the file never replaces the stored location: note it instead.
  const { data: locs } = await admin.from('prospect_locations').select('id, address_line_1').eq('prospect_id', target.id).limit(1);
  const fileAddress = g.people.find(p => p.address)?.address ?? null;
  if (locs?.length) {
    const stored = (locs[0].address_line_1 ?? '').trim().toLowerCase();
    if (fileAddress && stored && stored !== fileAddress.trim().toLowerCase()) plan.differences.push(`Address: ${fileAddress}`);
  } else {
    await insertLocation(admin, target.id, g.people.find(p => p.address || p.city || p.state || p.zip));
  }

  const patch: Record<string, unknown> = { ...plan.prospectPatch };
  if (ctx.campaign) { patch.latest_source_label = ctx.campaign.source; patch.latest_campaign_id = ctx.campaign.id; }
  if (Object.keys(patch).length) {
    const { error } = await admin.from('prospects').update(patch).eq('id', target.id);
    if (error) throw new Error(error.message);
  }

  const touched: { contactId: string; person: ImportPerson; diffs: string[] }[] = [];
  let added = 0;
  for (const item of plan.people) {
    if (item.match) {
      if (Object.keys(item.fill).length) await admin.from('prospect_contacts').update(item.fill).eq('id', item.match.id);
      touched.push({ contactId: item.match.id, person: item.person, diffs: item.differences });
    } else {
      const { data: c, error } = await admin.from('prospect_contacts').insert({
        prospect_id: target.id, name: contactName(item.person, g.company), title: item.person.title,
        email: item.person.email, phone: item.person.phone, other_contact: otherContactOf(item.person),
        is_primary: contacts.length === 0 && added === 0, created_by: ctx.userId,
      }).select('id').single();
      if (error) { console.error('[import] contact failed:', error.message); continue; }
      added++;
      touched.push({ contactId: c.id as string, person: item.person, diffs: item.differences });
    }
  }
  // Company-level clashes ride on the first person's note.
  if (touched[0]) touched[0].diffs = [...plan.differences, ...touched[0].diffs];
  await insertNotes(admin, ctx, touched);

  await addInteraction(admin, ctx, target.id);
  await logAudit({ actorId: ctx.userId, action: 'prospect.merged_via_import', resource: `prospect:${target.id}`, newValue: { file: ctx.fileLabel, contactsAdded: added } });
  return { id: g.id, action: 'merge', prospectId: target.id as string, contactsAdded: added };
}
