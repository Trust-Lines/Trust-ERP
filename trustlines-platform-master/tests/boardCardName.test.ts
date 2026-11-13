import { describe, expect, it } from 'vitest';
import { buildDealNames, sameAddress, type DealName } from '@/lib/board/cardName';

const deal = (over: Partial<DealName>): DealName => ({
  kind: 'opportunity', id: Math.random().toString(36), projectNo: null, projectId: null,
  address: null, brand: null, customer: null, ...over,
});

describe('board card name', () => {
  it('matches addresses by place word or street number, not by state code', () => {
    expect(sameAddress('GROVE ,4787 HWY 42, LOCUST,GA', 'Locust Grove, GA')).toBe(true);
    expect(sameAddress('Marietta, 12 Main St, GA', 'Locust Grove, GA')).toBe(false);
    expect(sameAddress('Tempe, 475 W Guadalupe Rd', '475 W Guadalupe Rd, AZ')).toBe(true);
    expect(sameAddress(null, 'Tempe')).toBe(false);
  });

  it('brand first, then customer name, picked by number and address', () => {
    const n = buildDealNames([
      deal({ projectNo: '311', address: 'Marietta, 12 Main St, GA', customer: 'Victor' }),
      deal({ projectNo: '311', address: 'GROVE ,4787 HWY 42, LOCUST,GA', brand: 'Next Stop', customer: 'Victor' }),
      deal({ projectNo: '436', address: 'Erie,4302 main st, PA', brand: 'N/A', customer: 'Lawrence Park & Go' }),
    ]);
    expect(n.forCard('311', 'Locust Grove, GA')).toBe('Next Stop');
    expect(n.forCard('436', '4302 Main St, Erie PA')).toBe('Lawrence Park & Go');
    expect(n.forCard('311', 'Atlanta, GA')).toBeNull();   // number alone is not enough
  });

  it('a customer name that is just the address is no name; a linked project needs no address', () => {
    const n = buildDealNames([
      deal({ projectNo: '1150', address: 'Marysville, 10008 67th Ave NE,WA', customer: 'Marysville, 10008 67th Ave NE,WA' }),
      deal({ projectNo: '1188', projectId: 'p1', address: 'Tempe', brand: 'VIC' }),
    ]);
    expect(n.forCard('1150', 'Marysville, WA')).toBeNull();
    expect(n.forCard('1188', null, 'p1')).toBe('VIC');
  });
});
