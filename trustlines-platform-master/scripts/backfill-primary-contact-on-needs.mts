// ── One-off: backfill primary_contact_id onto existing auto-managed Opportunities/
// Potentials created before the 2026-08-17 opportunityEngine.ts fix (it never set this
// column at all). Re-runs runClassificationForNeed() for every affected row — safe/
// idempotent, and picks up the newly-added primary_contact_id resolution for free.

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { runClassificationForNeed } from '../lib/marketing/opportunityEngine';

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

  const actorEmail = process.env.CLICKUP_IMPORT_ACTOR_EMAIL || 'batool@trust-lines.com';
  const { data: actor } = await admin.from('profiles').select('id').eq('email', actorEmail).maybeSingle();
  if (!actor) { console.error('Could not resolve actor'); process.exit(1); }

  const { data: opps } = await admin.from('opportunities')
    .select('need_id, prospect_id').eq('auto_managed', true).is('primary_contact_id', null).is('deleted_at', null);
  const { data: pots } = await admin.from('prospect_potentials')
    .select('need_id, prospect_id').eq('auto_managed', true).is('primary_contact_id', null).is('deleted_at', null);

  const needIds = new Set<string>([...(opps ?? []).map((o: any) => o.need_id), ...(pots ?? []).map((p: any) => p.need_id)]);
  console.log(`${needIds.size} need(s) to re-sync.`);

  let fixed = 0, skippedNoContact = 0, failed = 0;
  for (const needId of needIds) {
    try {
      const result = await runClassificationForNeed(admin, needId, actor.id);
      const contactId = (result.opportunity as any)?.primary_contact_id ?? (result.potential as any)?.primary_contact_id ?? null;
      if (contactId) fixed += 1; else skippedNoContact += 1;
    } catch (e) {
      failed += 1;
      console.error(`  FAILED ${needId}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('\n── Done ──');
  console.log(`Contact linked: ${fixed}`);
  console.log(`No primary contact on the Prospect (nothing to link): ${skippedNoContact}`);
  console.log(`Failed: ${failed}`);
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
