// ── ClickUp Contacts → "only the new ones" DRY RUN (READ ONLY: ClickUp GETs + DB SELECTs) ──
// Run:  npx tsx scripts/clickup-new-only-dry-run.mts
//
// For a top-up import after the first one: which ClickUp contacts are NEW (no prospect /
// prospect_contacts row with their ClickUp id yet), and which of those look like a person someone
// already added by hand in the app (same email or phone, no ClickUp id) — those must not be
// imported as duplicates. Nothing is written to ClickUp or to the database.
//
// Unlike clickup-import-dry-run.mts this pages through every existing row (a single select stops
// at 1000 rows, which would count old contacts as "new").

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks } from '../lib/clickup/client';
import { mapTaskToProspectCandidate, type ProspectCandidate, type RegionTag } from '../lib/clickup/importMapping';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
    if (!l.includes('=') || l.trim().startsWith('#')) continue;
    const i = l.indexOf('=');
    const k = l.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = l.slice(i + 1).trim();
  }
}

// The sources the real import uses (scripts/clickup-import-write.mts) — NOT the ones in
// clickup-import-dry-run.mts: its NE view dhdc7-4330 was the wrong source, deleted on purpose
// (scripts/cleanup-ne-wrong-source.mts).
const SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string }[] = [
  { id: '901509135417', kind: 'list', region: 'TLINES_NE', label: 'Contacts NE' },
  { id: '901519728494', kind: 'list', region: 'TLINES_SE', label: 'Contacts SE' },
  { id: '901520164564', kind: 'list', region: 'TLINES_NW', label: 'Contacts NW' },
  { id: '901521038479', kind: 'list', region: 'CVW', label: 'Contacts West (Tlines)' },
  { id: '901521260903', kind: 'list', region: 'CVW', label: 'Contacts West (CVWTLINES)' },
];

const normEmail = (e: string | null | undefined) => (e ?? '').trim().toLowerCase() || null;
const normPhone = (p: string | null | undefined) => { const d = (p ?? '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : null; };

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set in .env.local.'); process.exit(1); }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Supabase env vars are not set in .env.local.'); process.exit(1); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) as any;

  // Read-only, paged (1000 per page).
  async function readAll<T>(table: string, cols: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select(cols).range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  const candidates: ProspectCandidate[] = [];
  const parentOf = new Map<string, string | null>();
  for (const src of SOURCES) {
    process.stdout.write(`ClickUp "${src.label}"… `);
    const tasks = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`${tasks.length} task(s) (${tasks.filter(t => !t.parent).length} companies/people, ${tasks.filter(t => !!t.parent).length} nested contacts)`);
    for (const t of tasks) { candidates.push(mapTaskToProspectCandidate(t, src.region, src.label)); parentOf.set(t.id, (t.parent as string | null) ?? null); }
  }

  console.log('Reading our database (SELECT only)…');
  const prospects = await readAll<{ id: string; display_name: string | null; main_email: string | null; main_phone: string | null; external_source: string | null; external_ref: string | null; deleted_at: string | null }>(
    'prospects', 'id, display_name, main_email, main_phone, external_source, external_ref, deleted_at');
  const contacts = await readAll<{ id: string; prospect_id: string; name: string | null; email: string | null; phone: string | null; external_source: string | null; external_ref: string | null }>(
    'prospect_contacts', 'id, prospect_id, name, email, phone, external_source, external_ref');

  const importedRefs = new Set<string>();
  for (const r of [...prospects, ...contacts]) if (r.external_source === 'clickup' && r.external_ref) importedRefs.add(r.external_ref);

  // Hand-added records (no ClickUp id) by email / phone — what a new ClickUp contact may duplicate.
  const manualByEmail = new Map<string, string>();
  const manualByPhone = new Map<string, string>();
  for (const p of prospects) {
    if (p.external_ref || p.deleted_at) continue;
    const label = `prospect "${p.display_name ?? p.id}"`;
    const e = normEmail(p.main_email); if (e && !manualByEmail.has(e)) manualByEmail.set(e, label);
    const ph = normPhone(p.main_phone); if (ph && !manualByPhone.has(ph)) manualByPhone.set(ph, label);
  }
  for (const c of contacts) {
    if (c.external_ref) continue;
    const label = `contact "${c.name ?? c.id}"`;
    const e = normEmail(c.email); if (e && !manualByEmail.has(e)) manualByEmail.set(e, label);
    const ph = normPhone(c.phone); if (ph && !manualByPhone.has(ph)) manualByPhone.set(ph, label);
  }
  // Any existing record (imported or not) by email — a "new" ClickUp task with an email we already
  // have is most likely the same person under a second ClickUp task.
  const anyEmail = new Set<string>();
  for (const p of prospects) { const e = normEmail(p.main_email); if (e && !p.deleted_at) anyEmail.add(e); }
  for (const c of contacts) { const e = normEmail(c.email); if (e) anyEmail.add(e); }

  const fresh = candidates.filter(c => !importedRefs.has(c.externalRef));
  const seenInRun = new Set<string>();
  const report = fresh.map(c => {
    const e = normEmail(c.email), ph = normPhone(c.phone);
    const manual = (e && manualByEmail.get(e)) || (ph && manualByPhone.get(ph)) || null;
    const dupInRun = seenInRun.has(c.externalRef); seenInRun.add(c.externalRef);
    return {
      externalRef: c.externalRef, region: c.region, list: c.sourceListPath,
      kind: parentOf.get(c.externalRef) ? (importedRefs.has(parentOf.get(c.externalRef)!) ? 'extra contact on an existing company' : 'extra contact on a new company') : 'company/person',
      name: c.organizationName ?? c.personName ?? c.contactName, email: c.email, phone: c.phone,
      createdInClickUp: c.externalCreatedAt,
      verdict: dupInRun ? 'skip: same task listed twice' : manual ? `HOLD: matches app-added ${manual}` : e && anyEmail.has(e) ? 'HOLD: email already in the app' : 'new',
    };
  });

  const byRegion = new Map<string, { total: number; fresh: number }>();
  for (const c of candidates) { const r = byRegion.get(c.region) ?? { total: 0, fresh: 0 }; r.total++; byRegion.set(c.region, r); }
  for (const c of fresh) byRegion.get(c.region)!.fresh++;

  const count = (v: string) => report.filter(r => r.verdict.startsWith(v)).length;
  console.log(`\nClickUp contacts: ${candidates.length}   already in the app: ${candidates.length - fresh.length}   not yet imported: ${fresh.length}`);
  console.log('\n── By region (ClickUp total / not yet imported) ──');
  for (const [r, v] of byRegion) console.log(`  ${r}: ${v.total} / ${v.fresh}`);
  console.log(`\n── Of the ${fresh.length} not yet imported ──`);
  console.log(`  new (would be added):                     ${count('new')}`);
  console.log(`  HOLD — looks like an app-added contact:    ${report.filter(r => r.verdict.startsWith('HOLD: matches')).length}`);
  console.log(`  HOLD — email already in the app:           ${report.filter(r => r.verdict === 'HOLD: email already in the app').length}`);
  console.log(`  skipped (same task twice in the sources):  ${count('skip')}`);
  const kinds = new Map<string, number>();
  for (const r of report.filter(r => r.verdict === 'new')) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  console.log('\n── The new ones, by kind ──');
  for (const [k, n] of kinds) console.log(`  ${k}: ${n}`);
  const held = report.filter(r => r.verdict.startsWith('HOLD'));
  if (held.length) {
    console.log('\n── HOLD details (first 40) ──');
    for (const h of held.slice(0, 40)) console.log(`  [${h.region}] ${h.name} <${h.email ?? h.phone ?? '—'}> → ${h.verdict}`);
  }
  console.log(`\nApp-added records (no ClickUp id) in the DB: ${prospects.filter(p => !p.external_ref && !p.deleted_at).length} prospects, ${contacts.filter(c => !c.external_ref).length} contacts — none of them are touched.`);

  writeFileSync('scripts/clickup-new-only-dry-run-output.json', JSON.stringify(report, null, 2));
  console.log('Details: scripts/clickup-new-only-dry-run-output.json');
  console.log('NOTHING was written to ClickUp or to the app database — dry run only.');
}

main().catch(e => { console.error('Dry run failed:', e instanceof Error ? e.message : e); process.exit(1); });
