import { describe, expect, it } from 'vitest';
import { TR_HOLIDAYS, holidayEvents, holidaysOn } from '@/components/platform/hr/holidays';

describe('Turkey public holidays', () => {
  it('has the Diyanet feast dates for 2026', () => {
    expect(holidaysOn('2026-03-20')).toEqual(['Ramadan Feast · Day 1']);
    expect(holidaysOn('2026-05-27')).toEqual(['Sacrifice Feast · Day 1']);
    expect(holidaysOn('2026-05-26')).toEqual(['Sacrifice Feast Eve (half day)']);
  });

  it('has the fixed national days every year through 2036', () => {
    for (let y = 2026; y <= 2036; y++) {
      for (const md of ['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29']) {
        expect(holidaysOn(`${y}-${md}`).length).toBeGreaterThan(0);
      }
    }
  });

  it('has 3 Ramadan and 4 Sacrifice feast days a year', () => {
    const y2027 = TR_HOLIDAYS.filter(([d]) => d.startsWith('2027-'));
    expect(y2027.filter(([, n]) => n.startsWith('Ramadan Feast ·')).length).toBe(3);
    expect(y2027.filter(([, n]) => n.startsWith('Sacrifice Feast ·')).length).toBe(4);
  });

  it('lists a month as holiday events', () => {
    const oct = holidayEvents(2026, 9);
    expect(oct.map(e => e.date)).toEqual(['2026-10-28', '2026-10-29']);
    expect(oct.every(e => e.kind === 'holiday')).toBe(true);
    expect(holidaysOn('2026-11-11')).toEqual([]);
  });
});
