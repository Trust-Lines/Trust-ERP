// Dashboard card popup → the project's full details, read on the server (service role) for
// /api/tlines-dashboard/card. Money is cut down to what the viewer may see BEFORE it leaves the
// server (AGENTS.md §2):
//   all  general_manager (or a role with every permission): PF, PO, expenses, payments, margin
//   po   the T-Lines side (tlines_pm, sales, marketing): PO prices only — never PF, vendor, cost
//   pf   the Trust Lines side (everyone else): PF, vendor, expenses — not the PO / invoice prices
//
// The PO price is the project's PO document (documents, doc_type 'po_bo', one per type): the sum
// of quantity × unit price, the same total its PDF prints — the approved one, else the latest
// draft. Margin = PO − PF − production expenses, in USD only; TL amounts are shown apart and stay
// out of it until accounting turns them into dollars.
import { loadProjectFinance } from '@/lib/finance/projectTotals';
import { projectNumber } from '@/lib/keyClients/match';
import { NO_PF_ROLES } from '@/lib/production/access';
import { SALES_DELIVER_ROLES } from '@/lib/sales/roles';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import type {
  CardDetails, CardInstall, CardItemDetail, CardMoney, CardPoDoc, CardProjectExtra, MoneyLevel,
} from './cardTabs';

/* eslint-disable @typescript-eslint/no-explicit-any */

const T_LINES_SIDE = new Set<string>([...NO_PF_ROLES, ...SALES_DELIVER_ROLES, ...MARKETING_ROLES]);

/** Which prices this role sees (see the top of the file). */
export function moneyLevel(role: string, everything: boolean): MoneyLevel {
  if (everything || role === 'general_manager') return 'all';
  return T_LINES_SIDE.has(role) ? 'po' : 'pf';
}

const num = (v: unknown) => Number(v) || 0;
const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + num(r[k]), 0);

export async function loadCardDetails(admin: any, p: {
  projectId: string | null;
  no: string | null;
  level: MoneyLevel;
  /** The Finance tab is on for this role (Roles page). */
  financeTab: boolean;
}): Promise<CardDetails> {
  const { projectId, no, level } = p;
  const seesPf = level === 'all' || level === 'pf';
  const seesPo = level === 'all' || level === 'po';
  // PF prices per row follow the Finance tab switch for the Trust Lines side.
  const pfMoney = level === 'all' || (level === 'pf' && p.financeTab);

  const [projRes, itemsRes, instRes, poRes] = await Promise.all([
    projectId
      ? admin.from('projects').select(
        'region, service_line, created_at, categories, scope_summary, est_finalization_date, est_production_start, est_delivery_date, actual_delivery_date, hard_deadline, deal_value, currency, payment_terms, margin_target_pct, ops_manager_id, trustlines_pm_id, tlines_pm_id, prod_pm_ms_id, prod_pm_ci_id, qc_inspector_id, client_id',
      ).eq('id', projectId).maybeSingle()
      : { data: null },
    projectId
      ? admin.from('production_items').select(
        'id, type, source, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, status_note, hold_note, description, std, etd, rtd, rtr, rdy, ftd, snd, target_date, pf_usd, pf_tl, invoice, invoice_tl, invoice_number, invoice_date, expenses_usd, expenses_tl, paid_usd1, paid_usd2, paid_tl1, paid_tl2, container_no, container_date, sort_index',
      ).eq('project_id', projectId).is('deleted_at', null).order('sort_index').limit(200)
      : { data: [] },
    no
      ? admin.from('installations').select('project_no, planned_start, planned_finish, team, team_size, scope, pm_name, status, confidence, blockers, notes')
        .ilike('project_no', `%${no}%`).limit(20)
      : { data: [] },
    // The PO documents: only this project, only 'po_bo' rows (indexed by project_id); form_data is
    // read for the totals and never leaves the server (its items carry vendor names).
    p.projectId && level !== 'none'
      ? admin.from('documents').select('cat_group, status, version, dropbox_version, form_data')
        .eq('project_id', p.projectId).eq('doc_type', 'po_bo').limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const proj = projRes.data as any;
  const rows = (itemsRes.error ? [] : itemsRes.data ?? []) as any[];

  // Names: people on the project, vendors, the client; containers the items sit in.
  const peopleIds = proj ? ['ops_manager_id', 'trustlines_pm_id', 'tlines_pm_id', 'prod_pm_ms_id', 'prod_pm_ci_id', 'qc_inspector_id'].map(k => proj[k]).filter(Boolean) : [];
  const vendorIds = seesPf ? [...new Set(rows.map(r => r.vendor_id).filter(Boolean))] : [];
  const itemIds = rows.map(r => r.id);
  const [peopleRes, vendorRes, clientRes, linkRes] = await Promise.all([
    peopleIds.length ? admin.from('profiles').select('id, full_name').in('id', peopleIds) : { data: [] },
    vendorIds.length ? admin.from('suppliers').select('id, name').in('id', vendorIds) : { data: [] },
    proj?.client_id ? admin.from('clients').select('name').eq('id', proj.client_id).maybeSingle() : { data: null },
    itemIds.length ? admin.from('container_items').select('production_item_id, container_id').in('production_item_id', itemIds) : { data: [] },
  ]);
  const personName = new Map(((peopleRes.data ?? []) as { id: string; full_name: string }[]).map(x => [x.id, x.full_name]));
  const vendorName = new Map(((vendorRes.data ?? []) as { id: string; name: string }[]).map(x => [x.id, x.name]));
  const links = (linkRes.error ? [] : linkRes.data ?? []) as { production_item_id: string; container_id: string }[];
  const containerIds = [...new Set(links.map(l => l.container_id))];
  const { data: containers } = containerIds.length
    ? await admin.from('containers').select('id, container_no, status, carrier, vessel_name, departure_date, estimated_arrival_date, actual_arrival_date, delivery_destination')
      .in('id', containerIds).is('deleted_at', null)
    : { data: [] };
  const containerById = new Map(((containers ?? []) as any[]).map(c => [c.id, c]));
  const containerOf = new Map(links.map(l => [l.production_item_id, containerById.get(l.container_id)]));

  const items: CardItemDetail[] = rows.map(r => {
    const c = containerOf.get(r.id);
    const d: CardItemDetail = {
      id: r.id, type: r.type, source: r.source, orderType: r.order_type, status: r.status,
      note: r.hold_note || r.status_note || null, description: r.description ?? null,
      poSign: r.po_sign_status ?? null,
      dates: { std: r.std, etd: r.etd, rtd: r.rtd, rtr: r.rtr, rdy: r.rdy, ftd: r.ftd, snd: r.snd, target: r.target_date },
      container: c || r.container_no ? {
        no: c?.container_no ?? r.container_no ?? null, status: c?.status ?? null, carrier: c?.carrier ?? null, vessel: c?.vessel_name ?? null,
        departure: c?.departure_date ?? r.container_date ?? null, eta: c?.estimated_arrival_date ?? null, arrival: c?.actual_arrival_date ?? null,
        destination: c?.delivery_destination ?? null,
      } : null,
    };
    if (seesPf) {
      Object.assign(d, {
        vendor: r.vendor_id ? vendorName.get(r.vendor_id) ?? null : null, pfCode: r.pf_code ?? null, pfSign: r.pf_sign_status ?? null,
      });
      if (pfMoney) Object.assign(d, { pfUsd: num(r.pf_usd), pfTl: num(r.pf_tl), expensesUsd: num(r.expenses_usd), expensesTl: num(r.expenses_tl) });
    }
    if (seesPo) Object.assign(d, { poUsd: num(r.invoice), poTl: num(r.invoice_tl), invoiceNo: r.invoice_number ?? null, invoiceDate: r.invoice_date ?? null });
    if (level === 'all') Object.assign(d, { paidUsd: num(r.paid_usd1) + num(r.paid_usd2), paidTl: num(r.paid_tl1) + num(r.paid_tl2) });
    return d;
  });

  const extra: CardProjectExtra | null = proj && {
    region: proj.region ?? null, company: proj.service_line ?? null, client: (clientRes.data as { name?: string } | null)?.name ?? null,
    createdAt: proj.created_at ?? null, categories: proj.categories ?? [], scope: proj.scope_summary ?? null,
    estFinalization: proj.est_finalization_date ?? null, estProductionStart: proj.est_production_start ?? null,
    estDelivery: proj.est_delivery_date ?? null, actualDelivery: proj.actual_delivery_date ?? null, hardDeadline: !!proj.hard_deadline,
    people: ([
      ['Ops manager', proj.ops_manager_id], ['Trust Lines PM', proj.trustlines_pm_id], ['T-Lines PM', proj.tlines_pm_id],
      ['Production PM (Millwork / Shelving)', proj.prod_pm_ms_id], ['Production PM (Ceiling / Image)', proj.prod_pm_ci_id], ['QC inspector', proj.qc_inspector_id],
    ] as [string, string | null][]).map(([label, id]) => ({ label, name: id ? personName.get(id) ?? null : null })),
    ...(seesPo ? { dealValue: proj.deal_value ?? null, currency: proj.currency ?? null, paymentTerms: proj.payment_terms ?? null } : {}),
    ...(level === 'all' ? { marginTarget: proj.margin_target_pct ?? null } : {}),
  };

  const installs: CardInstall[] = ((instRes.error ? [] : instRes.data ?? []) as any[])
    .filter(i => !no || projectNumber(String(i.project_no ?? '').replace(/^#+\s*/, '')) === no)
    .map(i => ({
      label: String(i.project_no ?? '').replace(/^#+\s*/, ''), start: i.planned_start, finish: i.planned_finish,
      team: i.team, teamSize: i.team_size, scope: i.scope, pm: i.pm_name, status: i.status, confidence: i.confidence,
      blockers: i.blockers, notes: i.notes,
    }));

  // The PO price: per type, the approved PO document, else the latest one not replaced.
  const poDocs = pickPoDocs((poRes?.error ? [] : poRes?.data ?? []) as any[]);
  const poUsd = poDocs.reduce((a, d) => a + d.usd, 0);

  // Finance totals, cut to the level.
  let finance: CardMoney | null = null;
  if (projectId && (p.financeTab || level === 'po')) {
    if (level === 'po') {
      finance = {
        level, poUsd, poDocs, invoicedUsd: sum(rows, 'invoice'), invoicedTl: sum(rows, 'invoice_tl'),
        dealValue: proj?.deal_value ?? null, currency: proj?.currency ?? null,
      };
    } else if (p.financeTab) {
      const f = await loadProjectFinance(admin, projectId);
      const pr = f.production;
      finance = {
        level, pfUsd: pr.pfUsd, pfTl: pr.pfTl, expensesUsd: pr.expensesUsd, expensesTl: pr.expensesTl,
        supplierInvoices: f.supplierInvoices, supplierPayments: f.supplierPayments, supplierBalance: f.supplierBalance, trustExpenses: f.trustExpenses,
      };
      if (level === 'all') {
        Object.assign(finance, {
          poUsd, poDocs, invoicedUsd: pr.invoiceUsd, invoicedTl: pr.invoiceTl, paidUsd: sum(rows, 'paid_usd1') + sum(rows, 'paid_usd2'), paidTl: sum(rows, 'paid_tl1') + sum(rows, 'paid_tl2'),
          dealValue: proj?.deal_value ?? null, currency: proj?.currency ?? null, marginTarget: proj?.margin_target_pct ?? null,
          marginUsd: poUsd ? poUsd - pr.pfUsd - pr.expensesUsd : null,
        });
      }
    }
  }

  return { money: level, extra, items, installs, finance };
}

/** The sum a PO document prints (lib/pdf/PurchaseOrderPdf): quantity × unit price over every item. */
export function poTotal(formData: unknown): number {
  let t = 0;
  for (const sec of Array.isArray(formData) ? formData : [])
    for (const cat of sec?.categories ?? [])
      for (const sub of cat?.subCategories ?? [])
        for (const g of sub?.groups ?? [])
          for (const it of g?.items ?? []) t += num(it?.quantity) * num(it?.unitPrice);
  return Math.round(t * 100) / 100;
}

const DEAD = new Set(['superseded', 'rejected', 'cancelled']);

/** Per type (cat_group): the approved PO document, else the newest one still standing. */
export function pickPoDocs(docs: { cat_group: string | null; status: string | null; version: number | null; dropbox_version: number | null; form_data: unknown }[]): CardPoDoc[] {
  const byType = new Map<string, typeof docs[number]>();
  const ver = (d: typeof docs[number]) => d.dropbox_version ?? d.version ?? 0;
  for (const d of docs) {
    if (DEAD.has(String(d.status ?? ''))) continue;
    const k = d.cat_group ?? '';
    const cur = byType.get(k);
    const better = !cur
      || (d.status === 'approved' && cur.status !== 'approved')
      || ((d.status === 'approved') === (cur.status === 'approved') && ver(d) > ver(cur));
    if (better) byType.set(k, d);
  }
  return [...byType.values()].map(d => ({
    type: d.cat_group ? d.cat_group.charAt(0).toUpperCase() + d.cat_group.slice(1) : 'PO',
    status: d.status ?? 'draft', version: ver(d), usd: poTotal(d.form_data),
  })).sort((a, b) => a.type.localeCompare(b.type));
}
