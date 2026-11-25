import { describe, expect, it } from 'vitest';
import { cleanItemPhoneNumber, sameNumber } from '@/lib/it/phoneItemLink';

describe('sameNumber', () => {
  it('matches the same digits whatever the formatting', () => {
    expect(sameNumber('+1 (475) 309-0034', '14753090034')).toBe(true);
    expect(sameNumber('475 309 0034', '+1 475-309-0034')).toBe(true);
  });
  it('keeps different numbers apart', () => {
    expect(sameNumber('475 309 0034', '475 309 0035')).toBe(false);
    expect(sameNumber('123', '1234')).toBe(false);
    expect(sameNumber('', '')).toBe(false);
  });
});

describe('cleanItemPhoneNumber', () => {
  it('reads a number, an empty box (unlink) and a missing key (unchanged)', () => {
    expect(cleanItemPhoneNumber('  +1  475 309 0034 ')).toEqual({ value: '+1 475 309 0034' });
    expect(cleanItemPhoneNumber('')).toEqual({ value: null });
    expect(cleanItemPhoneNumber(null)).toEqual({ value: null });
    expect(cleanItemPhoneNumber(undefined)).toEqual({ value: undefined });
  });
  it('rejects bad numbers', () => {
    expect(cleanItemPhoneNumber('ab')).toHaveProperty('error');
    expect(cleanItemPhoneNumber(5)).toHaveProperty('error');
    expect(cleanItemPhoneNumber('1'.repeat(41))).toHaveProperty('error');
  });
});

import { missingColumnMessage, missingColumnName } from '@/lib/it/phones';

describe('missingColumnName / missingColumnMessage', () => {
  it('reads the column from PostgREST and Postgres errors', () => {
    expect(missingColumnName({ message: "Could not find the 'account_holder' column of 'it_phone_lines' in the schema cache" })).toBe('account_holder');
    expect(missingColumnName({ message: 'column it_phone_lines.item_id does not exist' })).toBe('item_id');
    expect(missingColumnName({ message: 'column "holder_name" of relation "it_phone_lines" does not exist' })).toBe('holder_name');
    expect(missingColumnName({ message: 'something else' })).toBeNull();
  });
  it('names the migration that adds the column, not the fallback', () => {
    const m = missingColumnMessage({ message: "Could not find the 'account_holder' column of 'it_phone_lines' in the schema cache" }, '163_it_phone_line_item.sql');
    expect(m).toContain('161_it_phone_sheet_fields.sql');
    expect(m).toContain('account_holder');
    expect(m).toContain("reload schema");
  });
});
