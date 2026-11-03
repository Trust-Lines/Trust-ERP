// A supplier's work in the Trust System: every Production item (a project's type — Millwork,
// Image, …) given to this vendor, with its dates, PF amount and what has been paid. Matched by
// the vendor's code, the same key the supplier list is synced on (lib/suppliers/trustSync).
// Browser-safe, no I/O.

/** The Trust item fields this needs (the API sends more). */
export interface TrustVendorItem {
  type: string | null;
  pfCode: string | null;
  status: string | null;
  vendor?: { code?: string | null; name?: string | null } | null;
  std?: string | null;          // start
  rdy?: string | null;          // ready
  snd?: string | null;          // sent
  containerNo?: string | null;
  containerDate?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  pfUsd?: number | null; pfTl?: number | null;
  paidUsd1?: number | null; paidUsd2?: number | null; paidTl1?: number | null; paidTl2?: number | null;
  paidUsd1Date?: string | null; paidUsd2Date?: string | null; paidTl1Date?: string | null; paidTl2Date?: string | null;
  invoiceNumber?: string | null; invoiceDate?: string | null;
}
export interface TrustVendorProject { projectNo: string; name: string; address: string | null; status: string; items: TrustVendorItem[] | null }

export interface VendorWorkRow {
  projectNo: string;
  projectName: string;
  projectDone: boolean;
  type: string | null;
  pfCode: string | null;
  status: string | null;
  startedAt: string | null;
  readyAt: string | null;
  sentAt: string | null;
  containerNo: string | null;
  lastPaidAt: string | null;
  invoiceNumber: string | null;
  pfUsd: number; pfTl: number;
  paidUsd: number; paidTl: number;
}

export interface VendorWork {
  rows: VendorWorkRow[];
  projects: number;
  firstAt: string | null;       // first work date
  lastAt: string | null;        // latest work date
  totals: { pfUsd: number; pfTl: number; paidUsd: number; paidTl: number; dueUsd: number; dueTl: number };
}

// yyyy-mm-dd; a mistyped year in the Trust System ("0026-12-05") is left out rather than shown
// as the first work date.
const day = (d: string | null | undefined) => (d && d.slice(0, 4) >= '2000' ? d.slice(0, 10) : null);
const n = (v: number | null | undefined) => Number(v) || 0;

export function vendorWork(projects: TrustVendorProject[], code: string | null): VendorWork {
  const key = (code ?? '').trim().toUpperCase();
  const rows: VendorWorkRow[] = [];
  if (key) {
    for (const p of projects) {
      for (const i of p.items ?? []) {
        if (i.deletedAt || (i.vendor?.code ?? '').trim().toUpperCase() !== key) continue;
        const paidDates = [i.paidUsd1Date, i.paidUsd2Date, i.paidTl1Date, i.paidTl2Date].map(day).filter((d): d is string => !!d).sort();
        rows.push({
          projectNo: p.projectNo, projectName: p.name, projectDone: p.status === 'DONE',
          type: i.type, pfCode: i.pfCode, status: i.status,
          startedAt: day(i.std) ?? day(i.createdAt), readyAt: day(i.rdy), sentAt: day(i.snd) ?? day(i.containerDate),
          containerNo: i.containerNo ?? null, lastPaidAt: paidDates.at(-1) ?? null, invoiceNumber: i.invoiceNumber ?? null,
          pfUsd: n(i.pfUsd), pfTl: n(i.pfTl), paidUsd: n(i.paidUsd1) + n(i.paidUsd2), paidTl: n(i.paidTl1) + n(i.paidTl2),
        });
      }
    }
  }
  // Newest work first.
  rows.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || b.projectNo.localeCompare(a.projectNo));

  const sum = (k: 'pfUsd' | 'pfTl' | 'paidUsd' | 'paidTl') => rows.reduce((s, r) => s + r[k], 0);
  const totals = { pfUsd: sum('pfUsd'), pfTl: sum('pfTl'), paidUsd: sum('paidUsd'), paidTl: sum('paidTl'), dueUsd: 0, dueTl: 0 };
  totals.dueUsd = totals.pfUsd - totals.paidUsd;
  totals.dueTl = totals.pfTl - totals.paidTl;
  const dates = rows.flatMap(r => [r.startedAt, r.readyAt, r.sentAt, r.lastPaidAt]).filter((d): d is string => !!d).sort();
  return { rows, projects: new Set(rows.map(r => r.projectNo)).size, firstAt: dates[0] ?? null, lastAt: dates.at(-1) ?? null, totals };
}
