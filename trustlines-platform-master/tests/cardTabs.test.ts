import { describe, expect, it } from 'vitest';
import { buildCardTabs, type CardDeal, type CardDetails, type CardItemDetail } from '@/lib/dashboard/cardTabs';
import { moneyLevel } from '@/lib/dashboard/cardDetails';
import type { TrustItem } from '@/lib/trust/board';

const deal = (kind: CardDeal['kind'], createdAt: string): CardDeal => ({
  id: `${kind}-${createdAt}`, kind, title: 'Arnold', brand: 'Brew Oil', code: 'STSE507', stage: kind === 'potential' ? 'converted' : 'negotiation',
  stageLabel: null, owner: null, createdAt, nextAction: null, nextActionDate: null, dueDate: null,
});
const item = (p: Partial<TrustItem>): TrustItem => ({ type: 'MILLWORK', status: null, pfCode: null, containerNo: null, containerDate: null, ...p });
const project = { id: 'p', code: 'STSE 507', name: 'Brew Oil', currentStage: 'closed_deal', site: null, closedDealDate: null, estDeliveryDate: null };
const row = (p: Partial<CardItemDetail>): CardItemDetail => ({
  id: Math.random().toString(36), type: 'MILLWORK', source: 'project', orderType: null, status: 'NOT_ORDERED', note: null, description: null,
  poSign: 'NOT_SIGNED', dates: { std: null, etd: null, rtd: null, rtr: null, rdy: null, ftd: null, snd: null, target: null }, container: null, ...p,
});
const details = (p: Partial<CardDetails>): CardDetails => ({ money: 'all', extra: null, items: [], installs: [], finance: null, ...p });

describe('buildCardTabs', () => {
  it('lists only the stages a deal has reached', () => {
    const tabs = buildCardTabs({ deals: [deal('opportunity', '2026-02-01'), deal('potential', '2026-01-01')], project: null, trustItems: null, details: null, today: '2026-11-02' });
    expect(tabs.map(t => t.title)).toEqual(['Potential', 'Opportunity']);
  });

  it('adds the project stages from the Trust types, in pipeline order', () => {
    const tabs = buildCardTabs({
      deals: [deal('opportunity', '2026-02-01')], project, details: null, today: '2026-11-02',
      trustItems: [
        item({ type: 'MILLWORK', status: 'SENT', pfCode: 'PF-1', containerNo: 'MSCU1', containerDate: '2026-10-30' }),
        item({ type: 'IMAGE', status: 'TO_ORDER', pfCode: 'PF-2' }),
      ],
    });
    expect(tabs.map(t => t.title)).toEqual(['Opportunity', 'Finalization', 'PO + PF', 'Production', 'Shipping']);
    expect(tabs.map(t => t.chip.label)).toEqual(['Negotiation', 'Done', 'PF 2/2', 'Ordered 1/2', 'Shipped 1/2']);
  });

  it('shows Finance only when the totals were sent (the viewer may see them)', () => {
    const tabs = buildCardTabs({ deals: [], project, trustItems: [], details: details({ finance: { level: 'pf', pfUsd: 1200 } }), today: '2026-11-02' });
    expect(tabs.map(t => [t.title, t.chip.label])).toEqual([['Finalization', 'In progress'], ['Finance', 'PF $1,200']]);
  });

  it('the T-Lines side sees PO, never PF: PO + PF tab by PO signatures, Finance by the PO total', () => {
    // No PF code reaches a T-Lines viewer, so the tab comes from our rows' PO side.
    const tabs = buildCardTabs({
      deals: [], project, trustItems: [], today: '2026-11-02',
      details: details({ money: 'po', items: [row({ poSign: 'SIGNED', poUsd: 900 }), row({ type: 'IMAGE' })], finance: { level: 'po', poUsd: 900 } }),
    });
    expect(tabs.map(t => [t.title, t.chip.label])).toEqual([['Finalization', 'In progress'], ['PO + PF', 'PO signed 1/2'], ['Finance', 'PO $900']]);
  });

  it('adds Installation when the plan has the project', () => {
    const tabs = buildCardTabs({
      deals: [], project, trustItems: [], today: '2026-11-02',
      details: details({ installs: [{ label: '507', start: '2026-12-01', finish: '2026-12-10', team: 'Team A', teamSize: 4, scope: null, pm: null, status: 'Scheduled', confidence: null, blockers: null, notes: null }] }),
    });
    expect(tabs.map(t => [t.title, t.chip.label])).toEqual([['Finalization', 'In progress'], ['Installation', 'Scheduled']]);
  });
});

describe('buildCardTabs — Roles page switches', () => {
  it('leaves out the tabs the role may not see', () => {
    const tabs = buildCardTabs({
      deals: [deal('opportunity', '2026-02-01')], project, details: null, today: '2026-11-02', allowed: ['finalization', 'production'],
      trustItems: [item({ status: 'ORDERED', pfCode: 'PF-1' })],
    });
    expect(tabs.map(t => t.title)).toEqual(['Finalization', 'Production']);
  });
});

describe('moneyLevel', () => {
  it('general manager all, T-Lines side PO, Trust Lines side PF', () => {
    expect(moneyLevel('general_manager', false)).toBe('all');
    expect(moneyLevel('tlines_pm', false)).toBe('po');
    expect(moneyLevel('sales_rep', false)).toBe('po');
    expect(moneyLevel('ops_manager', false)).toBe('pf');
    expect(moneyLevel('trustlines_pm', false)).toBe('pf');
    expect(moneyLevel('anyone', true)).toBe('all');
  });
});
