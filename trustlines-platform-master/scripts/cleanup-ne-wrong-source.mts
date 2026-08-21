// One-off cleanup: the original "NE" Contacts source (ClickUp view dhdc7-4330, 353
// tasks) turned out NOT to be part of the T LINES workspace's real "Contacts NE" list
// (285 tasks, list 901509135417) — direct GET /list/129221448 returned 401 "Team not
// authorized", meaning that list lives outside this token's team. Explicit, doubly-
// confirmed user decision: hard-delete everything derived from the wrong source
// (region='TLINES_NE', external_source='clickup' — this covers both the 353 directly-
// imported prospects AND the 33 fallback prospects the Opportunities NE import created
// for unmatched Contact links, since ALL of it was built against the wrong contact
// pool) and rebuild from the real sources. A real hard delete, not soft-delete: this is
// known-bad data being corrected, not a reversible user action, and two of the six
// tables involved (prospect_contacts/prospect_locations) have no deleted_at column at
// all, so a consistent full cleanup needs a real delete either way.
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

  const { data: prospects, error } = await admin.from('prospects')
    .select('id').eq('external_source', 'clickup').eq('region', 'TLINES_NE');
  if (error) { console.error(error.message); process.exit(1); }
  const prospectIds = (prospects ?? []).map((p: { id: string }) => p.id);
  console.log(`Found ${prospectIds.length} wrong-source NE prospects to remove.`);
  if (prospectIds.length === 0) { console.log('Nothing to do.'); return; }

  const { data: needs } = await admin.from('prospect_needs').select('id').in('prospect_id', prospectIds);
  const needIds = (needs ?? []).map((n: { id: string }) => n.id);

  // Dependency order: interactions → opportunities → potentials → needs → locations →
  // contacts → prospects.
  const ci = await admin.from('campaign_interactions').delete().in('prospect_id', prospectIds).select('id');
  console.log(`Deleted ${ci.data?.length ?? 0} campaign_interactions.`);

  const opps = await admin.from('opportunities').delete().in('prospect_id', prospectIds).select('id');
  console.log(`Deleted ${opps.data?.length ?? 0} opportunities.`);

  const pots = await admin.from('prospect_potentials').delete().in('prospect_id', prospectIds).select('id');
  console.log(`Deleted ${pots.data?.length ?? 0} prospect_potentials.`);

  if (needIds.length) {
    const needsDel = await admin.from('prospect_needs').delete().in('id', needIds).select('id');
    console.log(`Deleted ${needsDel.data?.length ?? 0} prospect_needs.`);
  }

  const locs = await admin.from('prospect_locations').delete().in('prospect_id', prospectIds).select('id');
  console.log(`Deleted ${locs.data?.length ?? 0} prospect_locations.`);

  const contacts = await admin.from('prospect_contacts').delete().in('prospect_id', prospectIds).select('id');
  console.log(`Deleted ${contacts.data?.length ?? 0} prospect_contacts.`);

  const pDel = await admin.from('prospects').delete().in('id', prospectIds).select('id');
  console.log(`Deleted ${pDel.data?.length ?? 0} prospects.`);

  console.log('\nCleanup complete. marketing_campaigns rows were left in place (harmless, closed, may still be reused by SE/NW/CVW data with the same fair name).');
}
main();
