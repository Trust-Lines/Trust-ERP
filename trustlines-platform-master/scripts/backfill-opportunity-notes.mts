// ── One-off: backfill need_notes for the 176 already-imported Opportunities NE needs ──
// The main import (scripts/clickup-import-opportunities.mts) ran clean (176/176, 0
// failed) but its notes step hit the same partial-unique-index/upsert bug the Contacts
// checklist backfill hit — fixed in the main script for future runs; this catches up the
// rows already written. ClickUp is still only ever read (GET).

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getTaskComments, type ClickUpComment } from '../lib/clickup/client';

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

  const { data: needs, error } = await admin.from('prospect_needs')
    .select('id, external_ref').eq('external_source', 'clickup').not('external_ref', 'is', null)
    .like('external_ref', '86%'); // Opportunities NE ClickUp task ids all start "86..."
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${needs.length} need(s) to backfill comments for.`);

  let written = 0, failed = 0, i = 0;
  for (const n of needs as { id: string; external_ref: string }[]) {
    i += 1;
    if (i % 25 === 0) console.log(`  ...${i}/${needs.length}`);
    let comments: ClickUpComment[];
    try {
      comments = await getTaskComments(n.external_ref);
    } catch (e) {
      failed += 1;
      console.error(`  FAILED fetch (task ${n.external_ref}): ${e instanceof Error ? e.message : e}`);
      continue;
    }
    for (const c of comments) {
      const bookmarkBlock = c.comment?.find(b => b.type === 'bookmark' && b.bookmark?.url);
      const body = c.comment_text?.trim() || (bookmarkBlock ? bookmarkBlock.bookmark!.url : '');
      if (!body && !bookmarkBlock) continue;
      const { data: existing } = await admin.from('need_notes')
        .select('id').eq('need_id', n.id).eq('external_ref', c.id).maybeSingle();
      if (existing) continue;
      const { error: wErr } = await admin.from('need_notes').insert({
        need_id: n.id,
        author_name: c.user?.username ?? null,
        body: body || bookmarkBlock!.bookmark!.url,
        link_url: bookmarkBlock?.bookmark?.url ?? null,
        link_title: bookmarkBlock?.bookmark?.title ?? null,
        link_thumbnail_url: bookmarkBlock?.bookmark?.thumbnail_url ?? null,
        source_created_at: c.date ? new Date(Number(c.date)).toISOString() : null,
        external_source: 'clickup', external_ref: c.id,
      });
      if (wErr) { failed += 1; console.error(`    note write failed (task ${n.external_ref}, comment ${c.id}): ${wErr.message}`); }
      else written += 1;
    }
  }

  console.log('\n── Done ──');
  console.log(`Notes written: ${written}`);
  console.log(`Failed: ${failed}`);
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
