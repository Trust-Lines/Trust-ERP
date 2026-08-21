// ── ClickUp "Opportunities NE" → Need/Opportunity/Potential import ──────────────────
// Dry run (default, writes nothing):
//   npm run clickup:import-opportunities
// Real write:
//   npm run clickup:import-opportunities -- --write
//
// ClickUp is still only ever read (GET) — see lib/clickup/client.ts's header rule.
// Reuses the already-imported Contacts (external_source='clickup' Prospects) via each
// task's "Contact" relationship field, so these 176 site/deal records attach to the
// SAME Prospect rows rather than creating duplicates. Idempotent: a task whose
// external_ref already exists on a prospect_needs row is skipped entirely.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks, getTaskComments, resolveCustomFieldValue, type ClickUpComment, type ClickUpTask } from '../lib/clickup/client';
import { mapTaskToOpportunityCandidate } from '../lib/clickup/importOpportunitiesMapping';
import type { RegionTag } from '../lib/clickup/importMapping';
import { createCampaign, setCampaignStatus } from '../lib/marketing/campaigns';
import { CLASSIFICATION_RULE_VERSION } from '../lib/marketing/classification';
import { logAudit } from '../lib/audit/log';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importNeedComments(admin: any, needId: string, taskId: string) {
  let comments: ClickUpComment[];
  try {
    comments = await getTaskComments(taskId);
  } catch {
    return; // best-effort — a task with a broken/inaccessible comment thread should never fail the whole import
  }
  for (const c of comments) {
    const bookmarkBlock = c.comment?.find(b => b.type === 'bookmark' && b.bookmark?.url);
    const body = c.comment_text?.trim() || (bookmarkBlock ? bookmarkBlock.bookmark!.url : '');
    if (!body && !bookmarkBlock) continue;
    // A partial unique index (need_id, external_ref) isn't usable as a Postgrest upsert
    // onConflict target — same issue hit on the Contacts checklist/notes backfill.
    // Select-then-insert instead.
    const { data: existing } = await admin.from('need_notes')
      .select('id').eq('need_id', needId).eq('external_ref', c.id).maybeSingle();
    if (existing) continue;
    const { error } = await admin.from('need_notes').insert({
      need_id: needId,
      author_name: c.user?.username ?? null,
      body: body || bookmarkBlock!.bookmark!.url,
      link_url: bookmarkBlock?.bookmark?.url ?? null,
      link_title: bookmarkBlock?.bookmark?.title ?? null,
      link_thumbnail_url: bookmarkBlock?.bookmark?.thumbnail_url ?? null,
      source_created_at: c.date ? new Date(Number(c.date)).toISOString() : null,
      external_source: 'clickup', external_ref: c.id,
    });
    if (error) console.error(`    note write failed (task ${taskId}, comment ${c.id}): ${error.message}`);
  }
}

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

const SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string; excludeSubtasksAndBlank?: boolean }[] = [
  { id: 'dhdc7-54915', kind: 'view', region: 'TLINES_NE', label: 'Opportunities NE' },
  // 2026-08-19: "Opportunities SE" confirmed via the SE folder (T LINES South East) —
  // same folder as Contacts SE (list id 901519728494). Raw LIST id, consistent with the
  // Contacts SE fix (view endpoints can silently drop rows — this same list's own "All
  // OP" view (dhdc7-52495) undercounts too, missing DEAL MISSED/DEAL CLOSED entirely
  // via the API, confirmed live).
  //
  // The raw list also carries real noise the view correctly hides: 196 blank-"Status OP"
  // checklist-style SUBTASKS ("Collect Information", "Initial meeting", …) nested under
  // real Opportunity tasks, plus 7 of those subtasks that DO carry a copied/inherited
  // Status OP value and were wrongly imported as 7 EXTRA top-level Opportunities in the
  // first pass (verified against the user's live ClickUp count: READY TO START 13→11,
  // MODIFICATION REQUEST 8→4, DEAL MISSED 52→51 — the diffs are exactly these subtasks).
  // `excludeSubtasksAndBlank` drops any task with a `parent` or an empty Status OP field
  // BEFORE mapping — top-level, non-blank Status OP tasks total exactly 130, matching the
  // user's live ClickUp "All OP" view count 1:1 (Potential 6, In Target List 3, READY TO
  // START 11, MODIFICATION REQUEST 4, WORKING ON IT TRUST 3, Design Proposal SENT 1,
  // WAITING 10, DEAL MISSED 51, DEAL CLOSED 41). User wants EXACT parity, Potential/In
  // Target List included this time — no `excludePotential` filter any more.
  { id: '901521558768', kind: 'list', region: 'TLINES_SE', label: 'Opportunities SE', excludeSubtasksAndBlank: true },
  // 2026-08-19: "Opportunities NW" confirmed via https://app.clickup.com/14202247/v/l/6-901521515967-1
  // → list id 901521515967 (folder "T LINES NATION WIDE", same as Contacts NW). 268 raw
  // tasks, 106 top-level with a real Status OP value, 162 blank-Status-OP subtasks (none
  // of them carry an inherited value, unlike SE's 7) — still excluded for consistency.
  { id: '901521515967', kind: 'list', region: 'TLINES_NW', label: 'Opportunities NW', excludeSubtasksAndBlank: true },
  // 2026-08-20: "Opportunities W" confirmed via https://app.clickup.com/14202247/v/l/dhdc7-49635
  // → list id 901521322569 (folder "CVWTLINES W", region stays code CVW / label "West").
  // 639 raw tasks, 245 top-level with a real Status OP value (0 subtasks carry an
  // inherited value). The list's own "176" sidebar badge only counts native status
  // "to do" — it silently excludes 70 "complete"-native-status top-level tasks that still
  // carry a real Status OP (DEAL CLOSED/DEAL MISSED etc.) — same misleading-badge pattern
  // already hit on SE and NW; 245 is the real, complete count.
  { id: '901521322569', kind: 'list', region: 'CVW', label: 'Opportunities W', excludeSubtasksAndBlank: true },
];
const WRITE = process.argv.includes('--write');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateCampaign(admin: any, name: string, actorId: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const { data: existing } = await admin.from('marketing_campaigns').select('id').eq('name', name).is('deleted_at', null).limit(1).maybeSingle();
  if (existing) { cache.set(name, existing.id); return existing.id; }
  const campaign = await createCampaign(admin, { name, campaignType: 'trade_fair', source: 'trade_fair' }, actorId);
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

  if (WRITE) {
    const probe = await admin.from('prospect_needs').select('external_ref').limit(1);
    if (probe.error) { console.error('Migration 090 is not applied yet:', probe.error.message); process.exit(1); }
  }

  const actorEmail = process.env.CLICKUP_IMPORT_ACTOR_EMAIL || 'batool@trust-lines.com';
  const { data: actor, error: actorErr } = await admin.from('profiles').select('id, full_name, role').eq('email', actorEmail).maybeSingle();
  if (actorErr || !actor) { console.error(`Could not resolve actor profile for ${actorEmail}:`, actorErr?.message ?? 'not found'); process.exit(1); }
  console.log(`${WRITE ? 'IMPORTING' : 'DRY RUN'} as ${actor.full_name} (${actor.role}, ${actorEmail})`);
  const actorId: string = actor.id;

  const candidates = [];
  for (const src of SOURCES) {
    console.log(`Fetching "${src.label}"...`);
    const tasks: ClickUpTask[] = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`  ${tasks.length} task(s)`);
    let droppedSubtask = 0, droppedBlank = 0;
    for (const t of tasks) {
      if (src.excludeSubtasksAndBlank) {
        if (t.parent) { droppedSubtask += 1; continue; }
        const statusOpField = (t.custom_fields ?? []).find(f => f.name === 'Status OP');
        const statusOpValue = statusOpField ? resolveCustomFieldValue(statusOpField) : null;
        if (!statusOpValue) { droppedBlank += 1; continue; }
      }
      candidates.push(mapTaskToOpportunityCandidate(t, src.region));
    }
    if (src.excludeSubtasksAndBlank) console.log(`  dropped ${droppedSubtask} subtask(s), ${droppedBlank} blank-Status-OP task(s)`);
  }

  const { data: existingNeeds } = await admin.from('prospect_needs').select('external_ref').eq('external_source', 'clickup').not('external_ref', 'is', null);
  const existingNeedRefs = new Set(((existingNeeds ?? []) as { external_ref: string }[]).map(r => r.external_ref));

  let matched = 0, createdProspect = 0, skipped = 0, created = 0, failed = 0;
  let potentials = 0, opportunities = 0;
  const stageCounts = new Map<string, number>();
  const unmatchedContacts: string[] = [];
  const campaignCache = new Map<string, string>();

  for (const c of candidates) {
    if (existingNeedRefs.has(c.externalRef)) { skipped += 1; continue; }
    stageCounts.set(c.statusOpRaw, (stageCounts.get(c.statusOpRaw) ?? 0) + 1);
    if (c.outcome.kind === 'potential') potentials += 1; else opportunities += 1;

    try {
      // Resolve the Prospect via the already-imported Contact link.
      let prospectId: string | null = null;
      let locationId: string | null = null;
      if (c.contactExternalRef) {
        const { data: existingProspect } = await admin.from('prospects')
          .select('id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
        if (existingProspect) {
          prospectId = existingProspect.id; matched += 1;
        } else {
          // The linked ClickUp Contact may now be a NESTED contact (a Person subtask
          // under a COMPANY task, imported as an extra prospect_contacts row rather than
          // its own top-level Prospect — see the Contacts NE rebuild). Resolve up to the
          // parent Prospect via prospect_contacts.external_ref before giving up.
          const { data: nestedContact } = await admin.from('prospect_contacts')
            .select('prospect_id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
          if (nestedContact) { prospectId = nestedContact.prospect_id; matched += 1; }
          else unmatchedContacts.push(c.contactExternalRef);
        }
      }

      const attributedUser = actorId;
      let sourceLabel: string | null = null;
      let campaignId: string | null = null;
      if (c.sourceClassification?.kind === 'campaign') {
        sourceLabel = 'trade_fair';
        if (WRITE) campaignId = await getOrCreateCampaign(admin, c.sourceClassification.raw, actorId, campaignCache);
      } else if (c.sourceClassification?.kind === 'generic') {
        sourceLabel = c.sourceClassification.leadSource;
      }

      if (!prospectId) {
        createdProspect += 1;
        if (WRITE) {
          const { data: newProspect, error: pErr } = await admin.from('prospects').insert({
            entity_type: 'organization',
            organization_name: c.brand ?? c.siteName,
            business_types: c.businessTypes,
            source_label: sourceLabel,
            campaign_id: campaignId,
            latest_source_label: sourceLabel,
            latest_campaign_id: campaignId,
            region: c.region,
            status: 'captured',
            owner_id: attributedUser,
            assigned_marketing_user_id: attributedUser,
            external_source: 'clickup',
            external_ref: `opportunity-fallback:${c.externalRef}`,
            created_by: attributedUser,
          }).select('id').single();
          if (pErr) throw new Error(`prospect insert: ${pErr.message}`);
          prospectId = newProspect.id;
        }
      } else if (WRITE && campaignId) {
        // Existing Prospect (matched via Contact) — only the LATEST touch updates;
        // original source_label/campaign_id are never overwritten (same rule as the
        // Contacts import and the public survey pipeline).
        await admin.from('prospects').update({ latest_source_label: sourceLabel, latest_campaign_id: campaignId }).eq('id', prospectId);
      }

      if (WRITE) {
        if (c.state || c.formattedAddress || c.latitude != null) {
          const { data: loc } = await admin.from('prospect_locations').insert({
            prospect_id: prospectId, address_line_1: c.formattedAddress, state: c.state,
            latitude: c.latitude, longitude: c.longitude, is_active: true,
          }).select('id').single();
          locationId = loc?.id ?? null;
        }

        const description = c.description || [
          c.requestRaw ? `Request: ${c.requestRaw}` : null,
          c.externalProjectCode ? `ClickUp Project #: ${c.externalProjectCode}` : null,
        ].filter(Boolean).join(' | ') || null;

        const needClassification = c.outcome.kind === 'opportunity' ? 'opportunity' : 'potential';
        const { data: need, error: nErr } = await admin.from('prospect_needs').insert({
          prospect_id: prospectId, location_id: locationId, title: c.siteName, description,
          project_types: c.projectType ? [c.projectType] : [],
          region: c.region, service_line: c.serviceLine, state: c.state,
          source: sourceLabel, status: 'open',
          classification: needClassification,
          classification_reasons: [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`],
          classification_rule_version: CLASSIFICATION_RULE_VERSION,
          external_source: 'clickup', external_ref: c.externalRef,
          created_by: attributedUser,
        }).select('id').single();
        if (nErr) throw new Error(`need insert: ${nErr.message}`);

        await importNeedComments(admin, need.id, c.externalRef);

        // The matched/created Prospect's primary contact (e.g. the real "Don Leavitt"
        // imported earlier as prospect_contacts.is_primary) — without this the board's
        // "Contact" column shows "—" even though the real person is already in our DB.
        // Needed for BOTH outcomes now that the unified board shows Contact on Potential
        // rows too (2026-08-14).
        let primaryContactId: string | null = null;
        if (prospectId) {
          const { data: primaryContact } = await admin.from('prospect_contacts')
            .select('id').eq('prospect_id', prospectId).eq('is_primary', true).limit(1).maybeSingle();
          primaryContactId = primaryContact?.id ?? null;
        }

        if (c.outcome.kind === 'opportunity') {
          const isClosed = c.outcome.stage === 'closed_won' || c.outcome.stage === 'closed_lost';

          await admin.from('opportunities').insert({
            prospect_id: prospectId, need_id: need.id, title: c.siteName,
            project_types: c.projectType ? [c.projectType] : [],
            stage: c.outcome.stage, source_label: sourceLabel, marketing_owner_id: attributedUser,
            region: c.region, primary_contact_id: primaryContactId,
            external_project_code: c.externalProjectCode,
            estimated_value: c.dealSize, deadline: c.dueDate, deposit: c.deposit, payment_raw: c.paymentRaw, targeted: c.targeted,
            auto_managed: false,
            classification_reasons: [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`],
            classification_rule_version: CLASSIFICATION_RULE_VERSION,
            external_source: 'clickup', external_ref: c.externalRef, external_stage_label: c.statusOpRaw,
            state: c.state, formatted_address: c.formattedAddress, brand: c.brand,
            business_types: c.businessTypes, industry_raw: c.industryRaw, project_type_raw: c.projectTypeRaw,
            request_raw: c.requestRaw, to_do_raw: c.toDoRaw, direct_contact_raw: c.directContactRaw,
            source_raw_label: c.sourceRaw, tags: c.tags, external_created_at: c.externalCreatedAt,
            source_description_raw: c.description,
            ...(isClosed ? { closed_at: c.dateDone ?? new Date().toISOString(), closed_reason: c.statusOpRaw } : {}),
            created_by: attributedUser,
          });
        } else {
          await admin.from('prospect_potentials').insert({
            need_id: need.id, prospect_id: prospectId, title: c.siteName, status: 'identified',
            primary_contact_id: primaryContactId, region: c.region,
            external_project_code: c.externalProjectCode,
            estimated_value: c.dealSize, due_date: c.dueDate, date_done: c.dateDone, deposit: c.deposit, payment_raw: c.paymentRaw, targeted: c.targeted,
            auto_managed: false, assigned_to: attributedUser,
            classification_reasons: [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`],
            classification_rule_version: CLASSIFICATION_RULE_VERSION,
            external_source: 'clickup', external_ref: c.externalRef, external_stage_label: c.statusOpRaw,
            state: c.state, formatted_address: c.formattedAddress, brand: c.brand,
            business_types: c.businessTypes, industry_raw: c.industryRaw, project_type_raw: c.projectTypeRaw,
            request_raw: c.requestRaw, to_do_raw: c.toDoRaw, direct_contact_raw: c.directContactRaw,
            source_raw_label: c.sourceRaw, tags: c.tags, external_created_at: c.externalCreatedAt,
            source_description_raw: c.description,
            created_by: attributedUser,
          });
        }
      }

      created += 1;
    } catch (e) {
      failed += 1;
      console.error(`  FAILED "${c.siteName}" (${c.externalRef}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n── ${WRITE ? 'Import' : 'Dry run'} summary ──`);
  console.log(`Total candidates: ${candidates.length}`);
  console.log(`Skipped (already imported): ${skipped}`);
  console.log(`${WRITE ? 'Created' : 'Would create'}: ${created} (${potentials} Potentials, ${opportunities} Opportunities)`);
  console.log(`Prospect matched via Contact link: ${matched}`);
  console.log(`Prospect ${WRITE ? 'created' : 'would be created'} (no Contact match): ${createdProspect}`);
  console.log(`Failed: ${failed}`);
  console.log('\n── Status OP breakdown ──');
  for (const [k, v] of stageCounts) console.log(`  ${k}: ${v}`);
  if (unmatchedContacts.length) {
    console.log(`\n${unmatchedContacts.length} Contact link(s) did not match an already-imported Prospect (a new Prospect ${WRITE ? 'was' : 'would be'} created instead).`);
  }

  if (!WRITE) {
    writeFileSync('scripts/clickup-import-opportunities-dry-run.json', JSON.stringify(candidates, null, 2));
    console.log('\nFull candidate list saved to scripts/clickup-import-opportunities-dry-run.json.');
    console.log('NOTHING was written — re-run with --write to actually import.');
  } else {
    await logAudit({
      actorId, action: 'opportunity.bulk_imported_clickup',
      newValue: { created, potentials, opportunities, matched, createdProspect, failed },
    });
  }
}

main().catch(e => {
  console.error('Failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
