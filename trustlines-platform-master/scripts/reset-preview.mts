// Preview-only: counts what a full CRM reset would delete. Writes nothing.
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

  async function count(table: string, filter?: (q: any) => any) {
    let q = admin.from(table).select('id', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count: c, error } = await q;
    if (error) return `ERROR: ${error.message}`;
    return c;
  }

  console.log('── ClickUp-sourced (external_source=clickup) ──');
  console.log('prospects:', await count('prospects', q => q.eq('external_source', 'clickup')));
  console.log('prospect_needs:', await count('prospect_needs', q => q.eq('external_source', 'clickup')));
  console.log('opportunities:', await count('opportunities', q => q.eq('external_source', 'clickup')));
  console.log('prospect_potentials:', await count('prospect_potentials', q => q.eq('external_source', 'clickup')));

  console.log('\n── All prospects/opportunities/potentials (any source) ──');
  console.log('prospects total:', await count('prospects'));
  console.log('  non-clickup:', await count('prospects', q => q.not('external_source', 'eq', 'clickup')));
  console.log('opportunities total:', await count('opportunities'));
  console.log('  non-clickup:', await count('opportunities', q => q.not('external_source', 'eq', 'clickup')));
  console.log('prospect_potentials total:', await count('prospect_potentials'));
  console.log('  non-clickup:', await count('prospect_potentials', q => q.not('external_source', 'eq', 'clickup')));

  console.log('\n── Campaigns & interactions ──');
  console.log('marketing_campaigns:', await count('marketing_campaigns'));
  console.log('campaign_interactions:', await count('campaign_interactions'));
  console.log('survey_submissions:', await count('survey_submissions'));

  console.log('\n── lead_intake (Sales pipeline) ──');
  console.log('lead_intake total:', await count('lead_intake'));
  const { data: converted } = await admin.from('lead_intake').select('id, status, created_at').order('created_at', { ascending: true }).limit(2000);
  console.log('  sample statuses:', [...new Set((converted ?? []).map((r: { status: string }) => r.status))]);
  console.log('  earliest created_at:', converted?.[0]?.created_at, '  latest:', converted?.[converted.length - 1]?.created_at);
}
main();
