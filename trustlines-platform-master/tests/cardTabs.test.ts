import { describe, expect, it } from 'vitest';
import { buildCardTabs, type CardDeal } from '@/lib/dashboard/cardTabs';
import type { TrustItem } from '@/lib/trust/board';

const deal = (kind: CardDeal['kind'], createdAt: string): CardDeal => ({
  id: `${kind}-${createdAt}`, kind, title: 'Arnold', brand: 'Brew Oil', code: 'STSE507', stage: kind === 'potential' ? 'converted' : 'negotiation',
  stageLabel: null, owner: null, createdAt, nextAction: null, nextActionDate: null, dueDate: null,
});
const item = (p: Partial<TrustItem>): TrustItem => ({ type: 'MILLWORK', status: null, pfCode: null, containerNo: null, containerDate: null, ...p });
const project = { id: 'p', code: 'STSE 507', name: 'Brew Oil', currentStage: 'closed_deal', site: null, closedDealDate: null, estDeliveryDate: null };

describe('buildCardTabs', () => {
  it('lists only the stages a deal has reached', () => {
    const tabs = buildCardTabs({ deals: [deal('opportunity', '2026-02-01'), deal('potential', '2026-01-01')], project: null, trustItems: null, finance: null, today: '2026-11-02' });
    expect(tabs.map(t => t.title)).toEqual(['Potential', 'Opportunity']);
  });

  it('adds the project stages from the Trust types, in pipeline order', () => {
    const tabs = buildCardTabs({
      deals: [deal('opportunity', '2026-02-01')], project, finance: null, today: '2026-11-02',
      trustItems: [
        item({ type: 'MILLWORK', status: 'SENT', pfCode: 'PF-1', containerNo: 'MSCU1', containerDate: '2026-10-30' }),
        item({ type: 'IMAGE', status: 'TO_ORDER', pfCode: 'PF-2' }),
      ],
    });
    expect(tabs.map(t => t.title)).toEqual(['Opportunity', 'Finalization', 'PO + PF', 'Production', 'Shipping']);
    expect(tabs.map(t => t.chip.label)).toEqual(['Negotiation', 'Done', 'PF 2/2', 'Ordered 1/2', 'Shipped 1/2']);
  });

  it('shows Finance only when the totals were sent (the viewer may see them)', () => {
    const finance = { production: { pfUsd: 1200, pfTl: 0, invoiceUsd: 0, invoiceTl: 0, expensesUsd: 0, expensesTl: 0 }, supplierInvoices: { USD: 0, TL: 0, EUR: 0 }, supplierPayments: { USD: 0, TL: 0, EUR: 0 }, supplierBalance: { USD: 0, TL: 0, EUR: 0 }, trustExpenses: { USD: 0, TL: 0, EUR: 0 } };
    const tabs = buildCardTabs({ deals: [], project, trustItems: [], finance, today: '2026-11-02' });
    expect(tabs.map(t => [t.title, t.chip.label])).toEqual([['Finalization', 'In progress'], ['Finance', 'PF $1,200']]);
  });
});
