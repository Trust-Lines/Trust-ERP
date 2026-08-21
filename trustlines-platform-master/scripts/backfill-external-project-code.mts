// One-off backfill: migration 104 added `external_project_code` to opportunities/
// prospect_potentials, but rows imported before that migration never got it set (the
// main import script's idempotency skips any row whose external_ref already exists).
// Re-fetches the same ClickUp sources and UPDATEs existing rows by external_ref match —
// still read-only against ClickUp, additive UPDATE against our own DB.
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks, getAllListTasks, resolveCustomFieldValue, type ClickUpTask } from '../lib/clickup/client';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

const SOURCES: { id: string; kind: 'view' | 'list' }[] = [
  { id: 'dhdc7-54915', kind: 'view' }, // Opportunities NE
  { id: '901521558768', kind: 'list' }, // Opportunities SE
];

function projectCodeOf(t: ClickUpTask): string | null {
  const f = (t.custom_fields ?? []).find(x => x.name === 'PROJECT #');
  if (!f) return null;
  const v = resolveCustomFieldValue(f);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function main() {
  loadEnvLocal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  const probe = await admin.from('opportunities').select('external_project_code').limit(1);
  if (probe.error) { console.error('Migration 104 is not applied yet:', probe.error.message); process.exit(1); }

  let updatedOpp = 0, updatedPot = 0, skipped = 0;
  for (const src of SOURCES) {
    const tasks = src.kind === 'view' ? await getAllViewTasks(src.id) : await getAllListTasks(src.id);
    console.log(`Fetched ${tasks.length} task(s) from ${src.id}`);
    for (const t of tasks) {
      const code = projectCodeOf(t);
      if (!code) { skipped += 1; continue; }
      const { data: oppRow } = await admin.from('opportunities').select('id, external_project_code').eq('external_ref', t.id).maybeSingle();
      if (oppRow) {
        if (oppRow.external_project_code !== code) {
          await admin.from('opportunities').update({ external_project_code: code }).eq('id', oppRow.id);
          updatedOpp += 1;
        }
        continue;
      }
      const { data: potRow } = await admin.from('prospect_potentials').select('id, external_project_code').eq('external_ref', t.id).maybeSingle();
      if (potRow) {
        if (potRow.external_project_code !== code) {
          await admin.from('prospect_potentials').update({ external_project_code: code }).eq('id', potRow.id);
          updatedPot += 1;
        }
      }
    }
  }
  console.log(`\nUpdated ${updatedOpp} opportunities, ${updatedPot} potentials. ${skipped} tasks had no PROJECT # value.`);
}
main();
