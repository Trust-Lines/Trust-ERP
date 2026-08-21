// One-off backfill: migration 094 added prospects.source_raw_label/x_note and
// prospect_contacts.company2_phone, migration 096 added prospects.tags — fields that
// existed in ClickUp all along but the original Contacts import (088) never captured.
// (external_project_code/project_info were
// also added by 094 and briefly backfilled here, then removed 2026-08-13 per user
// request — "PROJECT # ile Project info kısmında gerek yok, onları sil" — the columns
// still exist in the DB, just no longer read/written anywhere.) Also fixes a
// real bug: the WhatsApp checkbox was read via 'WhatsApp' (capital A) but the actual
// ClickUp field is named 'Whatsapp' — the lookup never matched, so every already-imported
// contact's whatsapp column is wrong (always false). Re-fetches the SAME source view/list
// in bulk (one call, not per-contact — cheap and fast, unlike the checklist/notes
// backfill which needs a per-task detail call), re-runs the mapping, and UPDATEs existing
// rows matched by external_ref. Idempotent — safe to re-run.
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks } from '../lib/clickup/client';
import { mapTaskToProspectCandidate, type RegionTag } from '../lib/clickup/importMapping';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

// Same source table this session's rebuild has used so far — extend as more regions come in.
const SOURCES: { id: string; kind: 'view' | 'list'; region: RegionTag; label: string }[] = [
  { id: '901509135417', kind: 'list', region: 'TLINES_NE', label: 'Contacts NE' },
];

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set.'); process.exit(1); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  let prospectsUpdated = 0, contactsUpdated = 0, notFound = 0;

  for (const src of SOURCES) {
    console.log(`Fetching "${src.label}"...`);
    const tasks = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`  ${tasks.length} task(s)`);
    const candidates = tasks.map(t => mapTaskToProspectCandidate(t, src.region, src.label));

    for (const c of candidates) {
      const { data: prospect } = await admin.from('prospects')
        .select('id').eq('external_source', 'clickup').eq('external_ref', c.externalRef).maybeSingle();
      if (!prospect) { notFound += 1; continue; }

      const { error: pErr } = await admin.from('prospects').update({
        source_raw_label: c.sourceRaw,
        x_note: c.xNote,
        tags: c.tags,
        external_created_at: c.externalCreatedAt,
      }).eq('id', prospect.id);
      if (!pErr) prospectsUpdated += 1;

      const { error: cErr } = await admin.from('prospect_contacts').update({
        company2_phone: c.company2Phone,
        whatsapp: c.whatsapp,
      }).eq('prospect_id', prospect.id).eq('is_primary', true);
      if (!cErr) contactsUpdated += 1;
    }
  }

  console.log('\n── Done ──');
  console.log(`Prospects updated: ${prospectsUpdated}`);
  console.log(`Contacts updated: ${contactsUpdated}`);
  console.log(`Not found (not yet imported): ${notFound}`);
}
main();
