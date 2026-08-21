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
  const { data, error } = await admin.from('prospects')
    .select('id, display_name, organization_name, external_source, external_ref, region, created_at')
    .limit(20);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));

  const { data: opps } = await admin.from('opportunities').select('id, title, external_source, external_ref, region, prospect_id').limit(20);
  console.log('\nOPPORTUNITIES:');
  console.log(JSON.stringify(opps, null, 2));

  const { data: pots } = await admin.from('prospect_potentials').select('id, title, external_source, external_ref, prospect_id').limit(20);
  console.log('\nPOTENTIALS:');
  console.log(JSON.stringify(pots, null, 2));
}
main();
