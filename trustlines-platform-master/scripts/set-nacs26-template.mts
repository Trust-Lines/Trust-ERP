import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}
async function main() {
  loadEnvLocal();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;
  const { data, error } = await admin.from('marketing_campaigns').update({ survey_template: 'soccer_challenge' }).eq('slug', 'nacs-26').select('slug, survey_template').single();
  if (error) { console.error(error); process.exit(1); }
  console.log(data);
}
main();
