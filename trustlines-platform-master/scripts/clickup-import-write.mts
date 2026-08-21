// ── ClickUp Contacts → Prospect REAL IMPORT (writes to OUR Supabase DB only) ────────
// Run once migrations 088 + 089 are applied:
//   npm run clickup:import
// ClickUp itself is STILL only ever read (GET) — see lib/clickup/client.ts's header
// rule. This script is the write counterpart of scripts/clickup-import-dry-run.mts;
// same source list, same mapping (lib/clickup/importMapping.ts), same campaign
// classification. Idempotent: a candidate whose external_ref already exists on a
// prospects row is skipped entirely (never updated, never duplicated) — safe to re-run
// after fixing a data issue or adding a new ClickUp source list later.
//
// 2026-08-14 — a ClickUp COMPANY task can have several Person tasks nested under it as
// real ClickUp SUBTASKS (multiple employees/contacts at the same company — "David Weisz"
// with "Meg…"/"Zisha…" underneath it). The first version of this script imported every
// task as an independent top-level Prospect, so a company's SECOND+ contact silently
// became its own separate, wrong Prospect ("sen bana 1'ini almışsın" — user caught this
// live). Now: a task with a `parent` is imported as an ADDITIONAL prospect_contacts row
// on its parent's already-imported Prospect, never as a new Prospect of its own.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks, type ClickUpTask } from '../lib/clickup/client';
import { mapTaskToProspectCandidate, type ProspectCandidate, type RegionTag } from '../lib/clickup/importMapping';
import { createCampaign, setCampaignStatus } from '../lib/marketing/campaigns';
import { logAudit } from '../lib/audit/log';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

// 2026-08-13: CRM was fully reset (scripts/reset-crm-full.mts) and is being rebuilt
// region-by-region on user request, starting with NE. The OLD 'dhdc7-4330' NE source was
// wrong (a different, unauthorized ClickUp Team — see scripts/cleanup-ne-wrong-source.mts)
// — replaced with the real "Contacts NE" list, confirmed directly by the user:
// https://app.clickup.com/14202247/v/l/6-901509135417-1 (list id 901509135417).
// 2026-08-14: switched from the VIEW id (6-901509135417-1) to the raw LIST id — direct
// list access works fine for this list (unlike the old wrong one, which really was
// unauthorized), and critically the View endpoint silently drops nested/subtask
// contacts (285 vs the real 311 — 26 employees nested under their companies) even with
// `subtasks: true` passed; the raw List endpoint returns all 311 correctly.
const SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string }[] = [
  { id: '901509135417', kind: 'list', region: 'TLINES_NE', label: 'Contacts NE' },
  // 2026-08-19: "Contacts SE" confirmed via https://app.clickup.com/14202247/v/l/dhdc7-44755
  // → view dhdc7-44755's parent is List 901519728494. Same subtask/nested-contact caveat
  // as NE — using the raw LIST id, not the view id, so nested Person subtasks aren't
  // silently dropped (253 tasks via list vs whatever the view would give).
  { id: '901519728494', kind: 'list', region: 'TLINES_SE', label: 'Contacts SE' },
  // 2026-08-19: confirmed via https://app.clickup.com/14202247/v/l/dhdc7-45055 → view
  // "All"'s parent is List 901520164564, "Contacts NW" (folder "T LINES NATION WIDE").
  // 1131 raw tasks (804 top-level + 327 nested Person subtasks), Person/Company split via
  // custom_item_id like NE/SE — no junk-checklist-subtask pattern like Opportunities SE.
  { id: '901520164564', kind: 'list', region: 'TLINES_NW', label: 'Contacts NW' },
  // 2026-08-19: two separate ClickUp lists cover the same real region ("West", stored
  // code stays CVW — see lib/regions.ts) — both merge into the SAME region tag here, one
  // unified page on our side, exactly as asked ("iki ayrı sayfa var ikisinin
  // contactlarını tek sayfaya düşür birleştir"). Confirmed via:
  // https://app.clickup.com/14202247/v/l/6-901521038479-1 and .../6-901521260903-1
  { id: '901521038479', kind: 'list', region: 'CVW', label: 'Contacts West (Tlines)' },
  { id: '901521260903', kind: 'list', region: 'CVW', label: 'Contacts West (CVWTLINES)' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateCampaign(admin: any, name: string, actorId: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;

  const { data: existing } = await admin.from('marketing_campaigns').select('id').eq('name', name).is('deleted_at', null).limit(1).maybeSingle();
  if (existing) { cache.set(name, existing.id); return existing.id; }

  const campaign = await createCampaign(admin, { name, campaignType: 'trade_fair', source: 'trade_fair' }, actorId);
  // Historical — this fair already happened; 'closed' reflects reality (no new public
  // submissions expected against it). draft → closed is an allowed transition.
  await setCampaignStatus(admin, campaign.id, 'closed');
  cache.set(name, campaign.id);
  return campaign.id;
}

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set.'); process.exit(1); }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Supabase env vars are not set.'); process.exit(1); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) as any;

  // Confirm the required migrations landed before touching anything.
  const probe = await admin.from('prospects').select('external_ref').limit(1);
  if (probe.error) { console.error('Migration 088 is not applied yet:', probe.error.message); process.exit(1); }
  const probe2 = await admin.from('campaign_interactions').select('interaction_type').limit(1);
  if (probe2.error) { console.error('Migration 089 is not applied yet:', probe2.error.message); process.exit(1); }
  const probe3 = await admin.from('prospect_contacts').select('external_ref').limit(1);
  if (probe3.error) { console.error('Migration 098 is not applied yet:', probe3.error.message); process.exit(1); }

  const actorEmail = process.env.CLICKUP_IMPORT_ACTOR_EMAIL || 'batool@trust-lines.com';
  const { data: actor, error: actorErr } = await admin.from('profiles').select('id, full_name, role').eq('email', actorEmail).maybeSingle();
  if (actorErr || !actor) { console.error(`Could not resolve actor profile for ${actorEmail}:`, actorErr?.message ?? 'not found'); process.exit(1); }
  console.log(`Importing as ${actor.full_name} (${actor.role}, ${actorEmail})`);
  const actorId: string = actor.id;

  // PostgREST caps a select at 1000 rows by default — past that point (which this
  // project blew through a while ago), the old unpaged .select() here silently returned
  // only the first 1000, so the "already imported" checks below missed everything past
  // that page and re-attempted real inserts the DB correctly rejected as duplicates
  // (2026-08-19: 585 failures on the West import — root cause, not data loss, but fixed
  // here so it can't recur; a few "prospect insert" successes ahead of a failed "contact
  // insert" on the SAME task did leave orphan duplicate Prospects, cleaned up separately).
  async function fetchAllRows<T>(table: string, column: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await admin.from(table).select(column).eq('external_source', 'clickup').not('external_ref', 'is', null).range(from, from + 999);
      if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < 1000) break;
    }
    return out;
  }

  const existingProspectRows = await fetchAllRows<{ id: string; external_ref: string }>('prospects', 'id, external_ref');
  const prospectIdByTaskId = new Map<string, string>(existingProspectRows.map(r => [r.external_ref, r.id]));
  console.log(`${prospectIdByTaskId.size} already imported previously — will be skipped.`);

  const existingContactRows = await fetchAllRows<{ external_ref: string }>('prospect_contacts', 'external_ref');
  const existingContactRefs = new Set(existingContactRows.map(r => r.external_ref));

  const campaignCache = new Map<string, string>();
  let created = 0, skipped = 0, failed = 0, additionalContacts = 0, additionalContactsSkipped = 0, orphanedChildren = 0;
  const failures: { externalRef: string; name: string; error: string }[] = [];

  async function importTopLevel(task: ClickUpTask, region: RegionTag, label: string): Promise<void> {
    const c: ProspectCandidate = mapTaskToProspectCandidate(task, region, label);
    if (prospectIdByTaskId.has(c.externalRef)) { skipped += 1; return; }

    try {
      // Original-touch campaign (the "13-SOURCE" value, if it classified as a real
      // named campaign rather than a generic LeadSource category).
      let originalCampaignId: string | null = null;
      let sourceLabel: string | null = null;
      if (c.sourceClassification?.kind === 'campaign') {
        originalCampaignId = await getOrCreateCampaign(admin, c.sourceClassification.raw, actorId, campaignCache);
        sourceLabel = 'trade_fair';
      } else if (c.sourceClassification?.kind === 'generic') {
        sourceLabel = c.sourceClassification.leadSource;
      }

      const { data: prospect, error: pErr } = await admin.from('prospects').insert({
        entity_type: c.entityType,
        organization_name: c.organizationName,
        person_name: c.entityType === 'person' ? c.personName : null,
        website: c.website,
        main_email: c.email,
        main_phone: c.phone,
        business_types: c.businessTypes,
        source_label: sourceLabel,
        campaign_id: originalCampaignId,
        latest_source_label: sourceLabel,
        latest_campaign_id: originalCampaignId,
        source_detail: c.sourceDetail,
        source_raw_label: c.sourceRaw,
        x_note: c.xNote,
        tags: c.tags,
        external_created_at: c.externalCreatedAt,
        region: c.region,
        status: 'captured',
        owner_id: actorId,
        assigned_marketing_user_id: actorId,
        external_source: c.externalSource,
        external_ref: c.externalRef,
        created_by: actorId,
      }).select('id').single();
      if (pErr) throw new Error(`prospect insert: ${pErr.message}`);
      prospectIdByTaskId.set(c.externalRef, prospect.id);

      await admin.from('prospect_contacts').insert({
        prospect_id: prospect.id,
        name: c.contactName,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedin_url: c.linkedinUrl,
        other_contact: c.otherContact,
        whatsapp: c.whatsapp,
        company2_phone: c.company2Phone,
        is_primary: true,
        external_source: c.externalSource,
        external_ref: c.externalRef,
        created_by: actorId,
      });

      if (c.state || c.formattedAddress || c.mailingAddress || c.latitude != null) {
        await admin.from('prospect_locations').insert({
          prospect_id: prospect.id,
          address_line_1: c.formattedAddress,
          state: c.state,
          latitude: c.latitude,
          longitude: c.longitude,
          mailing_address: c.mailingAddress,
          is_active: true,
        });
      }

      // Every distinct campaign this contact actually touched (original source +
      // every "shows attended" entry, deduped) gets one campaign_interactions row —
      // real attribution history, not a survey submission (migration 089).
      const touchedCampaignNames = new Set<string>();
      if (c.sourceClassification?.kind === 'campaign') touchedCampaignNames.add(c.sourceClassification.raw);
      for (const show of c.showsAttended) touchedCampaignNames.add(show);

      for (const name of touchedCampaignNames) {
        const campaignId = await getOrCreateCampaign(admin, name, actorId, campaignCache);
        await admin.from('campaign_interactions').insert({
          campaign_id: campaignId, prospect_id: prospect.id, interaction_type: 'clickup_import', source: 'trade_fair',
        });
      }

      created += 1;
      if (created % 200 === 0) console.log(`  ...${created} created so far`);
    } catch (e) {
      failed += 1;
      failures.push({ externalRef: c.externalRef, name: c.contactName, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // A child (subtask) is an ADDITIONAL contact on its parent's Prospect — never a new
  // Prospect of its own. Only its own contact-level fields matter here; company-level
  // ones (business type, tags, location, source campaigns, ...) belong to the PARENT,
  // already captured when the parent itself was imported.
  async function importChildContact(task: ClickUpTask, region: RegionTag, label: string, parentProspectId: string): Promise<void> {
    const c: ProspectCandidate = mapTaskToProspectCandidate(task, region, label);
    if (existingContactRefs.has(c.externalRef)) { additionalContactsSkipped += 1; return; }
    try {
      const { error } = await admin.from('prospect_contacts').insert({
        prospect_id: parentProspectId,
        name: c.contactName,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedin_url: c.linkedinUrl,
        other_contact: c.otherContact,
        whatsapp: c.whatsapp,
        company2_phone: c.company2Phone,
        is_primary: false,
        external_source: c.externalSource,
        external_ref: c.externalRef,
        created_by: actorId,
      });
      if (error) throw new Error(`contact insert: ${error.message}`);
      // Same live-tracking fix as prospectIdByTaskId in importTopLevel — without this, a
      // task appearing twice in one run (a Person genuinely linked as a subtask under two
      // different Company parents, seen live in the West lists) would attempt this insert
      // a second time and hit the DB's real unique constraint instead of being skipped.
      existingContactRefs.add(c.externalRef);
      additionalContacts += 1;
    } catch (e) {
      failed += 1;
      failures.push({ externalRef: c.externalRef, name: c.contactName, error: e instanceof Error ? e.message : String(e) });
    }
  }

  for (const src of SOURCES) {
    console.log(`\nFetching "${src.label}"...`);
    const tasks = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`  ${tasks.length} task(s)`);

    const topLevel = tasks.filter(t => !t.parent);
    const children = tasks.filter(t => !!t.parent);
    console.log(`  ${topLevel.length} top-level, ${children.length} nested contact(s)`);

    for (const task of topLevel) await importTopLevel(task, src.region, src.label);

    for (const task of children) {
      const parentProspectId = prospectIdByTaskId.get(task.parent as string);
      if (parentProspectId) {
        await importChildContact(task, src.region, src.label, parentProspectId);
      } else if (existingContactRefs.has(task.id)) {
        // This child already has a real home (a prospect_contacts row from a previous,
        // correct run) — its parent just isn't in THIS run's map. Falling through to the
        // orphan path would create a spurious duplicate Prospect (the contacts insert
        // would then fail on the real unique constraint, leaving that duplicate stranded
        // with no contact — exactly what happened before the West import's 131 "contact
        // insert" failures were root-caused, 2026-08-19).
        additionalContactsSkipped += 1;
      } else {
        // Parent wasn't in this fetch (e.g. filtered out, or belongs to a different
        // source list) — fall back to importing it as its own top-level Prospect rather
        // than silently dropping the data.
        orphanedChildren += 1;
        await importTopLevel(task, src.region, src.label);
      }
    }
  }

  console.log(`\n── Done ──`);
  console.log(`Prospects created: ${created}`);
  console.log(`Prospects skipped (already imported): ${skipped}`);
  console.log(`Additional contacts (nested under an existing company): ${additionalContacts}`);
  console.log(`Additional contacts skipped (already imported): ${additionalContactsSkipped}`);
  console.log(`Nested contacts whose parent wasn't found (imported as standalone Prospects instead): ${orphanedChildren}`);
  console.log(`Failed: ${failed}`);
  console.log(`Campaigns created/reused: ${campaignCache.size}`);

  if (failures.length) {
    writeFileSync('scripts/clickup-import-failures.json', JSON.stringify(failures, null, 2));
    console.log(`Failure details saved to scripts/clickup-import-failures.json`);
  }

  await logAudit({
    actorId, action: 'prospect.bulk_imported_clickup',
    newValue: { created, skipped, additionalContacts, failed, campaigns: campaignCache.size, sources: SOURCES.map(s => s.label) },
  });
}

main().catch(e => {
  console.error('Import failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
