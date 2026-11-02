import { describe, expect, it } from 'vitest';
import { classifyTrustProject, type TrustItem, type TrustProject } from '@/lib/trust/board';

const item = (o: Partial<TrustItem>): TrustItem => ({ type: 'IMAGE', status: 'NOT_ORDERED', pfCode: null, containerNo: null, containerDate: null, ...o });
const project = (items: TrustItem[]): TrustProject => ({
  id: 'p', projectNo: '490', name: 'CHESTNUT MARKET', address: null, bucket: 'TLINES_NE', status: 'PRE_PROJECT',
  types: null, createdAt: '2026-08-31T09:09:28.735Z', deletedAt: null, items,
});
const TODAY = '2026-10-30';

describe('classifyTrustProject', () => {
  it('is Finalization just by being in Trust', () => {
    expect(classifyTrustProject(project([item({})]), TODAY).stage).toBe('finalization');
    expect(classifyTrustProject(project([]), TODAY).stage).toBe('finalization');
  });
  it('is Technical once a type has a PF code, and names those types', () => {
    const e = classifyTrustProject(project([item({ type: 'CEILING', pfCode: 'PAR-490-C01' }), item({ type: 'IMAGE' })]), TODAY);
    expect(e).toMatchObject({ stage: 'technical', note: 'PF code: Ceiling' });
  });
  it('TO_ORDER beats ORDERED', () => {
    expect(classifyTrustProject(project([item({ status: 'ORDERED' }), item({ status: 'TO_ORDER' })]), TODAY).stage).toBe('to_production');
  });
  it('ORDERED or past it is Production In Progress', () => {
    expect(classifyTrustProject(project([item({ status: 'ORDERED' })]), TODAY).stage).toBe('in_production');
    expect(classifyTrustProject(project([item({ status: 'READY_TO_RECEIVE' }), item({ status: 'RECEIVED' })]), TODAY).stage).toBe('in_production');
  });
  it('is Shipped with a container dated today or earlier, listing what has not shipped', () => {
    const e = classifyTrustProject(project([
      item({ type: 'MILLWORK', status: 'SENT', containerNo: 'CONTAINER 23', containerDate: '2026-09-29T00:00:00.000Z' }),
      item({ type: 'IMAGE', status: 'ORDERED' }),
    ]), TODAY);
    expect(e).toMatchObject({ stage: 'shipped', note: 'Container 23 · Not shipped: Image', dateISO: '2026-09-29' });
  });
  it('a future container date is not shipped yet', () => {
    const e = classifyTrustProject(project([item({ status: 'ORDERED', containerNo: 'CONTAINER 27', containerDate: '2026-11-15T00:00:00.000Z' })]), TODAY);
    expect(e.stage).toBe('in_production');
  });
  it('a container number without a date is not shipped', () => {
    expect(classifyTrustProject(project([item({ status: 'ORDERED', containerNo: 'CONTAINER 27' })]), TODAY).stage).toBe('in_production');
  });
});
