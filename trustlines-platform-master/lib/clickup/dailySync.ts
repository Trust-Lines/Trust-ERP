// Daily ClickUp → app top-up (app/api/cron/clickup-sync): adds what is NEW in ClickUp since the
// last run — Contacts (companies/people + their nested contacts) and Opportunities / Potentials
// (with their comments and files). The same rules as the manual imports
// (scripts/clickup-import-write.mts, clickup-import-opportunities.mts, clickup-new-only-dry-run.mts):
//   - ClickUp is only read.
//   - Nothing already in the app is updated, merged or deleted — a task already imported is skipped.
//   - A new ClickUp contact that looks like someone added by hand in the app (same email / phone),
//     or whose email is already in the app, is held back and reported — never a duplicate.
//   - A deal is added only under a contact that is already in the app (no invented companies —
//     the 141 bad fallback Prospects of 2026-09-17), and not when a deal with its project number
//     was already entered by hand.
// `write: false` = dry run: same report, nothing written.
import { getAllListTasks, getAllViewTasks, getCommentReplies, getTaskAttachments, getTaskComments, resolveCustomFieldValue, type ClickUpAttachment, type ClickUpComment, type ClickUpTask } from './client';
import { mapTaskToProspectCandidate, type ProspectCandidate, type RegionTag } from './importMapping';
import { mapTaskToOpportunityCandidate, type OpportunityCandidate } from './importOpportunitiesMapping';
import { createCampaign, setCampaignStatus } from '@/lib/marketing/campaigns';
import { CLASSIFICATION_RULE_VERSION } from '@/lib/marketing/classification';
import { buildNeedFilesPath } from '@/lib/marketing/needFiles';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';
import { projectNumber } from '@/lib/keyClients/match';
import { getDropboxClient } from '@/lib/dropbox/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The sources the manual imports use (see the scripts for how each was confirmed).
const CONTACT_SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string }[] = [
  { id: '901509135417', kind: 'list', region: 'TLINES_NE', label: 'Contacts NE' },
  { id: '901519728494', kind: 'list', region: 'TLINES_SE', label: 'Contacts SE' },
  { id: '901520164564', kind: 'list', region: 'TLINES_NW', label: 'Contacts NW' },
  { id: '901521038479', kind: 'list', region: 'CVW', label: 'Contacts West (Tlines)' },
  { id: '901521260903', kind: 'list', region: 'CVW', label: 'Contacts West (CVWTLINES)' },
];
const DEAL_SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string; excludeSubtasksAndBlank?: boolean }[] = [
  { id: 'dhdc7-54915', kind: 'view', region: 'TLINES_NE', label: 'Opportunities NE' },
  { id: '901521558768', kind: 'list', region: 'TLINES_SE', label: 'Opportunities SE', excludeSubtasksAndBlank: true },
  { id: '901521515967', kind: 'list', region: 'TLINES_NW', label: 'Opportunities NW', excludeSubtasksAndBlank: true },
  { id: '901521322569', kind: 'list', region: 'CVW', label: 'Opportunities W', excludeSubtasksAndBlank: true },
];

export interface SyncItem { region: string; name: string; ref: string; note?: string }
export interface SyncReport {
  write: boolean;
  contacts: { added: SyncItem[]; extraContacts: SyncItem[]; held: SyncItem[]; failed: SyncItem[] };
  deals: { potentials: SyncItem[]; opportunities: SyncItem[]; skipped: SyncItem[]; failed: SyncItem[] };
  fileProblems: string[];
}

const normEmail = (e: string | null | undefined) => (e ?? '').trim().toLowerCase() || null;
const normPhone = (p: string | null | undefined) => { const d = (p ?? '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : null; };

async function readAll<T>(admin: any, table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from(table).select(cols);
    if (filter) q = filter(q);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const fetchTasks = (s: { id: string; kind: 'view' | 'list' }) => (s.kind === 'view' ? getAllViewTasks(s.id) : getAllListTasks(s.id));

export async function runClickUpSync(admin: any, { write, actorId }: { write: boolean; actorId: string }): Promise<SyncReport> {
  const report: SyncReport = {
    write,
    contacts: { added: [], extraContacts: [], held: [], failed: [] },
    deals: { potentials: [], opportunities: [], skipped: [], failed: [] },
    fileProblems: [],
  };
  const campaigns = new Map<string, string>();
  const campaignId = async (name: string) => {
    if (campaigns.has(name)) return campaigns.get(name)!;
    const { data: existing } = await admin.from('marketing_campaigns').select('id').eq('name', name).is('deleted_at', null).limit(1).maybeSingle();
    let id: string = existing?.id;
    if (!id) {
      const c = await createCampaign(admin, { name, campaignType: 'trade_fair', source: 'trade_fair' }, actorId);
      await setCampaignStatus(admin, c.id, 'closed');
      id = c.id;
    }
    campaigns.set(name, id);
    return id;
  };

  await syncContacts(admin, { write, actorId, report, campaignId });
  await syncDeals(admin, { write, actorId, report, campaignId });
  return report;
}

// ── Contacts ──────────────────────────────────────────────────────────────────────────
async function syncContacts(admin: any, { write, actorId, report, campaignId }: { write: boolean; actorId: string; report: SyncReport; campaignId: (n: string) => Promise<string> }) {
  const prospects = await readAll<{ id: string; display_name: string | null; main_email: string | null; main_phone: string | null; external_source: string | null; external_ref: string | null; deleted_at: string | null }>(
    admin, 'prospects', 'id, display_name, main_email, main_phone, external_source, external_ref, deleted_at');
  const contacts = await readAll<{ id: string; prospect_id: string; name: string | null; email: string | null; phone: string | null; external_source: string | null; external_ref: string | null }>(
    admin, 'prospect_contacts', 'id, prospect_id, name, email, phone, external_source, external_ref');

  const prospectByRef = new Map<string, string>();
  for (const p of prospects) if (p.external_source === 'clickup' && p.external_ref) prospectByRef.set(p.external_ref, p.id);
  const contactRefs = new Set(contacts.filter(c => c.external_source === 'clickup' && c.external_ref).map(c => c.external_ref!));

  // Hand-added people (no ClickUp id) by email / phone, and every email already in the app.
  const manual = new Map<string, string>();
  const anyEmail = new Set<string>();
  for (const p of prospects) {
    if (p.deleted_at) continue;
    const e = normEmail(p.main_email), ph = normPhone(p.main_phone);
    if (e) anyEmail.add(e);
    if (p.external_ref) continue;
    if (e && !manual.has(`e:${e}`)) manual.set(`e:${e}`, p.display_name ?? 'a contact');
    if (ph && !manual.has(`p:${ph}`)) manual.set(`p:${ph}`, p.display_name ?? 'a contact');
  }
  for (const c of contacts) {
    const e = normEmail(c.email), ph = normPhone(c.phone);
    if (e) anyEmail.add(e);
    if (c.external_ref) continue;
    if (e && !manual.has(`e:${e}`)) manual.set(`e:${e}`, c.name ?? 'a contact');
    if (ph && !manual.has(`p:${ph}`)) manual.set(`p:${ph}`, c.name ?? 'a contact');
  }
  const holdReason = (c: ProspectCandidate) => {
    const e = normEmail(c.email), ph = normPhone(c.phone);
    const m = (e && manual.get(`e:${e}`)) || (ph && manual.get(`p:${ph}`));
    if (m) return `looks like “${m}”, added by hand in the app`;
    if (e && anyEmail.has(e)) return 'its email is already in the app';
    return null;
  };
  const item = (c: ProspectCandidate, note?: string): SyncItem =>
    ({ region: c.region, name: c.organizationName ?? c.personName ?? c.contactName ?? c.externalRef, ref: c.externalRef, ...(note ? { note } : {}) });
  const contactRow = (c: ProspectCandidate, prospectId: string, primary: boolean) => ({
    prospect_id: prospectId, name: c.contactName, title: c.title, email: c.email, phone: c.phone,
    linkedin_url: c.linkedinUrl, other_contact: c.otherContact, whatsapp: c.whatsapp, company2_phone: c.company2Phone,
    is_primary: primary, external_source: c.externalSource, external_ref: c.externalRef, created_by: actorId,
  });

  async function addTopLevel(c: ProspectCandidate) {
    if (prospectByRef.has(c.externalRef) || contactRefs.has(c.externalRef)) return;
    const hold = holdReason(c);
    if (hold) { report.contacts.held.push(item(c, hold)); return; }
    if (!write) { report.contacts.added.push(item(c)); prospectByRef.set(c.externalRef, 'dry-run'); return; }
    try {
      let originalCampaignId: string | null = null;
      let sourceLabel: string | null = null;
      if (c.sourceClassification?.kind === 'campaign') { originalCampaignId = await campaignId(c.sourceClassification.raw); sourceLabel = 'trade_fair'; }
      else if (c.sourceClassification?.kind === 'generic') sourceLabel = c.sourceClassification.leadSource;

      const { data: prospect, error } = await admin.from('prospects').insert({
        entity_type: c.entityType, organization_name: c.organizationName, person_name: c.entityType === 'person' ? c.personName : null,
        website: c.website, main_email: c.email, main_phone: c.phone, business_types: c.businessTypes,
        source_label: sourceLabel, campaign_id: originalCampaignId, latest_source_label: sourceLabel, latest_campaign_id: originalCampaignId,
        source_detail: c.sourceDetail, source_raw_label: c.sourceRaw, x_note: c.xNote, tags: c.tags, external_created_at: c.externalCreatedAt,
        region: c.region, regions: [c.region], status: 'captured',
        // Like the earlier imports: no owner — region rules decide who sees it.
        owner_id: null, assigned_marketing_user_id: null,
        external_source: c.externalSource, external_ref: c.externalRef, created_by: actorId,
      }).select('id').single();
      if (error) throw new Error(`prospect: ${error.message}`);
      prospectByRef.set(c.externalRef, prospect.id);
      const { error: cErr } = await admin.from('prospect_contacts').insert(contactRow(c, prospect.id, true));
      if (cErr) throw new Error(`contact: ${cErr.message}`);
      contactRefs.add(c.externalRef);
      if (c.state || c.formattedAddress || c.mailingAddress || c.latitude != null) {
        await admin.from('prospect_locations').insert({
          prospect_id: prospect.id, address_line_1: c.formattedAddress, state: c.state,
          latitude: c.latitude, longitude: c.longitude, mailing_address: c.mailingAddress, is_active: true,
        });
      }
      const touched = new Set<string>(c.showsAttended);
      if (c.sourceClassification?.kind === 'campaign') touched.add(c.sourceClassification.raw);
      for (const name of touched) {
        await admin.from('campaign_interactions').insert({ campaign_id: await campaignId(name), prospect_id: prospect.id, interaction_type: 'clickup_import', source: 'trade_fair' });
      }
      report.contacts.added.push(item(c));
    } catch (e) {
      report.contacts.failed.push(item(c, e instanceof Error ? e.message : String(e)));
    }
  }

  for (const src of CONTACT_SOURCES) {
    const tasks: ClickUpTask[] = await fetchTasks(src);
    for (const t of tasks.filter(x => !x.parent)) await addTopLevel(mapTaskToProspectCandidate(t, src.region, src.label));
    for (const t of tasks.filter(x => !!x.parent)) {
      const c = mapTaskToProspectCandidate(t, src.region, src.label);
      if (contactRefs.has(c.externalRef) || prospectByRef.has(c.externalRef)) continue;
      const parentId = prospectByRef.get(t.parent as string);
      // Parent not in the app: imported as its own company/person (as the manual import does).
      if (!parentId) { await addTopLevel(c); continue; }
      const hold = holdReason(c);
      if (hold) { report.contacts.held.push(item(c, hold)); continue; }
      if (!write || parentId === 'dry-run') { report.contacts.extraContacts.push(item(c)); contactRefs.add(c.externalRef); continue; }
      const { error } = await admin.from('prospect_contacts').insert(contactRow(c, parentId, false));
      if (error) report.contacts.failed.push(item(c, `contact: ${error.message}`));
      else { contactRefs.add(c.externalRef); report.contacts.extraContacts.push(item(c)); }
    }
  }
}

// ── Opportunities / Potentials ───────────────────────────────────────────────────────
async function syncDeals(admin: any, { write, actorId, report, campaignId }: { write: boolean; actorId: string; report: SyncReport; campaignId: (n: string) => Promise<string> }) {
  const needRefs = new Set((await readAll<{ external_ref: string }>(admin, 'prospect_needs', 'external_ref',
    q => q.eq('external_source', 'clickup').not('external_ref', 'is', null))).map(r => r.external_ref));
  // Project numbers of deals entered by hand in the app (not from ClickUp).
  const handNumbers = new Set<string>();
  for (const table of ['opportunities', 'prospect_potentials']) {
    const rows = await readAll<{ external_project_code: string | null; external_source: string | null }>(admin, table, 'external_project_code, external_source',
      q => q.not('external_project_code', 'is', null).is('deleted_at', null));
    for (const r of rows) { const n = projectNumber(r.external_project_code); if (n && r.external_source !== 'clickup') handNumbers.add(n); }
  }

  const candidates: OpportunityCandidate[] = [];
  for (const src of DEAL_SOURCES) {
    for (const t of await fetchTasks(src)) {
      if (src.excludeSubtasksAndBlank) {
        if (t.parent) continue;
        const f = (t.custom_fields ?? []).find(x => x.name === 'Status OP');
        if (!f || !resolveCustomFieldValue(f)) continue;
      }
      candidates.push(mapTaskToOpportunityCandidate(t, src.region));
    }
  }

  for (const c of candidates) {
    if (needRefs.has(c.externalRef)) continue;
    needRefs.add(c.externalRef);
    const it: SyncItem = { region: c.region, name: c.siteName, ref: c.externalRef, note: c.statusOpRaw };
    const no = projectNumber(c.externalProjectCode);
    if (no && handNumbers.has(no)) { report.deals.skipped.push({ ...it, note: `#${no} is already in the app (entered by hand)` }); continue; }

    let prospectId: string | null = null;
    if (c.contactExternalRef) {
      const { data: p } = await admin.from('prospects').select('id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
      prospectId = p?.id ?? null;
      if (!prospectId) {
        const { data: nested } = await admin.from('prospect_contacts').select('prospect_id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
        prospectId = nested?.prospect_id ?? null;
      }
    }
    if (!prospectId) {
      // A contact added in this same run (dry run) still counts as found.
      const addedNow = c.contactExternalRef && [...report.contacts.added, ...report.contacts.extraContacts].some(x => x.ref === c.contactExternalRef);
      if (!(addedNow && !write)) { report.deals.skipped.push({ ...it, note: 'its ClickUp contact isn’t in the app' }); continue; }
    }

    const bucket = c.outcome.kind === 'potential' ? report.deals.potentials : report.deals.opportunities;
    if (!write) { bucket.push(it); continue; }
    try {
      let sourceLabel: string | null = null;
      if (c.sourceClassification?.kind === 'campaign') { sourceLabel = 'trade_fair'; await campaignId(c.sourceClassification.raw); }
      else if (c.sourceClassification?.kind === 'generic') sourceLabel = c.sourceClassification.leadSource;

      let locationId: string | null = null;
      if (c.state || c.formattedAddress || c.latitude != null) {
        const { data: loc } = await admin.from('prospect_locations').insert({
          prospect_id: prospectId, address_line_1: c.formattedAddress, state: c.state, latitude: c.latitude, longitude: c.longitude, is_active: true,
        }).select('id').single();
        locationId = loc?.id ?? null;
      }
      const description = c.description || [c.requestRaw ? `Request: ${c.requestRaw}` : null, c.externalProjectCode ? `ClickUp Project #: ${c.externalProjectCode}` : null].filter(Boolean).join(' | ') || null;
      const reasons = [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`];
      const { data: need, error: nErr } = await admin.from('prospect_needs').insert({
        prospect_id: prospectId, location_id: locationId, title: c.siteName, description,
        project_types: c.projectType ? [c.projectType] : [], region: c.region, service_line: c.serviceLine, state: c.state,
        source: sourceLabel, status: 'open', classification: c.outcome.kind === 'opportunity' ? 'opportunity' : 'potential',
        classification_reasons: reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        external_source: 'clickup', external_ref: c.externalRef, created_by: actorId,
      }).select('id').single();
      if (nErr) throw new Error(`need: ${nErr.message}`);

      const { data: primary } = await admin.from('prospect_contacts').select('id').eq('prospect_id', prospectId).eq('is_primary', true).limit(1).maybeSingle();
      const shared = {
        prospect_id: prospectId, need_id: need.id, title: c.siteName, primary_contact_id: primary?.id ?? null, region: c.region,
        external_project_code: c.externalProjectCode, estimated_value: c.dealSize, deposit: c.deposit, payment_raw: c.paymentRaw, targeted: c.targeted,
        auto_managed: false, classification_reasons: reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        external_source: 'clickup', external_ref: c.externalRef, external_stage_label: c.statusOpRaw,
        state: c.state, formatted_address: c.formattedAddress, brand: c.brand, business_types: c.businessTypes, industry_raw: c.industryRaw,
        project_type_raw: c.projectTypeRaw, request_raw: c.requestRaw, to_do_raw: c.toDoRaw, direct_contact_raw: c.directContactRaw,
        source_raw_label: c.sourceRaw, tags: c.tags, external_created_at: c.externalCreatedAt, source_description_raw: c.description,
        created_by: actorId,
      };
      if (c.outcome.kind === 'opportunity') {
        const closed = c.outcome.stage === 'closed_won' || c.outcome.stage === 'closed_lost';
        const { error } = await admin.from('opportunities').insert({
          ...shared, project_types: c.projectType ? [c.projectType] : [], stage: c.outcome.stage, source_label: sourceLabel,
          marketing_owner_id: null, deadline: c.dueDate,
          ...(closed ? { closed_at: c.dateDone ?? new Date().toISOString(), closed_reason: c.statusOpRaw } : {}),
        });
        if (error) throw new Error(`opportunity: ${error.message}`);
      } else {
        const { error } = await admin.from('prospect_potentials').insert({ ...shared, status: 'identified', assigned_to: null, due_date: c.dueDate, date_done: c.dateDone });
        if (error) throw new Error(`potential: ${error.message}`);
      }
      await importNeedDetails(admin, { id: need.id, title: c.siteName, region: c.region }, c.externalRef, report.fileProblems);
      bucket.push(it);
    } catch (e) {
      report.deals.failed.push({ ...it, note: e instanceof Error ? e.message : String(e) });
    }
  }
}

// A deal's comments (+ replies) and files, as the manual import does: files re-hosted in Dropbox
// under the Need's folder (ClickUp's links expire). Idempotent.
async function importNeedDetails(admin: any, need: { id: string; title: string; region: string | null }, taskId: string, problems: string[]) {
  const folder = buildNeedFilesPath(need.region, need.title, need.id);
  const done = new Map<string, string>();

  async function download(url: string): Promise<Buffer | null> {
    for (const headers of [{}, { Authorization: process.env.CLICKUP_API_TOKEN! }] as Record<string, string>[]) {
      try { const res = await fetch(url, { headers }); if (res.ok) return Buffer.from(await res.arrayBuffer()); } catch { /* next */ }
    }
    return null;
  }
  async function ensureFile(att: ClickUpAttachment): Promise<string | null> {
    if (done.has(att.id)) return done.get(att.id)!;
    if (!att.url) return null;
    const ext = att.extension && !/\s/.test(att.extension) ? att.extension : '';
    let name = sanitizeFileName(att.title || att.id);
    if (ext && !name.toLowerCase().endsWith('.' + ext.toLowerCase())) name = `${name}.${ext}`;
    if ((att.size ?? 0) > 140 * 1024 * 1024) { problems.push(`${need.title} · ${name}: over 140 MB`); return null; }
    const buf = await download(att.url);
    if (!buf) { problems.push(`${need.title} · ${name}: download failed`); return null; }
    try {
      const res = await getDropboxClient().filesUpload({ path: `${folder}/${name}`, contents: buf, mode: { '.tag': 'add' }, autorename: true });
      const path = res.result.path_lower ?? `${folder}/${name}`;
      const { error } = await admin.from('need_files').insert({ need_id: need.id, dropbox_path: path, file_name: name, uploaded_by: null });
      if (error) throw new Error(error.message);
      done.set(att.id, path);
      return path;
    } catch (e) { problems.push(`${need.title} · ${name}: ${e instanceof Error ? e.message : e}`); return null; }
  }
  async function writeNote(c: ClickUpComment) {
    const blocks = c.comment ?? [];
    const bookmark = blocks.find(b => b.type === 'bookmark' && b.bookmark?.url);
    const atts = blocks.filter(b => (b.type === 'attachment' && b.attachment) || (b.type === 'image' && b.image?.url));
    let imagePath: string | null = null;
    for (const b of atts) {
      const att: ClickUpAttachment | undefined = b.attachment ?? (b.image?.url ? { id: b.image.url, title: b.text || 'image', url: b.image.url } : undefined);
      if (!att) continue;
      const path = await ensureFile(att);
      if (path && ((att.mimetype ?? '').startsWith('image/') || b.type === 'image') && !imagePath) imagePath = path;
    }
    const body = c.comment_text?.trim() || (bookmark ? bookmark.bookmark!.url : '') || atts.map(b => b.text || b.attachment?.title).filter(Boolean).join(', ');
    if (!body && !imagePath) return;
    const doc = /^\s*\[Doc Embed:\s*([^\]]+)\]\s*$/.exec(body);
    const { data: existing } = await admin.from('need_notes').select('id').eq('need_id', need.id).eq('external_ref', c.id).maybeSingle();
    if (existing) return;
    await admin.from('need_notes').insert({
      need_id: need.id, author_name: c.user?.username ?? null,
      body: doc ? 'Attached a ClickUp Doc' : body || '(attachment)', image_path: imagePath,
      link_url: doc ? `https://app.clickup.com/14202247/v/dc/${doc[1].trim()}` : bookmark?.bookmark?.url ?? null,
      link_title: doc ? `ClickUp Doc ${doc[1].trim()}` : bookmark?.bookmark?.title ?? null,
      link_thumbnail_url: bookmark?.bookmark?.thumbnail_url ?? null,
      source_created_at: c.date ? new Date(Number(c.date)).toISOString() : null,
      external_source: 'clickup', external_ref: c.id,
    });
  }

  try {
    for (const c of await getTaskComments(taskId)) {
      await writeNote(c);
      if (Number(c.reply_count ?? 0) > 0) for (const r of await getCommentReplies(c.id)) await writeNote(r);
    }
    for (const att of await getTaskAttachments(taskId)) await ensureFile(att);
  } catch (e) { problems.push(`${need.title}: comments/files — ${e instanceof Error ? e.message : e}`); }
}
