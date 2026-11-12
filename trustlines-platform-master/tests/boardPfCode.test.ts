import { describe, expect, it } from 'vitest';
import { computeBoardPfCode, fixedMillworkSlot, pfOwnerForCase, pfOwnerForProject } from '@/lib/production/pfCode';

const base = { fixedMillwork: false, owner: '440', type: 'Millwork', siblingCodes: [] as string[] };

describe('production tracker PF codes (Trust System rules)', () => {
  it('normal vendor: next free number for vendor + project + letter', () => {
    expect(computeBoardPfCode({ ...base, vendorCode: 'KYA' })).toBe('KYA-440-M01');
    expect(computeBoardPfCode({ ...base, vendorCode: 'KYA', siblingCodes: ['KYA-440-M01'] })).toBe('KYA-440-M02');
    // A deleted M02 holds no number (only live siblings are passed in).
    expect(computeBoardPfCode({ ...base, vendorCode: 'KYA', siblingCodes: ['KYA-440-M01', 'KYA-440-M03'] })).toBe('KYA-440-M02');
    expect(computeBoardPfCode({ ...base, vendorCode: 'MKR', type: 'Image', siblingCodes: ['MKR-440-I01'] })).toBe('MKR-440-I02');
  });

  it('fixed-code vendor Millwork follows the order type; others start at M04', () => {
    const ysm = { ...base, vendorCode: 'YSM', fixedMillwork: true };
    expect(computeBoardPfCode({ ...ysm, orderType: 'STANDARD / BASIC' })).toBe('YSM-440-M01');
    expect(computeBoardPfCode({ ...ysm, orderType: 'CUSTOM / SELECTIVE' })).toBe('YSM-440-M03');
    expect(computeBoardPfCode({ ...ysm, orderType: 'selective/custom' })).toBe('YSM-440-M03');
    expect(computeBoardPfCode({ ...ysm, orderType: 'IMAGE' })).toBe('YSM-440-M04');
    expect(computeBoardPfCode({ ...ysm, orderType: null, siblingCodes: ['YSM-440-M04'] })).toBe('YSM-440-M05');
    // Two rows with the same order type share the code.
    expect(computeBoardPfCode({ ...ysm, orderType: 'STANDARD / BASIC', siblingCodes: ['YSM-440-M01'] })).toBe('YSM-440-M01');
    expect(fixedMillworkSlot('STANDARD / SELECTIVE')).toBe(2);
  });

  it('FURNITURE in a Millwork order type gives F, any vendor', () => {
    expect(computeBoardPfCode({ ...base, owner: '409', vendorCode: 'KYA', orderType: 'FURNITURE' })).toBe('KYA-409-F01');
    expect(computeBoardPfCode({ ...base, owner: '409', vendorCode: 'YSM', fixedMillwork: true, orderType: 'FURNITURE / CHAIRS', siblingCodes: ['YSM-409-F01'] })).toBe('YSM-409-F02');
  });

  it('custom types use their own code; no vendor, no code', () => {
    expect(computeBoardPfCode({ ...base, type: 'Special lighting', customTypeCode: 'SPECIALLIG', vendorCode: 'MKR' })).toBe('MKR-440-SPECIALLIG01');
    expect(computeBoardPfCode({ ...base, vendorCode: null })).toBeNull();
  });

  it('owners: project number, case code, PDO for direct orders', () => {
    expect(pfOwnerForProject('STNE 440')).toBe('440');
    expect(pfOwnerForProject('STNW 408 MARKET')).toBe('408 MARKET');
    expect(pfOwnerForProject('STNE 440', '440')).toBe('440');
    expect(pfOwnerForCase('missing_extra', '344-EX-1')).toBe('344-EX-1');
    expect(pfOwnerForCase('direct_order', 'DO-07')).toBe('PDO07');
  });
});
