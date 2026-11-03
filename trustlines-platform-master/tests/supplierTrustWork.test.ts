import { describe, expect, it } from 'vitest';
import { vendorWork, type TrustVendorProject } from '@/lib/suppliers/trustWork';

const projects: TrustVendorProject[] = [
  { projectNo: '490', name: 'Southbury', address: null, status: 'PRE_PROJECT', items: [
    { type: 'MILLWORK', pfCode: 'PF-1', status: 'SENT', vendor: { code: 'gos' }, std: '2026-03-01T00:00:00Z', snd: '2026-05-10', pfUsd: 1000, paidUsd1: 400, paidUsd1Date: '2026-04-01', paidUsd2: 100, paidUsd2Date: '2026-05-01' },
    { type: 'IMAGE', pfCode: null, status: 'ORDERED', vendor: { code: 'AKS' }, pfUsd: 50 },
  ] },
  { projectNo: '312', name: 'Erie', address: null, status: 'DONE', items: [
    { type: 'SHELVING', pfCode: 'PF-2', status: 'SENT', vendor: { code: 'GOS' }, std: '2025-11-02', pfTl: 2000, paidTl1: 2000, paidTl1Date: '2025-12-01' },
    { type: 'CEILING', pfCode: 'PF-3', status: 'SENT', vendor: { code: 'GOS' }, deletedAt: '2026-01-01', pfUsd: 999 },
  ] },
];

describe('vendorWork', () => {
  it('collects the vendor’s items across projects (finished ones too), newest first, with totals', () => {
    const w = vendorWork(projects, 'GOS');
    expect(w.rows.map(r => `${r.projectNo} ${r.type}`)).toEqual(['490 MILLWORK', '312 SHELVING']);
    expect(w.projects).toBe(2);
    expect(w.rows[0]).toMatchObject({ paidUsd: 500, lastPaidAt: '2026-05-01', sentAt: '2026-05-10' });
    expect(w.rows[1].projectDone).toBe(true);
    expect(w.totals).toEqual({ pfUsd: 1000, pfTl: 2000, paidUsd: 500, paidTl: 2000, dueUsd: 500, dueTl: 0 });
    expect([w.firstAt, w.lastAt]).toEqual(['2025-11-02', '2026-05-10']);
  });

  it('finds nothing for a supplier without a code', () => {
    expect(vendorWork(projects, null).rows).toEqual([]);
  });

  it('leaves out a mistyped year instead of showing it as the first work date', () => {
    const w = vendorWork([{ projectNo: '1', name: 'X', address: null, status: 'PRE_PROJECT', items: [
      { type: 'MILLWORK', pfCode: null, status: null, vendor: { code: 'GOS' }, std: '0026-12-05', rdy: '2026-02-01' },
    ] }], 'GOS');
    expect([w.rows[0].startedAt, w.firstAt]).toEqual([null, '2026-02-01']);
  });
});
