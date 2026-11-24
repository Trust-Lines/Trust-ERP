import { describe, expect, it } from 'vitest';
import { cleanPhoneInput, phoneAccounts, stampPhoneDates, withoutSheetFields, type PhoneLineData } from '@/lib/it/phones';

const U = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-24T10:00:00Z');

describe('phone sheet fields', () => {
  it('takes a staff member or a typed name, never both', () => {
    const staff = cleanPhoneInput({ number: '4753090034', holderId: U, holderName: 'Ignored' }, false);
    if ('error' in staff) throw new Error(staff.error);
    expect(staff.value).toMatchObject({ holder_id: U, holder_name: null });

    const typed = cleanPhoneInput({ number: '4753090034', holderId: '', holderName: '  hesham   alrahwanji ' }, false);
    if ('error' in typed) throw new Error(typed.error);
    expect(typed.value).toMatchObject({ holder_id: null, holder_name: 'hesham alrahwanji' });
  });

  it('reads the plan price, condition and account holder', () => {
    const r = cleanPhoneInput({ number: '4753090034', monthlyCost: '58,1', deviceCondition: 'used', accountHolder: 'TAISSIER ALRAHWANJI', firm: 'T LINES LLC' }, false);
    if ('error' in r) throw new Error(r.error);
    expect(r.value).toMatchObject({ monthly_cost: 58.1, device_condition: 'used', account_holder: 'TAISSIER ALRAHWANJI', firm: 'T LINES LLC' });
    expect(cleanPhoneInput({ number: '4753090034', monthlyCost: 'abc' }, false)).toHaveProperty('error');
    expect(cleanPhoneInput({ number: '4753090034', deviceCondition: 'broken' }, false)).toHaveProperty('error');
    expect(withoutSheetFields(r.value)).not.toHaveProperty('monthly_cost');
  });

  it('dates a typed holder like a staff one', () => {
    expect(stampPhoneDates({ holder_id: null, holder_name: 'Mariam' }, { holder_id: null, holder_name: null, device_name: null }, NOW))
      .toEqual({ holder_since: '2026-11-24' });
    expect(stampPhoneDates({ holder_id: null, holder_name: 'mariam' }, { holder_id: null, holder_name: 'Mariam', device_name: null }, NOW))
      .toEqual({});
  });

  it('lists each carrier account once, preferring a line with the number saved', () => {
    const line = (id: string, saved: boolean): PhoneLineData => ({
      id, number: '1', carrier: 'T-Mobile', firm: 'T LINES LLC', holderId: null, holderName: null, holderRole: null, holderSince: null,
      deviceName: null, personalDevice: true, deviceAssignedAt: null, deviceCondition: null, email: null, imei: null, location: 'Turkey',
      startDate: null, notes: null, accountHolder: 'TAISSIER ALRAHWANJI', monthlyCost: 66, active: true, createdAt: '',
      hasSecret: { password: false, pin: false, accountNumber: saved },
    });
    const accounts = phoneAccounts([line('a', false), line('b', true), line('c', true)]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ lineId: 'b', hasAccountNumber: true, location: 'Turkey' });
  });
});
