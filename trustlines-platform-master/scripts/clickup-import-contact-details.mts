// ── ClickUp contact checklist + comments backfill ────────────────────────────────────
// Run after scripts/clickup-import-write.mts has already created the Prospect/Contact
// rows for a region. Fetches, per already-imported contact, its ClickUp "Client
// Information progress" checklist (GET /task/{id}) and comment thread
// (GET /task/{id}/comment) — neither is included in the bulk List/View task endpoints
// used by the main import, see lib/clickup/client.ts. Still read-only (GET only).
// Idempotent: relies on the migration 092 partial unique indexes
// (prospect_contact_id, external_ref) — a re-run just skips rows that already exist.
// Throttled to stay well under ClickUp's rate limit (roughly 1 request/650ms).
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getTaskChecklists, getTaskComments } from '../lib/clickup/client';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

const REGION = process.argv[2]; // e.g. TLINES_NE — required, so this stays region-by-region like the rest of the rebuild
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  loadEnvLocal();
  if (!REGION) { console.error('Usage: tsx scripts/clickup-import-contact-details.mts <REGION>'); process.exit(1); }
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set.'); process.exit(1); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

  const probe = await admin.from('prospect_contact_notes').select('id').limit(1);
  if (probe.error) { console.error('Migration 092 is not applied yet:', probe.error.message); process.exit(1); }

  const prospects: { id: string; external_ref: string; display_name: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('prospects')
      .select('id, external_ref, display_name')
      .eq('external_source', 'clickup').eq('region', REGION)
      .range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    prospects.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`${prospects.length} ${REGION} prospect(s) to backfill checklist/notes for.`);

  let checklistItemsWritten = 0, notesWritten = 0, failed = 0;

  for (const [i, p] of prospects.entries()) {
    try {
      const { data: contact } = await admin.from('prospect_contacts')
        .select('id').eq('prospect_id', p.id).eq('is_primary', true).limit(1).maybeSingle();
      if (!contact) { console.error(`  no primary contact for ${p.display_name} (${p.id}), skipping`); continue; }

      const checklists = await getTaskChecklists(p.external_ref);
      await sleep(650);
      for (const cl of checklists) {
        for (const item of cl.items) {
          const { data: existing } = await admin.from('prospect_contact_checklist_items')
            .select('id').eq('prospect_contact_id', contact.id).eq('external_ref', item.id).maybeSingle();
          if (existing) continue;
          const { error } = await admin.from('prospect_contact_checklist_items').insert({
            prospect_contact_id: contact.id,
            checklist_name: cl.name,
            item_name: item.name,
            resolved: item.resolved,
            order_index: Number(item.orderindex),
            external_source: 'clickup',
            external_ref: item.id,
          });
          if (error) console.error(`  checklist item insert failed (${p.display_name}): ${error.message}`);
          else checklistItemsWritten += 1;
        }
      }

      const comments = await getTaskComments(p.external_ref);
      await sleep(650);
      for (const c of comments) {
        const { data: existing } = await admin.from('prospect_contact_notes')
          .select('id').eq('prospect_contact_id', contact.id).eq('external_ref', c.id).maybeSingle();
        if (existing) continue;
        const { error } = await admin.from('prospect_contact_notes').insert({
          prospect_contact_id: contact.id,
          author_name: c.user?.username ?? null,
          body: c.comment_text,
          source_created_at: new Date(Number(c.date)).toISOString(),
          external_source: 'clickup',
          external_ref: c.id,
        });
        if (error) console.error(`  note insert failed (${p.display_name}): ${error.message}`);
        else notesWritten += 1;
      }

      if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${prospects.length}`);
    } catch (e) {
      failed += 1;
      console.error(`  FAILED ${p.display_name} (${p.external_ref}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log('\n── Done ──');
  console.log(`Checklist items written: ${checklistItemsWritten}`);
  console.log(`Notes written: ${notesWritten}`);
  console.log(`Failed: ${failed}`);
}
main();
