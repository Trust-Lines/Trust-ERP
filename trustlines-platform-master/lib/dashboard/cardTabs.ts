// The tabs of a dashboard card's popup (components/platform/dashboard/BoardItemView): one per
// stage the project has reached, in pipeline order — Potential, Opportunity, Finalization,
// PO + PF, Production, Shipping, Finance. Browser-safe, no I/O.
import { HOLD, PAST_ORDERED, typeLabel, type TrustItem } from '@/lib/trust/board';

export type CardPhase = 'potential' | 'opportunity' | 'project';

/** Each tab's switch on the Roles page ("Dashboard project popup", lib/permissions/catalog). */
export const CARD_TAB_PERMS = {
  deal: 'view.card_deal',
  finalization: 'view.card_finalization',
  po_pf: 'view.card_po_pf',
  production: 'view.card_production',
  shipping: 'view.card_shipping',
  installation: 'view.card_installation',
  finance: 'view.card_finance',
} as const;
export type CardTabKey = keyof typeof CARD_TAB_PERMS;
export type ChipTone = 't0' | 't2' | 't7' | 't9' | 't10';
export interface CardChip { label: string; tone: ChipTone }

export interface CardDeal {
  id: string;
  kind: 'opportunity' | 'potential';
  title: string | null;
  brand: string | null;
  code: string | null;
  stage: string | null;
  stageLabel: string | null;
  owner: string | null;
  createdAt: string;
  nextAction: string | null;
  nextActionDate: string | null;
  dueDate: string | null;
}

export interface CardProject {
  id: string;
  code: string;
  name: string;
  currentStage: string;
  site: string | null;
  closedDealDate: string | null;
  estDeliveryDate: string | null;
}

/** Which prices a viewer gets (lib/dashboard/cardDetails): all, PO only, PF only. */
export type MoneyLevel = 'all' | 'po' | 'pf' | 'none';
type ByCur = Record<string, number>;

/** One production row of our project (production_items), money cut to the viewer's level. */
export interface CardItemDetail {
  id: string;
  type: string;
  source: string | null;
  orderType: string | null;
  status: string | null;
  note: string | null;
  description: string | null;
  poSign: string | null;
  dates: Record<'std' | 'etd' | 'rtd' | 'rtr' | 'rdy' | 'ftd' | 'snd' | 'target', string | null>;
  container: { no: string | null; status: string | null; carrier: string | null; vessel: string | null; departure: string | null; eta: string | null; arrival: string | null; destination: string | null } | null;
  // PF side
  vendor?: string | null; pfCode?: string | null; pfSign?: string | null;
  pfUsd?: number; pfTl?: number; expensesUsd?: number; expensesTl?: number;
  // PO side
  poUsd?: number; poTl?: number; invoiceNo?: string | null; invoiceDate?: string | null;
  // general manager
  paidUsd?: number; paidTl?: number;
}

export interface CardProjectExtra {
  region: string | null; company: string | null; client: string | null; createdAt: string | null;
  categories: string[]; scope: string | null;
  estFinalization: string | null; estProductionStart: string | null; estDelivery: string | null; actualDelivery: string | null; hardDeadline: boolean;
  people: { label: string; name: string | null }[];
  dealValue?: number | null; currency?: string | null; paymentTerms?: string | null; marginTarget?: number | null;
}

export interface CardInstall {
  label: string; start: string | null; finish: string | null; team: string | null; teamSize: number | null; scope: string | null;
  pm: string | null; status: string | null; confidence: string | null; blockers: string | null; notes: string | null;
}

/** One PO document's total (lib/dashboard/cardDetails pickPoDocs): per type, USD. */
export interface CardPoDoc { type: string; status: string; version: number; usd: number }

/** Finance totals, cut to the level: only the keys the viewer may see are present. PO = the PO
 *  documents (USD); invoiced = the production rows' invoice columns. */
export interface CardMoney {
  level: MoneyLevel;
  pfUsd?: number; pfTl?: number; expensesUsd?: number; expensesTl?: number;
  supplierInvoices?: ByCur; supplierPayments?: ByCur; supplierBalance?: ByCur; trustExpenses?: ByCur;
  poUsd?: number; poDocs?: CardPoDoc[]; invoicedUsd?: number; invoicedTl?: number; paidUsd?: number; paidTl?: number;
  dealValue?: number | null; currency?: string | null; marginTarget?: number | null; marginUsd?: number | null;
}

export interface CardDetails { money: MoneyLevel; extra: CardProjectExtra | null; items: CardItemDetail[]; installs: CardInstall[]; finance: CardMoney | null }

export type CardTab =
  | { key: string; phase: 'potential' | 'opportunity'; view: 'deal'; title: string; sub: string | null; chip: CardChip; deal: CardDeal }
  | { key: 'finalization'; phase: 'project'; view: 'finalization'; title: string; sub: string | null; chip: CardChip }
  | { key: 'po_pf' | 'production' | 'shipping'; phase: 'project'; view: 'items'; title: string; sub: string | null; chip: CardChip; items: TrustItem[] }
  | { key: 'installation'; phase: 'project'; view: 'installation'; title: string; sub: string | null; chip: CardChip; installs: CardInstall[] }
  | { key: 'finance'; phase: 'project'; view: 'finance'; title: string; sub: string | null; chip: CardChip; finance: CardMoney };

const CLOSED_LOST = new Set(['lost', 'cancelled', 'closed_lost']);
const CLOSED_WON = new Set(['won', 'converted', 'closed_won']);

const shippedBy = (today: string) => (i: TrustItem) =>
  !!i.containerNo?.trim() && !!i.containerDate && i.containerDate.slice(0, 10) <= today;

const types = (items: TrustItem[]) => [...new Set(items.map(i => typeLabel(i.type)).filter(Boolean))].join(', ') || null;

export function buildCardTabs({ allowed, ...data }: {
  deals: CardDeal[];
  project: CardProject | null;
  trustItems: TrustItem[] | null;
  details: CardDetails | null;
  today: string;              // yyyy-mm-dd
  /** The tabs this role may see; every one when not given. */
  allowed?: readonly string[];
}): CardTab[] {
  const tabs = allTabs(data);
  return allowed ? tabs.filter(t => allowed.includes(t.view === 'deal' ? 'deal' : t.key)) : tabs;
}

function allTabs({ deals, project, trustItems, details, today }: {
  deals: CardDeal[]; project: CardProject | null; trustItems: TrustItem[] | null; details: CardDetails | null; today: string;
}): CardTab[] {
  const tabs: CardTab[] = [];
  const items = trustItems ?? [];
  const finance = details?.finance ?? null;
  const rows = details?.items ?? [];
  const installs = details?.installs ?? [];

  // Potentials first, then Opportunities — oldest first, the order the deal went through them.
  const ordered = [...deals].sort((a, b) => (a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === 'potential' ? -1 : 1));
  for (const d of ordered) {
    const stage = (d.stage ?? '').toLowerCase();
    const tone: ChipTone = CLOSED_LOST.has(stage) ? 't10' : CLOSED_WON.has(stage) || !!project ? 't9' : stage === 'on_hold' ? 't7' : 't2';
    tabs.push({
      key: `${d.kind}:${d.id}`, phase: d.kind, view: 'deal',
      title: d.kind === 'potential' ? 'Potential' : 'Opportunity',
      sub: d.title ?? d.code,
      chip: { label: d.stageLabel ?? typeLabel(d.stage) ?? (d.kind === 'potential' ? 'Potential' : 'Opportunity'), tone },
      deal: d,
    });
  }

  if (!project && !items.length && !installs.length) return tabs;

  const withPf = items.filter(i => i.pfCode?.trim());
  const inProduction = items.filter(i => i.status === 'TO_ORDER' || (!!i.status && PAST_ORDERED.has(i.status)));
  const withContainer = items.filter(i => i.containerNo?.trim());
  const later = withPf.length + inProduction.length + withContainer.length > 0;

  tabs.push({
    key: 'finalization', phase: 'project', view: 'finalization', title: 'Finalization',
    sub: project?.code ?? null,
    chip: later ? { label: 'Done', tone: 't9' } : { label: 'In progress', tone: 't2' },
  });

  // Our production rows say more than the Trust System (PO / PF prices, signatures).
  const poSigned = rows.filter(r => r.poSign === 'SIGNED').length;
  if (withPf.length || rows.some(r => r.pfCode || r.poUsd || r.pfUsd || (r.poSign && r.poSign !== 'NOT_SIGNED'))) {
    const pfRows = rows.filter(r => r.pfCode);
    tabs.push({
      key: 'po_pf', phase: 'project', view: 'items', title: 'PO + PF', sub: types(withPf) ?? ([...new Set(rows.map(r => typeLabel(r.type)))].join(', ') || null), items,
      chip: details?.money === 'po' || (!withPf.length && !pfRows.length)
        ? { label: `PO signed ${poSigned}/${rows.length}`, tone: rows.length && poSigned === rows.length ? 't9' : 't2' }
        : withPf.length
          ? { label: `PF ${withPf.length}/${items.length}`, tone: withPf.length === items.length ? 't9' : 't2' }
          : { label: `PF ${pfRows.length}/${rows.length}`, tone: pfRows.length === rows.length ? 't9' : 't2' },
    });
  }

  // Our rows' types when the Trust System has none.
  const rowTypes = (rs: CardItemDetail[]) => [...new Set(rs.map(r => typeLabel(r.type)).filter(Boolean))].join(', ') || null;

  const rowsInProduction = rows.filter(r => !!r.status && r.status !== 'NOT_ORDERED');
  if (inProduction.length || rowsInProduction.length) {
    const src = items.length ? items : rows;
    const held = src.some(i => !!i.status && HOLD.has(i.status));
    const ordered = src.filter(i => !!i.status && PAST_ORDERED.has(i.status)).length;
    tabs.push({
      key: 'production', phase: 'project', view: 'items', title: 'Production', sub: types(inProduction) ?? rowTypes(rowsInProduction), items,
      chip: held ? { label: 'On Hold', tone: 't7' }
        : { label: `Ordered ${ordered}/${src.length}`, tone: ordered === src.length ? 't9' : 't2' },
    });
  }

  const rowsWithContainer = rows.filter(r => r.container?.no);
  if (withContainer.length || rowsWithContainer.length) {
    const shipped = items.length ? items.filter(shippedBy(today)).length
      : rowsWithContainer.filter(r => !!r.container?.departure && r.container.departure.slice(0, 10) <= today).length;
    const total = items.length || rows.length;
    tabs.push({
      key: 'shipping', phase: 'project', view: 'items', title: 'Shipping', sub: types(withContainer) ?? rowTypes(rowsWithContainer), items,
      chip: shipped === 0 ? { label: 'Booked', tone: 't0' }
        : { label: shipped === total ? 'Shipped' : `Shipped ${shipped}/${total}`, tone: shipped === total ? 't9' : 't2' },
    });
  }

  if (installs.length) {
    const st = (installs[0].status ?? '').toLowerCase();
    tabs.push({
      key: 'installation', phase: 'project', view: 'installation', title: 'Installation', sub: installs[0].team ?? installs[0].pm ?? null, installs,
      chip: { label: installs[0].status ?? 'Planned', tone: st === 'completed' ? 't9' : st.includes('hold') ? 't7' : 't2' },
    });
  }

  if (finance) {
    const pf = finance.pfUsd ?? 0, po = finance.poUsd ?? 0;
    const label = finance.level === 'po'
      ? (po ? `PO $${Math.round(po).toLocaleString('en-US')}` : 'No PO price yet')
      : (pf ? `PF $${Math.round(pf).toLocaleString('en-US')}` : 'No PF yet');
    tabs.push({
      key: 'finance', phase: 'project', view: 'finance', title: 'Finance', sub: project?.code ?? null, finance,
      chip: { label, tone: pf || po ? 't2' : 't0' },
    });
  }

  return tabs;
}

export const isShipped = (i: TrustItem, today: string) => shippedBy(today)(i);
