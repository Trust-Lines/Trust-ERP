import { describe, expect, it } from 'vitest';
import { officeOf, parseImeiCell, parsePhoneWorkbook, parseSectionTitle } from '@/lib/it/phoneSheetImport';

const H = ['USER', 'PHONE', 'NUMBER', 'MAIL', 'PASSWORD', 'PIN', 'IMEI', 'Firm name', 'Account no', 'Location'];

describe('parseSectionTitle', () => {
  it('reads carrier, firm, holder and account', () => {
    expect(parseSectionTitle('T-Mobile T LINES LLC. TAISSIER ALRAHWANJI 977800574')).toEqual({ carrier: 'T-Mobile', firm: 'T LINES LLC', accountHolder: 'TAISSIER ALRAHWANJI', accountNumber: '977800574', kind: 'carrier' });
    expect(parseSectionTitle('T-Mobile T LINES DESIGN SUPPLY AND BUILD 204882958')).toMatchObject({ firm: 'T LINES DESIGN SUPPLY AND BUILD', accountHolder: null, accountNumber: '204882958' });
    expect(parseSectionTitle(' Verizon T LINES LLC. NAIM KABBANI 742683508-00001 login : t@tlines.us password : x')).toMatchObject({ carrier: 'Verizon', accountHolder: 'NAIM KABBANI', accountNumber: '742683508-00001' });
    expect(parseSectionTitle('TLINES Google Numbers')).toMatchObject({ kind: 'google' });
    expect(parseSectionTitle('Trust Lines')).toMatchObject({ kind: 'trustlines', firm: 'TRUST LINES', carrier: 'Turkcell' });
    expect(parseSectionTitle('Alaa AKBİEK')).toBeNull();
  });
});

describe('parseImeiCell / officeOf', () => {
  it('splits the IMEI cell', () => {
    expect(parseImeiCell('Used (T-Mobile 58.1) 357716584828487')).toMatchObject({ imei: '357716584828487', condition: 'used', monthlyCost: '58.10', carrier: 'T-Mobile' });
    expect(parseImeiCell('Used (T-Mobile 65.0.2): 358178373767856')).toMatchObject({ monthlyCost: '65.02', costText: 'T-Mobile 65.0.2' });
    expect(parseImeiCell('T-mobile (66.0) / personal phone')).toMatchObject({ monthlyCost: '66.00', personal: true });
    expect(parseImeiCell('used (Turkcell) 356919950549767 available 358530300549767')).toMatchObject({ imei: '356919950549767', secondImei: '358530300549767', carrier: 'Turkcell' });
    expect(parseImeiCell('Verizon350661231229563').imei).toBe('350661231229563');
  });
  it('maps offices', () => {
    expect(officeOf('Turkey')).toEqual({ location: 'Istanbul' });
    expect(officeOf('USA')).toEqual({ location: 'USA' });
    expect(officeOf('Ridgefield, CT, US')).toEqual({ location: 'USA', note: 'Ridgefield, CT, US' });
  });
});

describe('parsePhoneWorkbook', () => {
  it('reads sections, typed names, phones and computers', () => {
    const { lines, items, warnings } = parsePhoneWorkbook([
      { name: 'Phones', rows: [
        ['Phones and sim cards info'],
        ['T-Mobile T LINES LLC. TAISSIER ALRAHWANJI  977800574'],
        H,
        ['Alaa AKBİEK', 'IPHONE 12', '+1 (475) 309-0034', 'al@tlines.us', '', '000000', 'Used (T-Mobile 58.1)\n357716584828487', 'T LINES LLC\nTAISSIER ALRAHWANJI', '977800574', 'Turkey'],
        ['Mervenur KALAYCI', 'Personal phone', '+1 (475) 281-8431', '', '', '', 'T-mobile (66.0) / personal phone', '', '977800574', 'Turkey'],
        [''],
        ['TLINES Google Numbers'],
        ['USER', 'PHONE', 'NUMBER', 'MAIL', 'LOCATION', 'PIN', 'IMEI', 'Firm name', 'Account no', 'Location'],
        ['Main', 'Google Number', '+1 (201) 800-4317', 'Main', 'New Jersey, US', '', '', '', '', ''],
        ['-', 'Google Number', '+1 (203) 951-5159', '-', 'Connecticut, US'],
        ['Alaa', 'Google Number', '+1 (475) 309-0034', '', ''],
      ] },
      { name: 'Trust', rows: [
        ['Trust Lines'],
        ['USER', 'PHONE', 'NUMBER', 'MAIL', 'PASSWORD', 'PIN', 'imei'],
        ['EMPTY', 'NO PHONE', '+90 538 235 46 37', '', '', '6436', 'Turkcell'],
        ['Riham AYDIN', 'SAMSUNG A16', '+90 538 235 46 32', '', '', '4175', 'used (Turkcell) 356919950549767 available 358530300549767'],
      ] },
      { name: 'Macs', rows: [['User', 'Device Type'], ['Alaa Akbiek', 'mac M4'], ['justin', 'mac NEO']] },
    ]);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatchObject({ holderName: 'Alaa AKBİEK', deviceName: 'iPhone 12', deviceCondition: 'used', imei: '357716584828487', pin: '000000', carrier: 'T-Mobile', firm: 'T LINES LLC', accountHolder: 'TAISSIER ALRAHWANJI', accountNumber: '977800574', monthlyCost: '58.10', location: 'Istanbul' });
    expect(lines[1]).toMatchObject({ personalDevice: true, monthlyCost: '66.00' });
    expect(lines[2]).toMatchObject({ holderName: 'Main', carrier: 'Google Number', firm: 'T LINES LLC', location: 'USA', notes: 'Google Number · New Jersey, US' });
    expect(lines[2].password).toBeUndefined();
    expect(lines[3].holderName).toBeUndefined();
    expect(lines[4]).toMatchObject({ firm: 'TRUST LINES', carrier: 'Turkcell', location: 'Istanbul', pin: '6436', notes: 'EMPTY' });
    expect(lines[4].holderName).toBeUndefined();
    expect(lines[5]).toMatchObject({ holderName: 'Riham AYDIN', deviceName: 'Samsung A16', imei: '356919950549767', notes: 'Second SIM slot free, IMEI 358530300549767' });
    expect(warnings.some(w => w.includes('twice'))).toBe(true);
    expect(items).toEqual([
      { name: 'Mac M4', model: 'M4', category: 'laptop', status: 'available', notes: 'User: Alaa Akbiek' },
      { name: 'Mac NEO', model: 'NEO', category: 'laptop', status: 'available', notes: 'User: justin' },
    ]);
  });
});
