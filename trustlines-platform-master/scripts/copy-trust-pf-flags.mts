// Copy the Trust System's "Today's PFs" flags (To do / Receive Follow Up / Order) and PF groups into
// T-ERP (migration 152). Run after scripts/copy-trust-production.mts (projects need trust ids).
//
//   npx tsx scripts/copy-trust-pf-flags.mts --dry   # report only
//   npx tsx scripts/copy-trust-pf-flags.mts
//
// Trust System: READ ONLY (GET /today-pf, GET /pf-groups). T-ERP: rows keyed by trust_id, so a
// re-run updates instead of duplicating; nothing else is touched.
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const DRY = process.argv.includes('--dry');
const TRUST = process.env.TRUST_API_URL!.replace(/\/+$/, '');
const KEY = (process.env.TRUST_API_KEY || process.env.INTEGRATION_API_KEY)!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) as Any;

async function trustGet(path: string): Promise<Any> {
  const res = await fetch(TRUST + path, { method: 'GET', headers: { 'X-API-Key': KEY, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Trust GET ${path} → ${res.status}`);
  return res.json();
}

/** Insert or update by trust_id (the indexes are partial, so no ON CONFLICT). */
async function save(table: string, row: Any): Promise<string> {
  const { data: have } = await db.from(table).select('id').eq('trust_id', row.trust_id).maybeSingle();
  const q = have ? db.from(table).update(row).eq('id', have.id) : db.from(table).insert(row);
  const { data, error } = await q.select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

(async () => {
  const flags: Any[] = await trustGet('/today-pf');
  const groups: Any[] = await trustGet('/pf-groups');

  const { data: projects, error } = await db.from('projects').select('id, trust_project_id').not('trust_project_id', 'is', null);
  if (error) throw new Error(`projects: ${error.message}`);
  const projectOf = new Map((projects as Any[]).map(p => [p.trust_project_id, p.id]));
  const itemIds = flags.map(f => f.itemId).filter(Boolean);
  const { data: items } = itemIds.length ? await db.from('production_items').select('id, trust_id').in('trust_id', itemIds) : { data: [] };
  const itemOf = new Map((items as Any[]).map(i => [i.trust_id, i.id]));

  const missing: string[] = [];
  const flagRows = flags.map(f => {
    const project_id = projectOf.get(f.projectId);
    if (!project_id) missing.push(`flag ${f.projectNo} ${f.typeLabel}`);
    return project_id && {
      kind: f.kind, project_id, type: f.typeLabel, item_id: f.itemId ? (itemOf.get(f.itemId) ?? null) : null,
      completed_at: f.completedAt ?? null, created_at: f.createdAt, trust_id: f.id,
    };
  }).filter(Boolean);
  const memberCount = groups.reduce((n, g) => n + (g.members?.length ?? 0), 0);
  console.log({ dry: DRY, trustFlags: flags.length, trustGroups: groups.length, trustMembers: memberCount, flagsToCopy: flagRows.length, missing });
  if (DRY) return;

  for (const r of flagRows) await save('production_pf_flags', r);
  let members = 0;
  for (const g of groups) {
    const groupId = await save('production_pf_groups', { number: g.number, created_at: g.createdAt, trust_id: g.id });
    for (const m of g.members ?? []) {
      const project_id = projectOf.get(m.projectId);
      if (!project_id) { missing.push(`group ${g.number} ${m.projectNo} ${m.typeLabel}`); continue; }
      await save('production_pf_group_members', { group_id: groupId, rank: m.rank ?? 1, project_id, type: m.typeLabel, trust_id: m.id });
      members++;
    }
  }
  console.log({ done: true, flags: flagRows.length, groups: groups.length, members, missing });
})().catch(e => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1); });
