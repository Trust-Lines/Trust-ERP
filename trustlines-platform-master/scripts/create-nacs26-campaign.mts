// ── One-off: create + activate the real "NACS 26" trade-fair campaign ──────────────
// Uses the exact same service-layer functions (lib/marketing/campaigns.ts) the internal
// authenticated API route calls — no shortcuts, no direct-insert bypass of the real
// business rules (slug generation, draft→active transition guard, etc.).

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { createCampaign, setCampaignStatus } from '../lib/marketing/campaigns';

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
  const { data: actor, error: actorErr } = await admin.from('profiles').select('id, full_name').eq('email', actorEmail).maybeSingle();
  if (actorErr || !actor) { console.error(`Could not resolve actor profile for ${actorEmail}:`, actorErr?.message ?? 'not found'); process.exit(1); }

  const { data: existing } = await admin.from('marketing_campaigns').select('id, slug, status').eq('name', 'NACS 26').is('deleted_at', null).maybeSingle();
  if (existing) {
    console.log('Campaign already exists:', existing);
    if (existing.status === 'draft') {
      const activated = await setCampaignStatus(admin, existing.id, 'active');
      console.log('Activated:', activated.slug, activated.status);
    }
    console.log(`\nSurvey URL: /survey/${existing.slug}`);
    return;
  }

  const campaign = await createCampaign(admin, {
    name: 'NACS 26',
    campaignType: 'trade_fair',
    source: 'trade_fair',
    publicTitle: 'T LINES Soccer Challenge — NACS 2026',
    publicDescription: 'Tell us about your project and collect your gift ball at the booth.',
    consentTextVersion: 'v1',
  }, actor.id);
  console.log('Created:', campaign.id, campaign.slug, campaign.status);

  const activated = await setCampaignStatus(admin, campaign.id, 'active');
  console.log('Activated:', activated.slug, activated.status);
  console.log(`\nSurvey URL: /survey/${activated.slug}`);
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
