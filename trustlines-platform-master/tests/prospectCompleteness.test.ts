import { describe, it, expect } from 'vitest';
import { computeProspectCompleteness } from '@/lib/marketing/prospectCompleteness';

describe('computeProspectCompleteness', () => {
  it('is 0% for a fully empty prospect', () => {
    const r = computeProspectCompleteness({
      organizationName: null, personName: null, mainEmail: null, mainPhone: null, website: null,
      sourceLabel: null, businessTypes: [], primaryContact: null, location: null,
    });
    expect(r.percent).toBe(0);
    expect(r.filledCount).toBe(0);
  });

  it('is 100% when every tracked field is filled', () => {
    const r = computeProspectCompleteness({
      organizationName: 'Acme', personName: null, mainEmail: 'a@acme.com', mainPhone: '+1 555', website: 'https://acme.com',
      sourceLabel: 'trade_fair', sourceDetail: 'NACS booth 42', businessTypes: ['Jewelry Store'],
      showsAttended: ['NACS 25'],
      primaryContact: {
        title: 'Owner', linkedinUrl: 'https://linkedin.com/x', otherContact: '555-0000',
        company2Phone: '+1 555-0001', whatsapp: true,
      },
      location: { state: 'GA', address: '123 Main St', mailingAddress: 'PO Box 1' },
      xNote: 'met at booth',
    });
    expect(r.percent).toBe(100);
    expect(r.filledCount).toBe(r.totalCount);
  });

  it('never crashes on a null primaryContact/location — just counts those checks as missing', () => {
    const r = computeProspectCompleteness({
      organizationName: 'Acme', personName: null, mainEmail: null, mainPhone: null, website: null,
      sourceLabel: null, businessTypes: [], primaryContact: null, location: null,
    });
    expect(r.checks.find(c => c.key === 'role')?.done).toBe(false);
    expect(r.checks.find(c => c.key === 'state')?.done).toBe(false);
    expect(r.checks.find(c => c.key === 'company')?.done).toBe(true);
  });
});
