// ── ClickUp Opportunities list → Potentials ONLY (one region at a time) ─────────────────
// Dry run (default, writes nothing):
//   npx tsx scripts/clickup-import-potentials-only.mts TLINES_NE
// Real write:
//   npx tsx scripts/clickup-import-potentials-only.mts TLINES_NE --write
//
// Deliberately narrower than clickup-import-opportunities.mts:
//   - Only tasks whose Status OP maps to 'potential' (mapStatusOp: "Potential" / "In Target
//     List") are touched at all — every other stage (READY TO START, DEAL CLOSED, etc.) is
//     Sales's data and is left completely alone, per explicit instruction
//     ("kalanları sales kısmına gidecek").
//   - One region per run, not all four at once — the full-import script silently kept
//     running in the background past its supposed stop point (2026-09-17) and created 141
//     bad "address-only" fallback Prospects before that was caught; running region-by-region
//     keeps each run small enough to sanity-check before moving to the next.
//   - No fallback-prospect creation. If a task's linked ClickUp Contact doesn't already
//     exist in our Contacts (must have been imported by clickup-import-write.mts first),
//     this SKIPS it and reports it — it never invents a new address-only Prospect, which is
//     exactly the bad pattern the two changes above exist to avoid.

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks, type ClickUpTask } from '../lib/clickup/client';
import { mapTaskToOpportunityCandidate } from '../lib/clickup/importOpportunitiesMapping';
import type { RegionTag } from '../lib/clickup/importMapping';
import { createCampaign, setCampaignStatus } from '../lib/marketing/campaigns';
import { CLASSIFICATION_RULE_VERSION } from '../lib/marketing/classification';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

// Same source list as clickup-import-opportunities.mts (SOURCES array) — one entry per run.
const SOURCES: Record<RegionTag, { id: string; kind: 'view' | 'list'; label: string; excludeSubtasksAndBlank?: boolean }> = {
  TLINES_NE: { id: 'dhdc7-54915', kind: 'view', label: 'Opportunities NE' },
  TLINES_SE: { id: '901521558768', kind: 'list', label: 'Opportunities SE', excludeSubtasksAndBlank: true },
  TLINES_NW: { id: '901521515967', kind: 'list', label: 'Opportunities NW', excludeSubtasksAndBlank: true },
  CVW: { id: '901521322569', kind: 'list', label: 'Opportunities W', excludeSubtasksAndBlank: true },
};

const WRITE = process.argv.includes('--write');
const ALLOW_FALLBACK = process.argv.includes('--allow-fallback');
const REGION = process.argv[2] as RegionTag | undefined;

async function main() {
  loadEnvLocal();
  if (!REGION || !SOURCES[REGION]) {
    console.error('Usage: tsx scripts/clickup-import-potentials-only.mts <TLINES_NE|TLINES_SE|TLINES_NW|CVW> [--write]');
    process.exit(1);
  }
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set.'); process.exit(1); }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const actorEmail = process.env.CLICKUP_IMPORT_ACTOR_EMAIL || 'hamzag@trust-lines.com';
  const { data: actor, error: actorErr } = await admin.from('profiles').select('id, full_name, role').eq('email', actorEmail).maybeSingle();
  if (actorErr || !actor) { console.error(`Could not resolve actor profile for ${actorEmail}:`, actorErr?.message ?? 'not found'); process.exit(1); }
  console.log(`${WRITE ? 'WRITING' : 'DRY RUN'} as ${actor.full_name} (${actor.role}) — region ${REGION}`);
  const actorId: string = actor.id;

  const src = SOURCES[REGION];
  console.log(`Fetching "${src.label}"...`);
  let tasks: ClickUpTask[] = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
  if (src.excludeSubtasksAndBlank) {
    tasks = tasks.filter(t => !t.parent);
  }
  console.log(`  ${tasks.length} task(s) fetched`);

  // 🔴 2026-09-17: mapStatusOp() (shared with clickup-import-opportunities.mts) buckets
  // "Potential" AND "In Target List" together as outcome.kind === 'potential' — correct for
  // that script's structural purpose, but the user counts them as two DIFFERENT things
  // (confirmed live: "NE was 18" / "SE has 7" — both match the literal "Potential" count
  // exactly, excluding "In Target List"). This script only ever imports the literal
  // "Potential" label; "In Target List" stays untouched until asked for separately.
  const allCandidates = tasks.map(t => mapTaskToOpportunityCandidate(t, REGION));
  const potentials = allCandidates.filter(c => c.outcome.kind === 'potential' && c.statusOpRaw.trim() === 'Potential');
  console.log(`  ${potentials.length} are Status OP = "Potential" exactly (the only ones this run touches — "In Target List" is left alone)`);

  const { data: existingNeeds } = await admin.from('prospect_needs').select('external_ref').eq('external_source', 'clickup');
  const existingNeedRefs = new Set(((existingNeeds ?? []) as { external_ref: string }[]).map(r => r.external_ref));

  let skippedAlready = 0, skippedNoContact = 0, created = 0, failed = 0, fallbackCreated = 0;
  const campaignCache = new Map<string, string>();
  const noContactSamples: string[] = [];

  for (const c of potentials) {
    if (existingNeedRefs.has(c.externalRef)) { skippedAlready += 1; continue; }

    try {
      let prospectId: string | null = null;
      if (c.contactExternalRef) {
        const { data: directProspect } = await admin.from('prospects')
          .select('id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
        if (directProspect) {
          prospectId = directProspect.id;
        } else {
          const { data: nestedContact } = await admin.from('prospect_contacts')
            .select('prospect_id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
          if (nestedContact) prospectId = nestedContact.prospect_id;
        }
      }

      if (!prospectId) {
        // Opt-in only (--allow-fallback) — checked live 2026-09-17: 2 of these had a REAL
        // Contact link in ClickUp that simply isn't a member of any of our 5 imported
        // Contacts lists (deleted or moved on ClickUp's side, not an import bug), but the
        // Opportunity task itself still carries a real "Brand" name for them. Falls back to
        // the raw site name only when even that's missing (rare — 1 of 3 in the first run).
        if (!ALLOW_FALLBACK) {
          skippedNoContact += 1;
          if (noContactSamples.length < 15) noContactSamples.push(`${c.siteName} (${c.externalRef})`);
          continue;
        }
        if (!WRITE) { created += 1; continue; }
        const { data: newProspect, error: pErr } = await admin.from('prospects').insert({
          entity_type: 'organization',
          organization_name: c.brand ?? c.siteName,
          business_types: c.businessTypes,
          region: c.region, regions: [c.region],
          status: 'captured',
          owner_id: null, assigned_marketing_user_id: null,
          external_source: 'clickup', external_ref: `opportunity-fallback:${c.externalRef}`,
          created_by: actorId,
        }).select('id').single();
        if (pErr) throw new Error(`fallback prospect insert: ${pErr.message}`);
        prospectId = newProspect.id;
        fallbackCreated += 1;
      }

      if (!WRITE) { created += 1; continue; }

      let sourceLabel: string | null = null;
      let campaignId: string | null = null;
      if (c.sourceClassification?.kind === 'campaign') {
        sourceLabel = 'trade_fair';
        campaignId = await createCampaign(admin, { name: c.sourceClassification.raw, campaignType: 'trade_fair', source: 'trade_fair' }, actorId)
          .then(async camp => { await setCampaignStatus(admin, camp.id, 'closed'); return camp.id; })
          .catch(async () => {
            const { data: existingCamp } = await admin.from('marketing_campaigns').select('id').eq('name', c.sourceClassification!.raw).is('deleted_at', null).limit(1).maybeSingle();
            return existingCamp?.id ?? null;
          });
      } else if (c.sourceClassification?.kind === 'generic') {
        sourceLabel = c.sourceClassification.leadSource;
      }
      if (campaignId) campaignCache.set(c.sourceClassification!.raw, campaignId);

      let locationId: string | null = null;
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

      const { data: need, error: nErr } = await admin.from('prospect_needs').insert({
        prospect_id: prospectId, location_id: locationId, title: c.siteName, description,
        project_types: c.projectType ? [c.projectType] : [],
        region: c.region, service_line: c.serviceLine, state: c.state,
        source: sourceLabel, status: 'open',
        classification: 'potential',
        classification_reasons: [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`],
        classification_rule_version: CLASSIFICATION_RULE_VERSION,
        external_source: 'clickup', external_ref: c.externalRef,
        created_by: actorId,
      }).select('id').single();
      if (nErr) throw new Error(`need insert: ${nErr.message}`);

      const { data: primaryContact } = await admin.from('prospect_contacts')
        .select('id').eq('prospect_id', prospectId).eq('is_primary', true).limit(1).maybeSingle();

      const { error: potErr } = await admin.from('prospect_potentials').insert({
        need_id: need.id, prospect_id: prospectId, title: c.siteName, status: 'identified',
        primary_contact_id: primaryContact?.id ?? null, region: c.region,
        external_project_code: c.externalProjectCode,
        estimated_value: c.dealSize, due_date: c.dueDate, date_done: c.dateDone, deposit: c.deposit, payment_raw: c.paymentRaw, targeted: c.targeted,
        auto_managed: false, assigned_to: null,
        classification_reasons: [`Imported from ClickUp — Status OP: ${c.statusOpRaw}`],
        classification_rule_version: CLASSIFICATION_RULE_VERSION,
        external_source: 'clickup', external_ref: c.externalRef, external_stage_label: c.statusOpRaw,
        state: c.state, formatted_address: c.formattedAddress, brand: c.brand,
        business_types: c.businessTypes, industry_raw: c.industryRaw, project_type_raw: c.projectTypeRaw,
        request_raw: c.requestRaw, to_do_raw: c.toDoRaw, direct_contact_raw: c.directContactRaw,
        source_raw_label: c.sourceRaw, tags: c.tags, external_created_at: c.externalCreatedAt,
        source_description_raw: c.description,
        created_by: actorId,
      });
      if (potErr) throw new Error(`potential insert: ${potErr.message}`);

      created += 1;
    } catch (e) {
      failed += 1;
      console.error(`  FAILED "${c.siteName}" (${c.externalRef}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n── ${WRITE ? 'Import' : 'Dry run'} summary (${REGION}) ──`);
  console.log(`Potential-stage candidates: ${potentials.length}`);
  console.log(`Already imported (skipped): ${skippedAlready}`);
  if (ALLOW_FALLBACK) {
    console.log(`No matching Contact (created as a new fallback Prospect): ${fallbackCreated}`);
  } else {
    console.log(`No matching Contact (skipped, NOT created as a new Prospect): ${skippedNoContact}`);
  }
  console.log(`${WRITE ? 'Created' : 'Would create'}: ${created}`);
  console.log(`Failed: ${failed}`);
  if (noContactSamples.length) {
    console.log(`\nSample of skipped-for-no-Contact (first ${noContactSamples.length}):`);
    for (const s of noContactSamples) console.log(`  ${s}`);
  }
  if (!WRITE) console.log('\nNOTHING was written — re-run with --write to actually import.');
}
main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
