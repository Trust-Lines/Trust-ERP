// The tabs of a dashboard card's popup (components/platform/dashboard/BoardItemView): one per
// stage the project has reached, in pipeline order — Potential, Opportunity, Finalization,
// PO + PF, Production, Shipping, Finance. Browser-safe, no I/O.
import { HOLD, PAST_ORDERED, typeLabel, type TrustItem } from '@/lib/trust/board';
import type { ProjectFinance } from '@/lib/finance/projectTotals';

export type CardPhase = 'potential' | 'opportunity' | 'project';
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

export type CardTab =
  | { key: string; phase: 'potential' | 'opportunity'; view: 'deal'; title: string; sub: string | null; chip: CardChip; deal: CardDeal }
  | { key: 'finalization'; phase: 'project'; view: 'finalization'; title: string; sub: string | null; chip: CardChip }
  | { key: 'po_pf' | 'production' | 'shipping'; phase: 'project'; view: 'items'; title: string; sub: string | null; chip: CardChip; items: TrustItem[] }
  | { key: 'finance'; phase: 'project'; view: 'finance'; title: string; sub: string | null; chip: CardChip; finance: ProjectFinance };

const CLOSED_LOST = new Set(['lost', 'cancelled', 'closed_lost']);
const CLOSED_WON = new Set(['won', 'converted', 'closed_won']);

const shippedBy = (today: string) => (i: TrustItem) =>
  !!i.containerNo?.trim() && !!i.containerDate && i.containerDate.slice(0, 10) <= today;

const types = (items: TrustItem[]) => [...new Set(items.map(i => typeLabel(i.type)).filter(Boolean))].join(', ') || null;

export function buildCardTabs({ deals, project, trustItems, finance, today }: {
  deals: CardDeal[];
  project: CardProject | null;
  trustItems: TrustItem[] | null;
  finance: ProjectFinance | null;
  today: string;              // yyyy-mm-dd
}): CardTab[] {
  const tabs: CardTab[] = [];
  const items = trustItems ?? [];

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

  if (!project && !items.length) return tabs;

  const withPf = items.filter(i => i.pfCode?.trim());
  const inProduction = items.filter(i => i.status === 'TO_ORDER' || (!!i.status && PAST_ORDERED.has(i.status)));
  const withContainer = items.filter(i => i.containerNo?.trim());
  const later = withPf.length + inProduction.length + withContainer.length > 0;

  tabs.push({
    key: 'finalization', phase: 'project', view: 'finalization', title: 'Finalization',
    sub: project?.code ?? null,
    chip: later ? { label: 'Done', tone: 't9' } : { label: 'In progress', tone: 't2' },
  });

  if (withPf.length) {
    tabs.push({
      key: 'po_pf', phase: 'project', view: 'items', title: 'PO + PF', sub: types(withPf), items,
      chip: { label: `PF ${withPf.length}/${items.length}`, tone: withPf.length === items.length ? 't9' : 't2' },
    });
  }

  if (inProduction.length) {
    const held = items.some(i => !!i.status && HOLD.has(i.status));
    const ordered = items.filter(i => !!i.status && PAST_ORDERED.has(i.status)).length;
    tabs.push({
      key: 'production', phase: 'project', view: 'items', title: 'Production', sub: types(inProduction), items,
      chip: held ? { label: 'On Hold', tone: 't7' }
        : { label: `Ordered ${ordered}/${items.length}`, tone: ordered === items.length ? 't9' : 't2' },
    });
  }

  if (withContainer.length) {
    const shipped = items.filter(shippedBy(today)).length;
    tabs.push({
      key: 'shipping', phase: 'project', view: 'items', title: 'Shipping', sub: types(withContainer), items,
      chip: shipped === 0 ? { label: 'Booked', tone: 't0' }
        : { label: shipped === items.length ? 'Shipped' : `Shipped ${shipped}/${items.length}`, tone: shipped === items.length ? 't9' : 't2' },
    });
  }

  if (finance) {
    const pf = finance.production.pfUsd;
    tabs.push({
      key: 'finance', phase: 'project', view: 'finance', title: 'Finance', sub: project?.code ?? null, finance,
      chip: { label: pf ? `PF $${Math.round(pf).toLocaleString('en-US')}` : 'No PF yet', tone: pf ? 't2' : 't0' },
    });
  }

  return tabs;
}

export const isShipped = (i: TrustItem, today: string) => shippedBy(today)(i);
