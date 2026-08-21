// ── One-off: backfill Deal Size/Deposit/Payment/Targeted/Due date/Date done + Potential's
// primary_contact_id/region onto the 176 already-imported Opportunities NE rows ──────────
// scripts/clickup-import-opportunities.mts now writes these on every future import, but
// the 176 rows already written (before this field-parity pass) need a catch-up. Re-fetches
// the same "Opportunities NE" View (cheap, 176 tasks) and updates by external_ref instead
// of re-importing (which would skip everything as already-existing anyway).

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllViewTasks } from '../lib/clickup/client';
import { mapTaskToOpportunityCandidate } from '../lib/clickup/importOpportunitiesMapping';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

const OPPORTUNITIES_NE_VIEW = 'dhdc7-54915';

async function main() {
  loadEnvLocal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  console.log('Fetching "Opportunities NE"...');
  const tasks = await getAllViewTasks(OPPORTUNITIES_NE_VIEW);
  const candidates = tasks.map(t => mapTaskToOpportunityCandidate(t, 'TLINES_NE'));
  console.log(`  ${candidates.length} task(s)`);

  let oppUpdated = 0, potUpdated = 0, notFound = 0, failed = 0;

  for (const c of candidates) {
    try {
      // Contact lookup — same resolution as the main import (top-level then nested).
      let primaryContactId: string | null = null;
      if (c.contactExternalRef) {
        const { data: prospect } = await admin.from('prospects').select('id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle();
        const prospectId = prospect?.id ?? (await admin.from('prospect_contacts').select('prospect_id').eq('external_source', 'clickup').eq('external_ref', c.contactExternalRef).maybeSingle()).data?.prospect_id ?? null;
        if (prospectId) {
          const { data: pc } = await admin.from('prospect_contacts').select('id').eq('prospect_id', prospectId).eq('is_primary', true).limit(1).maybeSingle();
          primaryContactId = pc?.id ?? null;
        }
      }

      const commonPatch = {
        estimated_value: c.dealSize, deposit: c.deposit, payment_raw: c.paymentRaw, targeted: c.targeted,
      };

      const { data: opp } = await admin.from('opportunities').update({
        ...commonPatch, deadline: c.dueDate, primary_contact_id: primaryContactId,
      }).eq('external_source', 'clickup').eq('external_ref', c.externalRef).select('id').maybeSingle();
      if (opp) { oppUpdated += 1; continue; }

      const { data: pot } = await admin.from('prospect_potentials').update({
        ...commonPatch, due_date: c.dueDate, date_done: c.dateDone, primary_contact_id: primaryContactId, region: c.region,
      }).eq('external_source', 'clickup').eq('external_ref', c.externalRef).select('id').maybeSingle();
      if (pot) { potUpdated += 1; continue; }

      notFound += 1;
      console.error(`  NOT FOUND in either table: ${c.externalRef} (${c.siteName})`);
    } catch (e) {
      failed += 1;
      console.error(`  FAILED ${c.externalRef}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('\n── Done ──');
  console.log(`Opportunities updated: ${oppUpdated}`);
  console.log(`Potentials updated: ${potUpdated}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Failed: ${failed}`);
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
