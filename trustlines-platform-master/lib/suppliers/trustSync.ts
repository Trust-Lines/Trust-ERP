// Suppliers come from the Trust System's Production vendors (GET /vendors) — the same list the
// Production board uses. Matched by code: a supplier we already have keeps its id (so its
// production items, invoices, payments and expenses stay linked) and takes Trust's name/status;
// a vendor we don't have is added. `removeMissing` also takes out suppliers Trust doesn't have:
// deleted when nothing points at them, otherwise set inactive (a linked record is never lost).
import { trustConnection } from '@/lib/trust/board';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TrustVendor { code: string; name: string; isActive: boolean }
export interface SupplierSyncReport {
  added: string[];
  updated: string[];
  removed: string[];
  deactivated: string[];   // not in Trust, but still linked to records
  total: number;           // Trust vendors
}

const norm = (c: string) => c.trim().toUpperCase();

async function trustVendors(): Promise<TrustVendor[]> {
  const conn = trustConnection();
  if ('error' in conn) throw new Error(`Trust System ${conn.error}`);
  const res = await fetch(`${conn.base}/vendors`, { headers: { 'X-API-Key': conn.key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Trust System vendors: HTTP ${res.status} — ${conn.where}`);
  const body = await res.json();
  const list = (Array.isArray(body) ? body : body?.data ?? []) as TrustVendor[];
  return list.filter(v => v?.code?.trim() && v?.name?.trim());
}

/** Linked records per supplier id — what a delete would cut off. */
async function linkedIds(admin: any, ids: string[]): Promise<Set<string>> {
  const linked = new Set<string>();
  if (!ids.length) return linked;
  for (const [table, col] of [['production_items', 'vendor_id'], ['supplier_invoices', 'supplier_id'], ['supplier_payments', 'supplier_id'], ['trust_expenses', 'supplier_id'], ['design_materials', 'supplier_id']]) {
    const { data, error } = await admin.from(table).select(col).in(col, ids);
    if (error) { ids.forEach(id => linked.add(id)); continue; } // can't tell — keep them
    for (const r of data ?? []) linked.add(r[col]);
  }
  return linked;
}

export async function syncSuppliersFromTrust(admin: any, { removeMissing = false }: { removeMissing?: boolean } = {}): Promise<SupplierSyncReport> {
  const vendors = await trustVendors();
  const { data: ours, error } = await admin.from('suppliers').select('id, code, name, is_active');
  if (error) throw new Error(`suppliers: ${error.message}`);
  const byCode = new Map<string, { id: string; code: string | null; name: string; is_active: boolean | null }>();
  for (const s of ours ?? []) if (s.code) byCode.set(norm(s.code), s);

  const report: SupplierSyncReport = { added: [], updated: [], removed: [], deactivated: [], total: vendors.length };
  const trustCodes = new Set<string>();
  for (const v of vendors) {
    const code = v.code.trim(); const name = v.name.trim(); const active = v.isActive !== false;
    trustCodes.add(norm(code));
    const mine = byCode.get(norm(code));
    if (!mine) {
      const { error: e } = await admin.from('suppliers').insert({ code, name, is_active: active, country: 'TR' });
      if (e) throw new Error(`add ${code}: ${e.message}`);
      report.added.push(`${code} ${name}`);
    } else if (mine.name !== name || (mine.is_active !== false) !== active) {
      const { error: e } = await admin.from('suppliers').update({ name, is_active: active }).eq('id', mine.id);
      if (e) throw new Error(`update ${code}: ${e.message}`);
      report.updated.push(`${code} ${mine.name} → ${name}`);
    }
  }

  if (removeMissing) {
    const extra = (ours ?? []).filter((s: { code: string | null }) => !s.code || !trustCodes.has(norm(s.code)));
    const linked = await linkedIds(admin, extra.map((s: { id: string }) => s.id));
    for (const s of extra) {
      const label = `${s.code ?? '—'} ${s.name}`;
      if (linked.has(s.id)) {
        if (s.is_active !== false) await admin.from('suppliers').update({ is_active: false }).eq('id', s.id);
        report.deactivated.push(label);
      } else {
        const { error: e } = await admin.from('suppliers').delete().eq('id', s.id);
        if (e) { await admin.from('suppliers').update({ is_active: false }).eq('id', s.id); report.deactivated.push(label); }
        else report.removed.push(label);
      }
    }
  }
  return report;
}
