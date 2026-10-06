// ── Reset a campaign's survey results (the "RESULTS" tiles + "Recent submissions") ──────
// Those numbers are computed from `survey_submissions` rows (lib/marketing/campaigns.ts ->
// computeCampaignStats). Deleting test Contacts does NOT delete those rows — it only nulls
// their prospect_id — so the tiles keep counting old tests. This removes the submission rows
// (and the campaign_interactions that point at them) for ONE campaign.
//
// It never touches Prospects/Contacts/Needs/Potentials/Opportunities or Dropbox files.
//
// Dry run (default, writes nothing):  npx tsx scripts/reset-campaign-submissions.mts nacs-2026-2
// Real delete:                        npx tsx scripts/reset-campaign-submissions.mts nacs-2026-2 --apply
// Keep real ones, only drop tests up to a moment (ISO time):
//                                     npx tsx scripts/reset-campaign-submissions.mts nacs-2026-2 --before 2026-10-06T00:00:00Z --apply

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const slug = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--before');
  const apply = args.includes('--apply');
  const beforeIdx = args.indexOf('--before');
  const before = beforeIdx >= 0 ? args[beforeIdx + 1] : null;
  if (!slug) { console.error('Usage: tsx scripts/reset-campaign-submissions.mts <campaign-slug> [--before <ISO time>] [--apply]'); process.exit(1); }
  if (before && Number.isNaN(Date.parse(before))) { console.error(`Invalid --before value: ${before}`); process.exit(1); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  const { data: campaign } = await admin.from('marketing_campaigns').select('id, name, slug').eq('slug', slug).maybeSingle();
  if (!campaign) { console.error(`No campaign with slug "${slug}"`); process.exit(1); }

  let q = admin.from('survey_submissions').select('id, status, created_at').eq('campaign_id', campaign.id);
  if (before) q = q.lt('created_at', before);
  const { data: subs, error } = await q;
  if (error) { console.error(error.message); process.exit(1); }
  const ids = ((subs ?? []) as { id: string }[]).map(s => s.id);

  console.log(`Campaign: ${campaign.name} (${campaign.slug})`);
  console.log(`Submissions matched${before ? ` (created before ${before})` : ''}: ${ids.length}`);
  if (!apply) { console.log('\nDry run — nothing deleted. Re-run with --apply to delete.'); return; }
  if (!ids.length) { console.log('Nothing to delete.'); return; }

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const a = await admin.from('campaign_interactions').delete().in('survey_submission_id', chunk);
    if (a.error) { console.error('campaign_interactions:', a.error.message); process.exit(1); }
    const b = await admin.from('survey_submissions').delete().in('id', chunk);
    if (b.error) { console.error('survey_submissions:', b.error.message); process.exit(1); }
  }
  console.log(`Deleted ${ids.length} submission row(s) and their campaign interactions.`);
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
