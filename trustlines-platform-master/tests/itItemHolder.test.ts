import { describe, expect, it } from 'vitest';
import { holderOf, itemHolderPatch, lineHolderPatch } from '@/lib/it/itemHolder';
import { cleanItemInput } from '@/lib/it/validate';

const ACC = '22222222-2222-2222-2222-222222222222';
const NOW = '2026-11-25T10:00:00.000Z';

describe('holderOf', () => {
  it('prefers the account and ignores blank names', () => {
    expect(holderOf(ACC, 'Dana')).toEqual({ id: ACC, name: null });
    expect(holderOf(null, '  Dana ')).toEqual({ id: null, name: 'Dana' });
    expect(holderOf(null, '  ')).toEqual({ id: null, name: null });
  });
});

describe('itemHolderPatch', () => {
  it('assigns an available phone to the line’s typed name', () => {
    expect(itemHolderPatch({ status: 'available', assignee_id: null }, { id: null, name: 'Dana' }, NOW))
      .toEqual({ status: 'assigned', assignee_id: null, holder_name: 'Dana', assigned_at: NOW, updated_at: NOW });
  });
  it('changes nothing when the holder is the same', () => {
    expect(itemHolderPatch({ status: 'assigned', assignee_id: ACC, holder_name: null }, { id: ACC, name: null }, NOW)).toBeNull();
  });
  it('frees an assigned item when nobody holds the line', () => {
    expect(itemHolderPatch({ status: 'assigned', assignee_id: null, holder_name: 'Dana' }, { id: null, name: null }, NOW))
      .toMatchObject({ status: 'available', assignee_id: null, holder_name: null });
  });
  it('leaves an item in repair alone when nobody holds the line', () => {
    expect(itemHolderPatch({ status: 'repair', assignee_id: null }, { id: null, name: null }, NOW)).toBeNull();
  });
});

describe('lineHolderPatch', () => {
  it('moves the line to the item’s holder, dated today', () => {
    expect(lineHolderPatch({ holder_id: null, holder_name: 'Old' }, { id: ACC, name: null }, '2026-11-25'))
      .toEqual({ holder_id: ACC, holder_name: null, holder_since: '2026-11-25' });
  });
  it('is null when they already match', () => {
    expect(lineHolderPatch({ holder_id: null, holder_name: 'Dana' }, { id: null, name: 'Dana' }, '2026-11-25')).toBeNull();
  });
});

describe('cleanItemInput holder', () => {
  const base = { name: 'Samsung A18', category: 'phone', status: 'assigned' };
  it('takes a typed name when there is no account', () => {
    expect(cleanItemInput({ ...base, holderName: 'Dana' }).value).toMatchObject({ assignee_id: null, holder_name: 'Dana' });
  });
  it('takes the account over a typed name', () => {
    expect(cleanItemInput({ ...base, assigneeId: ACC, holderName: 'Dana' }).value).toMatchObject({ assignee_id: ACC, holder_name: null });
  });
  it('needs one of them', () => {
    expect(cleanItemInput(base).value).toBeNull();
  });
});
