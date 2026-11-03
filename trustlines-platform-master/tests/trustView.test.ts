import { describe, expect, it } from 'vitest';
import { trustDashboard, waitsForSignature, type TrustCard } from '@/lib/dashboard/trustView';
import type { TrustProject } from '@/lib/trust/board';

const project = (items: Partial<NonNullable<TrustProject['items']>[number]>[]) =>
  ({ id: 'p', projectNo: '1', name: 'X', address: null, bucket: 'TLINES_SE', status: 'PRE_PROJECT', types: null, createdAt: '2026-01-01', deletedAt: null,
     items: items.map(i => ({ type: 'MILLWORK', status: null, pfCode: null, containerNo: null, containerDate: null, ...i })) }) as TrustProject;
const card = (stage: TrustCard['stage'], onHold = false): TrustCard => ({
  region: 'TLINES_SE', stage, createdAt: '2026-01-01',
  item: { id: stage, kind: 'trust', badgeTop: '#1', badgeBottom: '', title: 'Brew Oil', subtitle: null, category: 'Millwork', pmName: null, pmLabel: '', onHold, dateISO: null, dateLabel: null, href: '' },
});

describe('Trust Lines dashboard', () => {
  it('a PF / PO waits for a signature until both are signed', () => {
    expect(waitsForSignature(project([{ pfCode: 'PF-1', pfSignStatus: 'SIGNED', poSignStatus: 'NOT_SIGNED' }]))).toBe(true);
    expect(waitsForSignature(project([{ pfCode: 'PF-1', pfSignStatus: 'SIGNED WITH EST PRICE', poSignStatus: 'SIGNED' }]))).toBe(false);
    expect(waitsForSignature(project([{ pfCode: null, pfSignStatus: 'NOT_SIGNED' }]))).toBe(false);
  });

  it('one column per production stage, the branch in front of the types, and the KPIs', () => {
    const { columns, kpis } = trustDashboard({ projects: [], cards: [card('technical'), card('in_production', true), card('in_production')], weekAgo: '2026-12-01' });
    expect(columns.map(c => c.title)).toEqual(['Finalization', 'Technical / PO + PF', 'To Production', 'Production In Progress', 'Shipped']);
    expect(columns[3].sections[0].items).toHaveLength(2);
    expect(columns[1].sections[0].items[0].category).toBe('SE · Millwork');
    expect(Object.fromEntries(kpis.map(k => [k.key, k.value]))).toEqual({ active: 3, to_sign: 0, to_order: 0, production: 2, on_hold: 1, shipped: 0 });
  });
});
