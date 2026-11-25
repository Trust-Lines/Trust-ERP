import { describe, expect, it } from 'vitest';
import { duplicateRows } from '@/lib/it/duplicateItem';
import type { ItemRow } from '@/lib/it/server';

const source: ItemRow = {
  id: '11111111-1111-1111-1111-111111111111', name: 'Samsung A18', model: 'A18', category: 'phone', location: 'Istanbul',
  status: 'assigned', assignee_id: '22222222-2222-2222-2222-222222222222', assigned_at: '2026-11-01T00:00:00Z',
  set_label: 'Desk 3', notes: 'Silver', specs: { cpu: 'x' }, remote_address: 'pc-1',
  image_path: '/it/items/a.jpg', image_updated_at: '2026-11-01T00:00:00Z',
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
};

describe('duplicateRows', () => {
  it('keeps what describes the item, photo included', () => {
    const [row] = duplicateRows(source, 1, 'me', '2026-11-25T00:00:00Z');
    expect(row).toMatchObject({ name: 'Samsung A18', model: 'A18', category: 'phone', location: 'Istanbul', notes: 'Silver', specs: { cpu: 'x' }, image_path: '/it/items/a.jpg', created_by: 'me' });
  });

  it('starts each copy available, with no holder, set or remote address', () => {
    const rows = duplicateRows(source, 3, 'me', '2026-11-25T00:00:00Z');
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).toMatchObject({ status: 'available', assignee_id: null, assigned_at: null, set_label: null, remote_address: null });
  });

  it('has no photo time without a photo', () => {
    expect(duplicateRows({ ...source, image_path: null }, 1, 'me', 'now')[0].image_updated_at).toBeNull();
  });
});
