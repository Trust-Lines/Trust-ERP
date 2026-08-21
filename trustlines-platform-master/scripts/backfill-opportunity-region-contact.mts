// One-off backfill: the 153 Opportunities already imported before
// scripts/clickup-import-opportunities.mts set `region`/`primary_contact_id` on the
// `opportunities` row itself (they were only ever set on the parent Need). Derives both
// from data already in our own DB — no ClickUp call needed.
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

  const { data: opps, error } = await admin.from('opportunities')
    .select('id, need_id, prospect_id, region, primary_contact_id').eq('external_source', 'clickup').is('deleted_at', null);
  if (error) { console.error(error.message); process.exit(1); }

  const needIds = [...new Set((opps ?? []).map((o: { need_id: string }) => o.need_id))];
  const { data: needs } = await admin.from('prospect_needs').select('id, region').in('id', needIds);
  const regionByNeed = Object.fromEntries((needs ?? []).map((n: { id: string; region: string | null }) => [n.id, n.region]));

  let regionFixed = 0, contactFixed = 0, contactStillMissing = 0;
  for (const o of (opps ?? []) as { id: string; need_id: string; prospect_id: string; region: string | null; primary_contact_id: string | null }[]) {
    const patch: Record<string, unknown> = {};
    const realRegion = regionByNeed[o.need_id];
    if (!o.region && realRegion) patch.region = realRegion;

    if (!o.primary_contact_id) {
      const { data: primaryContact } = await admin.from('prospect_contacts')
        .select('id').eq('prospect_id', o.prospect_id).eq('is_primary', true).limit(1).maybeSingle();
      if (primaryContact) { patch.primary_contact_id = primaryContact.id; }
      else contactStillMissing += 1;
    }

    if (Object.keys(patch).length === 0) continue;
    const { error: updErr } = await admin.from('opportunities').update(patch).eq('id', o.id);
    if (updErr) { console.error(`Failed on ${o.id}:`, updErr.message); continue; }
    if (patch.region) regionFixed += 1;
    if (patch.primary_contact_id) contactFixed += 1;
  }

  console.log(`Region backfilled: ${regionFixed}`);
  console.log(`Primary contact backfilled: ${contactFixed}`);
  console.log(`Still no primary contact on file (Prospect has no contact row at all): ${contactStillMissing}`);
}
main();
