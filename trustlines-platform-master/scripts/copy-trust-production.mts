// Copy the Trust System Projects board (Projects, Missing & Extra, Direct Orders) into T-ERP's own
// tables — every project, row and field. Needs migration 150.
//
//   npx tsx scripts/copy-trust-production.mts --dry   # report only, writes nothing
//   npx tsx scripts/copy-trust-production.mts         # copy
//
// Trust System: READ ONLY — GET requests only (a handful; the API allows 200/min).
// T-ERP:
//   • a Trust project that matches a T-ERP project (same number; same words when two share a
//     number) gets its Trust fields and rows. Its earlier T-ERP rows (auto-seeded placeholders and
//     rows made from PF file names) are archived (deleted_at), not removed.
//   • a Trust project T-ERP doesn't have becomes a T-ERP project the way T-ERP names them
//     (composeProjectCode: service line + region + number, e.g. "STNE 440"); its Dropbox path is the
//     Trust one, no folders are created.
//   • Direct Orders and Missing & Extra cases become production_cases with their rows.
//   Every copied record keeps its Trust id, so running this again updates instead of duplicating,
//   and its full Trust record in trust_raw, so no field is lost.
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { composeProjectCode, SERVICE_LINES } from '../lib/regions';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

const DRY = process.argv.includes('--dry');
const TRUST = process.env.TRUST_API_URL!.replace(/\/+$/, '');
const KEY = (process.env.TRUST_API_KEY || process.env.INTEGRATION_API_KEY)!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) as Any;

let trustCalls = 0;
async function trustGet(path: string): Promise<Any> {
  trustCalls++;
  const res = await fetch(TRUST + path, { method: 'GET', headers: { 'X-API-Key': KEY, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Trust GET ${path} → ${res.status}`);
  return res.json();
}

// ── Mapping helpers ──────────────────────────────────────────────────────────────────────────
const TYPE: Record<string, string> = {
  MILLWORK: 'Millwork', SHELVING: 'Shelving', CEILING: 'Ceiling', IMAGE: 'Image', FURNITURE: 'Furniture', DECORATION: 'Decoration',
};
const CATEGORY: Record<string, string> = { MILLWORK: 'M1', SHELVING: 'S1', CEILING: 'C1', IMAGE: 'I1' };
const BUCKETS = new Set(['TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW', 'TLINES_HQ', 'TLINES_TC']);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const digits = (s: unknown) => (String(s ?? '').match(/\d+/) || [''])[0];
const bucket = (b: unknown) => (BUCKETS.has(String(b)) ? String(b) : null);

function itemRow(it: Any, i: number, owner: { project_id: string | null; case_id: string | null; source: string }, vendorId: (id: string | null) => string | null) {
  const type = it.type ? (TYPE[it.type] ?? it.type) : (it.customType?.name ?? 'Custom');
  return {
    ...owner,
    trust_id: it.id,
    type,
    custom_type_code: it.type ? null : (it.customType?.code ?? null),
    vendor_id: vendorId(it.vendorId ?? null),
    pf_code: it.pfCode || null,
    order_type: it.orderType || null,
    po_sign_status: it.poSignStatus || 'NOT_SIGNED',
    pf_sign_status: it.pfSignStatus || 'NOT_SIGNED',
    status: it.status || 'NOT_ORDERED',
    std: day(it.std), etd: day(it.etd), rtr: day(it.rtr), rtd: day(it.rtd), rdy: day(it.rdy), ftd: day(it.ftd), snd: day(it.snd),
    pf_usd: num(it.pfUsd) ?? 0, pf_tl: num(it.pfTl) ?? 0, invoice: num(it.invoice) ?? 0, invoice_tl: num(it.invoiceTl) ?? 0,
    payment_rule: it.paymentRule || null,
    container_no: it.containerNo || null,
    container_date: day(it.containerDate),
    status_note: it.statusNote || null,
    price_notes: it.priceNotes ?? null,
    paid_usd1: num(it.paidUsd1), paid_usd2: num(it.paidUsd2), paid_tl1: num(it.paidTl1), paid_tl2: num(it.paidTl2),
    paid_usd1_date: day(it.paidUsd1Date), paid_usd2_date: day(it.paidUsd2Date), paid_tl1_date: day(it.paidTl1Date), paid_tl2_date: day(it.paidTl2Date),
    invoice_number: it.invoiceNumber || null,
    invoice_transaction_no: it.invoiceTransactionNo || null,
    invoice_date: day(it.invoiceDate),
    quick_book: it.quickBook || null,
    due_paid: !!it.duePaid,
    description: it.description || null,
    price_list_code: it.priceListCode || null,
    sort_index: i,
    trust_raw: it,
    trust_synced_at: new Date().toISOString(),
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertItems(rows: Any[]) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from('production_items').upsert(rows.slice(i, i + 100), { onConflict: 'trust_id' });
    if (error) throw new Error(`production_items upsert: ${error.message}`);
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────
(async () => {
  // Trust System, read only.
  const first = await trustGet('/projects?page=1&limit=50');
  const trustProjects: Any[] = [...first.data];
  for (let p = 2; p <= (first.meta?.totalPages ?? 1); p++) trustProjects.push(...(await trustGet(`/projects?page=${p}&limit=50`)).data);
  const meBySection: Record<string, Any[]> = await trustGet('/missing-extra/cases');
  const doResp: Any = await trustGet('/direct-orders');
  const trustVendors: Any[] = await trustGet('/vendors');
  const meCases = Object.values(meBySection).flat();
  const directOrders = (doResp.sections ?? []).flatMap((s: Any) => (s.projects ?? []).map((p: Any) => ({ ...p, bucket: p.bucket ?? s.section })));
  // What was read, for checking afterwards (outside the repo).
  const snapshot = join(tmpdir(), `trust-copy-${Date.now()}.json`);
  writeFileSync(snapshot, JSON.stringify({ at: new Date().toISOString(), trustProjects, meBySection, doResp, trustVendors }));

  // T-ERP state.
  let { data: terpProjects, error: pErr } = await db.from('projects').select('id, code, name, region, trust_project_id, deleted_at').limit(5000);
  // A dry run can plan before migration 150 is applied (no trust_project_id yet); a real run cannot.
  if (pErr && DRY) ({ data: terpProjects, error: pErr } = await db.from('projects').select('id, code, name, region, deleted_at').limit(5000));
  if (pErr) throw new Error(`projects: ${pErr.message} (is migration 150 applied?)`);
  const { data: suppliers } = await db.from('suppliers').select('id, code').limit(5000);
  const live = (terpProjects as Any[]).filter(p => !p.deleted_at);
  const supplierByCode = new Map((suppliers as Any[]).filter(s => s.code).map(s => [String(s.code).toUpperCase(), s.id]));
  const trustVendorCode = new Map(trustVendors.map(v => [v.id, String(v.code ?? '').toUpperCase()]));
  const vendorMissing = new Set<string>();
  const vendorId = (trustId: string | null) => {
    if (!trustId) return null;
    const code = trustVendorCode.get(trustId);
    const id = code ? supplierByCode.get(code) : undefined;
    if (!id) vendorMissing.add(code || trustId);
    return id ?? null;
  };

  // Match Trust projects to T-ERP projects, one to one.
  const byTrustId = new Map(live.filter(p => p.trust_project_id).map(p => [p.trust_project_id, p]));
  const byNum = new Map<string, Any[]>();
  for (const p of live) { const n = digits(p.code); if (n) byNum.set(n, [...(byNum.get(n) ?? []), p]); }
  const taken = new Set<string>(byTrustId.size ? [...byTrustId.values()].map(p => p.id) : []);
  // A T-ERP code is service line + region + the project number ("STNE 440", "STNW 408 MARKET",
  // "STNW EX-5"): the part after that prefix must equal the Trust project number.
  const key = (s: unknown) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  const suffix = (code: unknown) => key(code).replace(/^(ST|PS|DS)(NE|SE|NW|W|HQ|TC)?\s+/, '');
  const bySuffix = new Map<string, Any[]>();
  for (const p of live) bySuffix.set(suffix(p.code), [...(bySuffix.get(suffix(p.code)) ?? []), p]);
  const matchOf = new Map<string, Any>();
  for (const tp of trustProjects) {
    const pick = byTrustId.get(tp.id) ?? ((bySuffix.get(key(tp.projectNo)) ?? []).length === 1 ? bySuffix.get(key(tp.projectNo))![0] : null);
    if (pick && !taken.has(pick.id)) { matchOf.set(tp.id, pick); taken.add(pick.id); }
    else if (pick && byTrustId.get(tp.id) === pick) matchOf.set(tp.id, pick);
  }
  const toCreate = trustProjects.filter(tp => !matchOf.has(tp.id));
  const usedCodes = new Set(live.map(p => String(p.code)));
  const newCode = (tp: Any) => {
    const line = SERVICE_LINES.find(s => s.dropboxSection === tp.dropboxSection)?.value ?? 'store_maker';
    const plain = /^\s*\d+\s*$/.test(String(tp.projectNo));
    // Same shape as T-ERP's own codes, lettered numbers included ("STNW EX-5").
    let code = plain
      ? composeProjectCode(line, tp.bucket, Number(digits(tp.projectNo)))
      : `${composeProjectCode(line, tp.bucket)} ${key(tp.projectNo)}`.trim();
    if (usedCodes.has(code)) code = `${code} (Trust)`;
    usedCodes.add(code);
    return { code, line };
  };

  const createCode = new Map(toCreate.map(tp => [tp.id, newCode(tp)]));
  const report = {
    dry: DRY, trustCalls,
    trust: { projects: trustProjects.length, projectRows: trustProjects.reduce((n, p) => n + (p.items?.length ?? 0), 0), meCases: meCases.length, meRows: meCases.reduce((n, c) => n + (c.items?.length ?? 0), 0), directOrders: directOrders.length, doRows: directOrders.reduce((n: number, p: Any) => n + (p.items?.length ?? 0), 0) },
    matched: [...matchOf.entries()].map(([tid, p]) => `${trustProjects.find(t => t.id === tid)?.projectNo} → ${p.code}`),
    create: toCreate.map(tp => `${tp.projectNo} ${tp.name} → ${createCode.get(tp.id)!.code}`),
    snapshot,
  };
  console.log(JSON.stringify(report, null, 2));
  if (DRY) { console.log('vendors missing in T-ERP:', [...new Set(trustProjects.flatMap(p => (p.items ?? []).map((i: Any) => i.vendorId)).filter(Boolean).map((id: string) => trustVendorCode.get(id)).filter(c => c && !supplierByCode.has(c)))]); return; }

  // ── Projects ──
  const terpIdOf = new Map<string, string>();
  for (const tp of trustProjects) {
    const meta = {
      trust_project_id: tp.id, is_urgent: !!tp.isUrgent, half_of_year: tp.halfOfYear ?? null, half_year: tp.halfYear ?? null,
      production_container_date: day(tp.containerDate), trust_raw: (({ items, ...rest }) => rest)(tp),
    };
    const m = matchOf.get(tp.id);
    if (m) {
      const { error } = await db.from('projects').update({ ...meta, ...(m.region ? {} : { region: bucket(tp.bucket) }) }).eq('id', m.id);
      if (error) throw new Error(`project ${m.code}: ${error.message}`);
      // Earlier T-ERP rows of this project (placeholders, PF-file rows) step aside — archived, not deleted.
      const { error: aErr } = await db.from('production_items').update({ deleted_at: new Date().toISOString() })
        .eq('project_id', m.id).eq('source', 'project').is('trust_id', null).is('deleted_at', null);
      if (aErr) throw new Error(`archive ${m.code}: ${aErr.message}`);
      terpIdOf.set(tp.id, m.id);
    } else {
      const { code, line } = createCode.get(tp.id)!;
      const addr = tp.address || tp.name;
      const { data, error } = await db.from('projects').insert({
        ...meta, code, name: `${code} - ${addr}`, site_location: tp.address || null,
        region: bucket(tp.bucket), service_line: line,
        categories: (tp.types ?? []).map((t: string) => CATEGORY[t]).filter(Boolean),
        dropbox_root_path: tp.dropboxPath || null, is_draft: false, is_archived: false, hard_deadline: false,
        current_phase: 'production',
      }).select('id').single();
      if (error) throw new Error(`create ${code}: ${error.message}`);
      terpIdOf.set(tp.id, data.id);
    }
  }
  const projectRows = trustProjects.flatMap(tp => (tp.items ?? []).map((it: Any, i: number) => itemRow(it, i, { project_id: terpIdOf.get(tp.id)!, case_id: null, source: 'project' }, vendorId)));
  await upsertItems(projectRows);

  // ── Cases (Missing & Extra, Direct Orders) ──
  async function upsertCase(row: Any): Promise<string> {
    const { data, error } = await db.from('production_cases').upsert(row, { onConflict: 'trust_id' }).select('id').single();
    if (error) throw new Error(`case ${row.code}: ${error.message}`);
    return data.id;
  }
  const projectByNo = (no: unknown) => { const hits = byNum.get(digits(no)) ?? []; return hits.length === 1 ? hits[0].id : null; };
  const caseRows: Any[] = [];
  for (const c of meCases) {
    const base = (c.baseProjectId && terpIdOf.get(c.baseProjectId)) || projectByNo(c.baseProjectNo);
    const id = await upsertCase({
      kind: 'missing_extra', code: c.derivedProjectCode, name: c.baseProjectName ?? null, bucket: bucket(c.section),
      case_type: c.caseType ?? null, case_index: c.caseIndex ?? null, base_project_id: base, base_project_no: c.baseProjectNo ?? null,
      base_project_name: c.baseProjectName ?? null, types: c.types ?? [], half_of_year: c.halfOfYear ?? null, half_year: c.halfYear ?? null,
      trust_id: c.id, trust_raw: (({ items, ...rest }) => rest)(c), created_at: c.createdAt, updated_at: new Date().toISOString(), deleted_at: null,
    });
    caseRows.push(...(c.items ?? []).map((it: Any, i: number) => itemRow(it, i, { project_id: base, case_id: id, source: 'missing_extra' }, vendorId)));
  }
  for (const d of directOrders) {
    const id = await upsertCase({
      kind: 'direct_order', code: d.projectNo, name: d.name ?? null, address: d.address ?? null, bucket: bucket(d.bucket),
      types: d.types ?? [], is_urgent: !!d.isUrgent, half_of_year: d.halfOfYear ?? null, half_year: d.halfYear ?? null,
      container_date: day(d.containerDate), trust_id: d.id, trust_raw: (({ items, ...rest }) => rest)(d),
      created_at: d.createdAt, updated_at: new Date().toISOString(), deleted_at: null,
    });
    caseRows.push(...(d.items ?? []).map((it: Any, i: number) => itemRow(it, i, { project_id: null, case_id: id, source: 'direct_order' }, vendorId)));
  }
  await upsertItems(caseRows);

  console.log(JSON.stringify({ done: true, projectsMatched: matchOf.size, projectsCreated: toCreate.length, projectRows: projectRows.length, caseRows: caseRows.length, cases: meCases.length + directOrders.length, vendorsMissing: [...vendorMissing] }, null, 2));
})().catch(e => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1); });
