import { describe, expect, it } from 'vitest';
import { cleanPublicItemEdit } from '@/lib/it/publicItem';

describe('cleanPublicItemEdit', () => {
  it('keeps only the fields a label holder may fill in', () => {
    const r = cleanPublicItemEdit({ name: ' Samsung A18 ', model: '', location: 'Istanbul', notes: 'ok', status: 'assigned', assigneeId: 'x', remoteAddress: 'pc-1' }, 'phone');
    expect(r).toEqual({ value: { name: 'Samsung A18', model: null, location: 'Istanbul', notes: 'ok' } });
  });
  it('adds specs only for computers', () => {
    const r = cleanPublicItemEdit({ name: 'PC 1', specs: { cpu: 'i7', ram: '', evil: 'x' } }, 'pc');
    expect(r).toEqual({ value: { name: 'PC 1', model: null, location: null, notes: null, specs: { cpu: 'i7' } } });
  });
  it('rejects a missing name, an unknown office and long text', () => {
    expect(cleanPublicItemEdit({ name: ' ' }, 'pc')).toHaveProperty('error');
    expect(cleanPublicItemEdit({ name: 'x', location: 'Mars' }, 'pc')).toHaveProperty('error');
    expect(cleanPublicItemEdit({ name: 'x', notes: 'n'.repeat(2001) }, 'pc')).toHaveProperty('error');
  });
});
