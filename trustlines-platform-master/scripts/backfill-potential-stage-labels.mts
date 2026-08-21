// One-off backfill: the 23 Potential/In Target List rows imported by
// scripts/clickup-import-opportunities.mts BEFORE migration 091 added
// external_source/external_ref/external_stage_label to prospect_potentials. Derives
// everything from data already in our own DB (the parent Need's external_ref +
// this row's own classification_reasons text) — no ClickUp call needed, still
// read-only (SELECT) plus a targeted UPDATE only on rows this script itself identifies.
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

async function main() {
  loadEnvLocal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  const { data: potentials, error } = await admin.from('prospect_potentials')
    .select('id, need_id, classification_reasons, external_ref').is('deleted_at', null);
  if (error) { console.error(error.message); process.exit(1); }

  const needIds = [...new Set((potentials ?? []).map((p: { need_id: string }) => p.need_id))];
  const { data: needs } = await admin.from('prospect_needs').select('id, external_source, external_ref').in('id', needIds);
  const needById = Object.fromEntries((needs ?? []).map((n: { id: string; external_source: string | null; external_ref: string | null }) => [n.id, n]));

  let updated = 0;
  for (const p of (potentials ?? []) as { id: string; need_id: string; classification_reasons: string[]; external_ref: string | null }[]) {
    if (p.external_ref) continue; // already backfilled
    const need = needById[p.need_id];
    if (!need?.external_source || !need?.external_ref) continue; // not a ClickUp-imported Need

    const reasonText = (p.classification_reasons ?? []).join(' ');
    const match = reasonText.match(/Status OP:\s*(.+)$/);
    const stageLabel = match?.[1]?.trim() ?? null;

    const { error: updErr } = await admin.from('prospect_potentials').update({
      external_source: need.external_source, external_ref: need.external_ref, external_stage_label: stageLabel,
    }).eq('id', p.id);
    if (updErr) { console.error(`Failed on ${p.id}:`, updErr.message); continue; }
    updated += 1;
  }
  console.log(`Backfilled ${updated} prospect_potentials row(s).`);
}
main();
