// Full CRM reset — user-confirmed (2026-08-13), scoped per explicit answers:
//   1. marketing_campaigns included in the wipe.
//   2. prospects/needs/opportunities/potentials scoped to external_source='clickup'
//      (verified via scripts/reset-preview.mts: 100% of current rows are clickup-sourced
//      anyway, so this filter is a no-op today but kept as a real guard for the future).
//   3. lead_intake included in the wipe (only 2 rows exist, confirmed via preview).
// Goal (user's words): "veriyi sıfırla, trashtanda sil karışmasın, CRM kısmı verisiz
// olsun, sonra adım adım bölge bölge ekleyelim" — a real hard delete, not soft-delete,
// so nothing lingers in trash to cause a repeat of the NE mix-up. ClickUp itself is
// NEVER touched (this only deletes rows in OUR Supabase DB — see lib/clickup/client.ts's
// GET-only rule).
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

  // ── 1) Marketing/CRM tree, scoped to external_source='clickup' prospects ──────────
  // PostgREST caps a single select at 1000 rows by default — page through explicitly so
  // a >1000-row source (this one has ~1900) doesn't get silently truncated like the
  // first run of this script did.
  // 2026-08-13 follow-up: user confirmed removing ALL remaining prospects too (not just
  // external_source='clickup') — the leftovers were manual test/audit rows from earlier
  // sessions ("Softellio", "ZZTEST AUDIT", etc.), not real business data. No filter now.
  const prospectIds: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('prospects').select('id').range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    prospectIds.push(...data.map((p: { id: string }) => p.id));
    if (data.length < 1000) break;
  }
  console.log(`Prospects to remove: ${prospectIds.length}`);

  // Runs `table.delete().in(column, ids).select('id')` in 500-id batches (large IN
  // lists can silently cap out otherwise) and logs any error instead of swallowing it.
  async function batchDelete(table: string, column: string, ids: string[]): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const { data, error } = await admin.from(table).delete().in(column, batch).select('id');
      if (error) { console.error(`  ${table} batch delete failed: ${error.message}`); continue; }
      deleted += data?.length ?? 0;
    }
    return deleted;
  }

  if (prospectIds.length > 0) {
    const needIds: string[] = [];
    for (let i = 0; i < prospectIds.length; i += 500) {
      const batch = prospectIds.slice(i, i + 500);
      const { data, error } = await admin.from('prospect_needs').select('id').in('prospect_id', batch);
      if (error) { console.error(`prospect_needs lookup failed: ${error.message}`); continue; }
      needIds.push(...(data ?? []).map((n: { id: string }) => n.id));
    }

    console.log(`Deleted ${await batchDelete('campaign_interactions', 'prospect_id', prospectIds)} campaign_interactions.`);
    console.log(`Deleted ${await batchDelete('opportunities', 'prospect_id', prospectIds)} opportunities.`);
    console.log(`Deleted ${await batchDelete('prospect_potentials', 'prospect_id', prospectIds)} prospect_potentials.`);
    console.log(`Deleted ${await batchDelete('prospect_needs', 'id', needIds)} prospect_needs.`);
    console.log(`Deleted ${await batchDelete('prospect_locations', 'prospect_id', prospectIds)} prospect_locations.`);
    console.log(`Deleted ${await batchDelete('prospect_contacts', 'prospect_id', prospectIds)} prospect_contacts.`);
    console.log(`Deleted ${await batchDelete('prospects', 'id', prospectIds)} prospects.`);
  }

  // ── 2) marketing_campaigns (cascades survey_submissions + any remaining
  //      campaign_interactions; sets any non-clickup prospects' campaign_id to NULL) ──
  const campaigns = await admin.from('marketing_campaigns').delete().not('id', 'is', null).select('id');
  console.log(`Deleted ${campaigns.data?.length ?? 0} marketing_campaigns.`);

  // ── 3) lead_intake (Sales pipeline) — cascades lead_intake_documents, lead_activity,
  //      lead_watchers, lead_tasks, sales_design_jobs; sets customer_meetings/
  //      customer_follow_ups/system_events.lead_id to NULL/CASCADE per their own FKs ──
  const leads = await admin.from('lead_intake').delete().not('id', 'is', null).select('id');
  console.log(`Deleted ${leads.data?.length ?? 0} lead_intake rows.`);

  console.log('\nReset complete. CRM/Marketing + Sales pipeline are now empty. ClickUp itself was never touched.');
}
main();
