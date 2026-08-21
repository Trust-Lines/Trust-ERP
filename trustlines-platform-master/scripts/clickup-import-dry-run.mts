// ── ClickUp Contacts → Prospect DRY RUN (reads ClickUp + reads our DB, WRITES NOTHING) ─
// Run:
//   npm run clickup:dry-run
// Reads every task from the 5 real Contact sources found during discovery (see
// docs/CLICKUP_IMPORT.md), maps each one through lib/clickup/importMapping.ts, and
// reports what a REAL import would do — new vs already-imported (by external_ref),
// which Campaigns would be created, how many candidates are missing email+phone (blank
// entries, e.g. "Call Kuldip Singh"/"Follow up Call" — imported anyway per the user's
// explicit instruction, just called out here for visibility).
//
// Absolutely no writes: not to ClickUp (this whole module only ever GETs), not to our
// Supabase DB (the one query against `prospects` here is a SELECT, checking what a real
// run would skip vs create).

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks } from '../lib/clickup/client';
import { mapTaskToProspectCandidate, type ProspectCandidate, type RegionTag } from '../lib/clickup/importMapping';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

// The exact IDs resolved during discovery (npm run clickup:discover) — kept here rather
// than re-resolved every run since View→parent-List resolution has already been done
// once and confirmed against the real workspace.
const SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string }[] = [
  { id: 'dhdc7-4330', kind: 'view', region: 'TLINES_NE', label: 'NE (view dhdc7-4330)' },
  { id: 'dhdc7-36235', kind: 'view', region: 'TLINES_SE', label: 'SE (view dhdc7-36235)' },
  { id: '901520164564', kind: 'list', region: 'TLINES_NW', label: 'Contacts NW' },
  { id: '901521038479', kind: 'list', region: 'CVW', label: 'Contacts W (Tlines)' },
  { id: '901521260903', kind: 'list', region: 'CVW', label: 'Contacts W (CVWTLINES)' },
];

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) {
    console.error('CLICKUP_API_TOKEN is not set in .env.local.');
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase env vars are not set in .env.local.');
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) as any;

  const allCandidates: ProspectCandidate[] = [];

  for (const src of SOURCES) {
    console.log(`Fetching "${src.label}"...`);
    const tasks = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`  ${tasks.length} task(s)`);
    for (const t of tasks) allCandidates.push(mapTaskToProspectCandidate(t, src.region, src.label));
  }

  console.log(`\nTotal candidates: ${allCandidates.length}`);

  // What's already been imported (idempotency check) — READ ONLY.
  const { data: existing, error: existingErr } = await admin
    .from('prospects').select('external_ref').eq('external_source', 'clickup').not('external_ref', 'is', null);
  if (existingErr) {
    console.error('Could not read existing prospects (is migration 088 applied yet?):', existingErr.message);
    console.error('Continuing dry-run assuming ZERO already imported — the "new" count below may be an overcount.');
  }
  const existingRefs = new Set(((existing ?? []) as { external_ref: string }[]).map(r => r.external_ref));
  const newCount = allCandidates.filter(c => !existingRefs.has(c.externalRef)).length;

  const blankCount = allCandidates.filter(c => !c.email && !c.phone).length;
  const byRegion = new Map<string, number>();
  for (const c of allCandidates) byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + 1);

  const campaignNames = new Map<string, number>();
  const genericSourceCounts = new Map<string, number>();
  const showAttendedCounts = new Map<string, number>();
  for (const c of allCandidates) {
    if (c.sourceClassification?.kind === 'campaign') {
      campaignNames.set(c.sourceClassification.raw, (campaignNames.get(c.sourceClassification.raw) ?? 0) + 1);
    } else if (c.sourceClassification?.kind === 'generic') {
      genericSourceCounts.set(c.sourceClassification.leadSource, (genericSourceCounts.get(c.sourceClassification.leadSource) ?? 0) + 1);
    }
    for (const show of c.showsAttended) showAttendedCounts.set(show, (showAttendedCounts.get(show) ?? 0) + 1);
  }

  console.log('\n── By region ──');
  for (const [region, count] of byRegion) console.log(`  ${region}: ${count}`);

  console.log(`\n── Would create: ${newCount} new Prospects, would skip ${allCandidates.length - newCount} already-imported ──`);
  console.log(`── ${blankCount} candidate(s) have neither email nor phone (imported anyway, per instruction) ──`);

  console.log(`\n── Would create ${campaignNames.size} distinct Campaign(s) (from "13-SOURCE" values that aren't generic) ──`);
  for (const [name, count] of [...campaignNames.entries()].sort((a, b) => b[1] - a[1])) console.log(`  "${name}" — ${count} contact(s)`);

  console.log(`\n── Generic source (LeadSource) distribution ──`);
  for (const [source, count] of genericSourceCounts) console.log(`  ${source}: ${count}`);

  console.log(`\n── "Shows attended" values (${showAttendedCounts.size} distinct) — becomes campaign_interactions, may overlap with SOURCE campaigns above ──`);
  for (const [name, count] of [...showAttendedCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  "${name}" — ${count} contact(s)`);

  writeFileSync('scripts/clickup-import-dry-run-output.json', JSON.stringify(allCandidates, null, 2));
  console.log(`\nFull candidate list saved to scripts/clickup-import-dry-run-output.json (${allCandidates.length} records).`);
  console.log('NOTHING was written to ClickUp or to the app database — this was a dry run only.');
}

main().catch(e => {
  console.error('Dry run failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
