// ── ClickUp Docs → the CRM ───────────────────────────────────────────────────────────────
// Dry run (default, writes nothing):   npx tsx scripts/clickup-import-docs.mts
// Real write:                          npx tsx scripts/clickup-import-docs.mts --write
//
// The "Collect Information" briefs (scope of work, notes, dimensions, attachments) live in ClickUp
// as Docs attached to a task. Each Doc page becomes:
//   - a deal's Document  -> need_notes row with external_source='clickup_doc' (shown in the pop-up's
//     Documents section, not in the Activity feed)
//   - a Contact's note   -> prospect_contact_notes row
// Files linked inside a Doc are re-hosted in Dropbox (ClickUp's attachment links expire) and added to
// the record's Files. ClickUp is only ever read (GET). Idempotent: a page already imported is skipped.
//
// Not reachable: Docs that are only EMBEDDED in a comment ("[Doc Embed: …]") — the API refuses them (403).

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getAllDocs, getDocPages, getTaskBasic, type ClickUpDoc } from '../lib/clickup/client';
import { getDropboxClient } from '../lib/dropbox/client';
import { buildNeedFilesPath } from '../lib/marketing/needFiles';
import { buildProspectFilesPath, sanitizeFileName } from '../lib/marketing/prospectFiles';

const WORKSPACE = '14202247';
const WRITE = process.argv.includes('--write');

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      const status = (e as { status?: number }).status;
      if (i < 5 && (status === 429 || status === 502 || status === 503)) { await new Promise(r => setTimeout(r, 15000)); continue; }
      throw e;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(admin: any, table: string, cols: string, filter?: (q: any) => any): Promise<any[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out as never[];
}

// Markdown escapes parentheses inside URLs ("...%20\(1\).jpeg"), so a URL is a run of escaped-or-plain characters.
const ATTACHMENT_RE = /\[([^\]]*)\]\((https:\/\/[^\s)\\]*clickup-attachments\.com\/(?:\\.|[^\s)\\])+)\)/g;
const unescapeMd = (s: string) => s.replace(/\\(.)/g, '$1');
function safeDecode(s: string): string { try { return decodeURIComponent(s); } catch { return s; } }

async function download(url: string): Promise<Buffer | null> {
  for (const headers of [{}, { Authorization: process.env.CLICKUP_API_TOKEN! }] as Record<string, string>[]) {
    try { const res = await fetch(url, { headers }); if (res.ok) return Buffer.from(await res.arrayBuffer()); } catch { /* next */ }
  }
  return null;
}

async function main() {
  loadEnvLocal();
  if (!process.env.CLICKUP_API_TOKEN) { console.error('CLICKUP_API_TOKEN is not set.'); process.exit(1); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;
  console.log(WRITE ? 'WRITING' : 'DRY RUN');

  const needs = new Map<string, { id: string; title: string; region: string | null }>(
    (await fetchAll(admin, 'prospect_needs', 'id, title, region, external_ref', q => q.eq('external_source', 'clickup').not('external_ref', 'is', null)))
      .map((n: { id: string; title: string; region: string | null; external_ref: string }) => [n.external_ref, n]));
  const contacts = new Map<string, { id: string; prospect_id: string }>(
    (await fetchAll(admin, 'prospect_contacts', 'id, prospect_id, external_ref', q => q.eq('external_source', 'clickup').not('external_ref', 'is', null)))
      .map((c: { id: string; prospect_id: string; external_ref: string }) => [c.external_ref, c]));
  const prospects = new Map<string, { display_name: string; region: string | null }>(
    (await fetchAll(admin, 'prospects', 'id, display_name, region')).map((p: { id: string; display_name: string; region: string | null }) => [p.id, p]));
  const doneNotes = new Set<string>((await fetchAll(admin, 'need_notes', 'external_ref', q => q.eq('external_source', 'clickup_doc'))).map((r: { external_ref: string }) => r.external_ref));
  const doneContactNotes = new Set<string>((await fetchAll(admin, 'prospect_contact_notes', 'external_ref', q => q.eq('external_source', 'clickup_doc'))).map((r: { external_ref: string }) => r.external_ref));
  const haveNeedFiles = new Map<string, Set<string>>();
  const haveProspectFiles = new Map<string, Set<string>>();

  const docs = (await getAllDocs(WORKSPACE)).filter(d => !d.deleted);
  console.log(`${docs.length} Doc(s) in ClickUp`);

  const stats = { dealDocs: 0, contactDocs: 0, subtaskDocs: 0, pagesCreated: 0, pagesSkipped: 0, emptyPages: 0, filesUploaded: 0 };
  const unmatched: string[] = [];
  const fileProblems: string[] = [];

  async function rehost(kind: 'need' | 'prospect', ownerId: string, folder: string, docName: string, content: string) {
    const have = kind === 'need' ? haveNeedFiles : haveProspectFiles;
    if (!have.has(ownerId)) {
      const rows = await fetchAll(admin, kind === 'need' ? 'need_files' : 'prospect_files', 'file_name', q => q.eq(kind === 'need' ? 'need_id' : 'prospect_id', ownerId));
      have.set(ownerId, new Set(rows.map((r: { file_name: string }) => r.file_name)));
    }
    for (const m of content.matchAll(ATTACHMENT_RE)) {
      const url = unescapeMd(m[2]).replace(/#/g, '%23');
      // Link text is often empty or is just the URL again — the file's own name is the last URL segment.
      const fromUrl = safeDecode(url.split('?')[0].split('/').pop() || 'file');
      const name = sanitizeFileName(m[1] && !/^https?:/.test(m[1]) ? m[1] : fromUrl);
      if (have.get(ownerId)!.has(name)) continue;
      if (!WRITE) { stats.filesUploaded += 1; continue; }
      const buf = await download(url);
      if (!buf) { fileProblems.push(`${docName}: ${name} — download failed`); continue; }
      if (buf.length > 140 * 1024 * 1024) { fileProblems.push(`${docName}: ${name} — over 140MB`); continue; }
      try {
        const res = await getDropboxClient().filesUpload({ path: `${folder}/${name}`, contents: buf, mode: { '.tag': 'add' }, autorename: true });
        const row = kind === 'need'
          ? { need_id: ownerId, dropbox_path: res.result.path_lower ?? `${folder}/${name}`, file_name: name, uploaded_by: null }
          : { prospect_id: ownerId, dropbox_path: res.result.path_lower ?? `${folder}/${name}`, file_name: name, uploaded_by: null };
        const { error } = await admin.from(kind === 'need' ? 'need_files' : 'prospect_files').insert(row);
        if (error) throw new Error(error.message);
        have.get(ownerId)!.add(name); stats.filesUploaded += 1;
      } catch (e) { fileProblems.push(`${docName}: ${name} — ${e instanceof Error ? e.message : e}`); }
    }
  }

  for (const doc of docs as ClickUpDoc[]) {
    const parentId = doc.parent?.id;
    let deal = parentId ? needs.get(parentId) : undefined;
    let contact = !deal && parentId ? contacts.get(parentId) : undefined;
    let viaSubtask: string | null = null;

    if (!deal && !contact && parentId) {
      // A Doc on a checklist-style SUBTASK ("Collect Information") belongs to the deal it's nested under.
      try {
        const t = await retry(() => getTaskBasic(parentId));
        if (t.parent && needs.get(t.parent)) { deal = needs.get(t.parent); viaSubtask = t.name; }
        else if (t.parent && contacts.get(t.parent)) { contact = contacts.get(t.parent); viaSubtask = t.name; }
      } catch { /* not readable */ }
    }
    if (!deal && !contact) { unmatched.push(`${doc.name || '(untitled)'} — parent task ${parentId ?? 'none'}`); continue; }
    if (viaSubtask) stats.subtaskDocs += 1;
    if (deal) stats.dealDocs += 1; else stats.contactDocs += 1;

    const pages = await retry(() => getDocPages(WORKSPACE, doc.id));
    for (const pg of pages) {
      const content = (pg.content ?? '').trim();
      if (!content) { stats.emptyPages += 1; continue; }
      const title = [doc.name, pg.name && pg.name !== doc.name ? pg.name : null].filter(Boolean).join(' — ') + (viaSubtask ? ` (${viaSubtask})` : '');
      const url = `https://app.clickup.com/${WORKSPACE}/v/dc/${doc.id}/${pg.id}`;
      const at = new Date(pg.date_updated ?? doc.date_updated ?? doc.date_created).toISOString();

      if (deal) {
        const already = doneNotes.has(pg.id);
        if (already) stats.pagesSkipped += 1;
        if (WRITE && !already) {
          const { error } = await admin.from('need_notes').insert({
            need_id: deal.id, author_name: 'ClickUp Doc', body: content, link_url: url, link_title: title,
            source_created_at: at, external_source: 'clickup_doc', external_ref: pg.id,
          });
          if (error) { console.error(`  note failed (${title}): ${error.message}`); continue; }
          doneNotes.add(pg.id);
        }
        if (!already) stats.pagesCreated += 1;
        await rehost('need', deal.id, buildNeedFilesPath(deal.region, deal.title, deal.id), title, content);
      } else if (contact) {
        const already = doneContactNotes.has(pg.id);
        if (already) stats.pagesSkipped += 1;
        if (WRITE && !already) {
          const { error } = await admin.from('prospect_contact_notes').insert({
            prospect_contact_id: contact.id, author_name: 'ClickUp Doc', body: `${title}\n\n${content}`,
            source_created_at: at, external_source: 'clickup_doc', external_ref: pg.id,
          });
          if (error) { console.error(`  contact note failed (${title}): ${error.message}`); continue; }
          doneContactNotes.add(pg.id);
        }
        if (!already) stats.pagesCreated += 1;
        const pr = prospects.get(contact.prospect_id);
        await rehost('prospect', contact.prospect_id, buildProspectFilesPath(pr?.region ?? null, pr?.display_name ?? 'Prospect', contact.prospect_id), title, content);
      }
    }
    await new Promise(r => setTimeout(r, 400)); // stay well under ClickUp's rate limit
  }

  console.log(`\n── ${WRITE ? 'Import' : 'Dry run'} summary ──`);
  console.log(stats);
  console.log(`Docs whose task isn't in the CRM (${unmatched.length}):`);
  unmatched.forEach(u => console.log(`    ${u}`));
  if (fileProblems.length) { console.log(`File problems (${fileProblems.length}):`); fileProblems.forEach(f => console.log(`    ${f}`)); }
  if (!WRITE) console.log('\nNOTHING was written — re-run with --write to import.');
}

main().catch(e => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1); });
