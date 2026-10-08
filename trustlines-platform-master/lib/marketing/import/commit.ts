/* eslint-disable @typescript-eslint/no-explicit-any */

import { logAudit } from '@/lib/audit/log';
import { otherContactOf, planMerge } from './merge';
import { parseProjectTypes, parseStatus, parseTiming } from './cardFields';
import { setCreatedByLabelIfEmpty } from '@/lib/marketing/surveyRepresentatives';
import { runClassificationForNeed } from '@/lib/marketing/opportunityEngine';
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
  /** New Contacts also get a project need + potential, like survey leads (Needs / Potentials tabs). */
  createNeeds?: boolean;
}

export interface CommitResult {
  id: string;
  action: ImportAction;
  prospectId: string | null;
  contactsAdded: number;
  /** false when the event link (Shows attended / event filter) could not be saved — migration 125 missing. */
  linked?: boolean;
  needCreated?: boolean;
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
    whatsapp: typeof p?.whatsapp === 'boolean' ? p.whatsapp : null,
    linkedin: clip(p?.linkedin, 300), otherContact: clip(p?.otherContact, 300), company2Phone: clip(p?.company2Phone, 60),
    mailingAddress: clip(p?.mailingAddress, 300), status: clip(p?.status, 60), xNote: clip(p?.xNote, 2000),
    sourceInfo: clip(p?.sourceInfo, 500), createdBy: clip(p?.createdBy, 120),
    needTitle: clip(p?.needTitle, 200), projectType: clip(p?.projectType, 300), timing: clip(p?.timing, 120),
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

async function addInteraction(admin: any, ctx: CommitContext, prospectId: string): Promise<boolean> {
  if (!ctx.campaign) return true;
  // 'excel_import' needs migration 125 on the check constraint; until then this is skipped, not fatal.
  const { error } = await admin.from('campaign_interactions').insert({
    campaign_id: ctx.campaign.id, prospect_id: prospectId, interaction_type: 'excel_import', source: ctx.campaign.source,
  });
  if (error) console.error('[import] campaign interaction not recorded (migration 125 applied?):', error.message);
  return !error;
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

async function insertLocation(admin: any, prospectId: string, p: ImportPerson | undefined): Promise<string | null> {
  if (!p || !(p.address || p.city || p.state || p.zip || p.mailingAddress)) return null;
  const { data, error } = await admin.from('prospect_locations').insert({
    prospect_id: prospectId, address_line_1: p.address, city: p.city, state: p.state, postal_code: p.zip,
    mailing_address: p.mailingAddress ?? null, is_active: true,
  }).select('id').single();
  if (error) { console.error('[import] location failed:', error.message); return null; }
  return data.id as string;
}

// A project need + automatic classification (Potential / Opportunity), the same way a survey lead gets
// one — so the new Contact has its Needs / Potentials tabs filled. Never fails the Contact itself.
async function createNeed(admin: any, ctx: CommitContext, prospectId: string, locationId: string | null, g: CommitGroup): Promise<boolean> {
  try {
    const first = <T,>(pick: (p: ImportPerson) => T | null | undefined) => g.people.map(pick).find(v => !!v) ?? null;
    const rawType = first(p => p.projectType);
    const { data, error } = await admin.from('prospect_needs').insert({
      prospect_id: prospectId, location_id: locationId,
      title: first(p => p.needTitle) || first(p => p.address) || `${ctx.campaign?.name ?? 'Import'} — imported lead`,
      description: rawType ? `Project type (from the file): ${rawType}` : null,
      project_types: [...new Set(g.people.flatMap(p => parseProjectTypes(p.projectType)))],
      timing: g.people.map(p => parseTiming(p.timing)).find(Boolean) ?? null,
      source: ctx.campaign?.source ?? null, created_by: ctx.userId,
    }).select('id').single();
    if (error) throw new Error(error.message);
    await runClassificationForNeed(admin, data.id as string, ctx.userId);
    return true;
  } catch (e) {
    console.error('[import] need/potential not created:', e instanceof Error ? e.message : e);
    return false;
  }
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
    status: g.people.map(p => parseStatus(p.status)).find(Boolean) ?? 'captured',
    x_note: withInfo(p => p.xNote), source_detail: withInfo(p => p.sourceInfo),
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
      whatsapp: person.whatsapp === true, linkedin_url: person.linkedin ?? null, company2_phone: person.company2Phone ?? null,
    }).select('id').single();
    if (cErr) { console.error('[import] contact failed:', cErr.message); continue; }
    created.push({ contactId: c.id as string, person });
  }
  await insertNotes(admin, ctx, created);
  const locationId = await insertLocation(admin, prospect.id, g.people.find(p => p.address || p.city || p.state || p.zip || p.mailingAddress));
  const needCreated = ctx.createNeeds ? await createNeed(admin, ctx, prospect.id, locationId, g) : false;
  // An explicit Status column wins over what the automatic classification just decided.
  const explicitStatus = g.people.map(p => parseStatus(p.status)).find(Boolean);
  if (explicitStatus) await admin.from('prospects').update({ status: explicitStatus }).eq('id', prospect.id);
  await setCreatedByLabelIfEmpty(admin, prospect.id, g.people.map(p => p.createdBy).find(Boolean) ?? undefined);
  const linked = await addInteraction(admin, ctx, prospect.id);
  await logAudit({ actorId: ctx.userId, action: 'prospect.created_via_import', resource: `prospect:${prospect.id}`, newValue: { file: ctx.fileLabel, contacts: created.length } });
  return { id: g.id, action: 'create', prospectId: prospect.id as string, contactsAdded: created.length, linked, needCreated };
}

export async function mergeGroup(admin: any, ctx: CommitContext, g: CommitGroup): Promise<CommitResult> {
  if (!g.targetProspectId) throw new Error('No Contact selected to merge into');
  const { data: target } = await admin.from('prospects')
    .select('id, organization_name, main_email, main_phone, website, business_types, x_note, source_detail')
    .eq('id', g.targetProspectId).is('deleted_at', null).maybeSingle();
  if (!target) throw new Error('The Contact to merge into no longer exists');

  const { data: existing } = await admin.from('prospect_contacts')
    .select('id, name, title, email, phone, other_contact, whatsapp, linkedin_url, company2_phone, is_primary').eq('prospect_id', target.id).limit(300);
  const contacts = ((existing ?? []) as { id: string; name: string; title: string | null; email: string | null; phone: string | null; other_contact: string | null; whatsapp: boolean | null; linkedin_url: string | null; company2_phone: string | null }[])
    .map(c => ({ id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone, otherContact: c.other_contact, whatsapp: !!c.whatsapp, linkedin: c.linkedin_url, company2Phone: c.company2_phone }));

  // The same plan the user saw before confirming (lib/marketing/import/merge.ts).
  const plan = planMerge({
    organizationName: target.organization_name, email: target.main_email, phone: target.main_phone,
    website: target.website, businessTypes: target.business_types ?? [], xNote: target.x_note, sourceDetail: target.source_detail,
  }, contacts, g);

  // A different street address in the file never replaces the stored location: note it instead.
  const { data: locs } = await admin.from('prospect_locations').select('id, address_line_1').eq('prospect_id', target.id).limit(1);
  const fileAddress = g.people.find(p => p.address)?.address ?? null;
  if (locs?.length) {
    const stored = (locs[0].address_line_1 ?? '').trim().toLowerCase();
    if (fileAddress && stored && stored !== fileAddress.trim().toLowerCase()) plan.differences.push(`Address: ${fileAddress}`);
  } else {
    await insertLocation(admin, target.id, g.people.find(p => p.address || p.city || p.state || p.zip || p.mailingAddress));
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
        whatsapp: item.person.whatsapp === true, linkedin_url: item.person.linkedin ?? null, company2_phone: item.person.company2Phone ?? null,
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

  const linked = await addInteraction(admin, ctx, target.id);
  await logAudit({ actorId: ctx.userId, action: 'prospect.merged_via_import', resource: `prospect:${target.id}`, newValue: { file: ctx.fileLabel, contactsAdded: added } });
  return { id: g.id, action: 'merge', prospectId: target.id as string, contactsAdded: added, linked };
}
