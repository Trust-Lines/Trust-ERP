import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  emitEvent,
  handleEvent,
  registerHandler,
  handlersFor,
  sanitizeEventPayload,
  buildDedupeKey,
  _resetHandlers,
} from '@/lib/events/bus';
import type { SystemEvent } from '@/lib/events/types';

function fakeAdmin(opts: { failInsert?: boolean } = {}) {
  const rows: any[] = [];
  const updates: any[] = [];

  const client = {
    rows,
    updates,
    from(table: string) {
      if (table !== 'system_events') throw new Error(`unexpected table ${table}`);
      return {
        upsert(row: any, cfg: { onConflict: string; ignoreDuplicates: boolean }) {
          const result = {
            select: () => ({
              maybeSingle: async () => {
                if (opts.failInsert) return { data: null, error: { message: 'relation does not exist' } };
                const clash = rows.some(r => r[cfg.onConflict] === row[cfg.onConflict]);
                if (clash && cfg.ignoreDuplicates) return { data: null, error: null };
                const stored = { id: `evt-${rows.length + 1}`, created_at: '2026-07-14T00:00:00Z', processed_at: null, ...row };
                rows.push(stored);
                return { data: stored, error: null };
              },
            }),
          };
          return result;
        },
        update(patch: any) {
          return {
            eq: async (_col: string, id: string) => {
              updates.push({ id, patch });
              const r = rows.find(x => x.id === id);
              if (r) Object.assign(r, patch);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return client as any;
}

const evt = (over: Partial<SystemEvent> = {}): SystemEvent => ({
  id: 'e1', event_type: 'site.ready', project_id: 'p1', lead_id: null,
  entity_table: 'site_readiness', entity_id: 's1', actor_id: 'u1',
  payload: {}, dedupe_key: 'k', created_at: '2026-07-14T00:00:00Z', processed_at: null,
  ...over,
});

beforeEach(() => _resetHandlers());

describe('sanitizeEventPayload', () => {
  it('strips money and internal-supply keys', () => {
    const clean = sanitizeEventPayload({
      projectCode: 'STW 460',
      typeName: 'Millwork',
      pf_usd: 12345,
      pf_tl: 5,
      pf_code: 'PF-1',
      pf_sign_status: 'SIGNED',
      vendor_price: 999,
      vendor_id: 'v-1',
      unit_price: 10,
      total_cost: 20,
      margin_pct: 30,
      invoice: 40,
      expenses_usd: 50,
      budget_impact: 60,
      amount: 70,
      deal_value: 80,
      payment_rule: '50/50',
    });
    expect(clean).toEqual({ projectCode: 'STW 460', typeName: 'Millwork' });
  });

  it('cleans NESTED objects and arrays — a leak one level down is still a leak', () => {
    const clean = sanitizeEventPayload({
      items: [
        { id: 'a', type: 'Millwork', pf_usd: 100, vendor_id: 'v1' },
        { id: 'b', type: 'Ceiling',  nested: { margin_pct: 20, ok: true } },
      ],
      meta: { deep: { cost: 5, keep: 'yes' } },
    });
    expect(clean).toEqual({
      items: [
        { id: 'a', type: 'Millwork' },
        { id: 'b', type: 'Ceiling', nested: { ok: true } },
      ],
      meta: { deep: { keep: 'yes' } },
    });
    expect(JSON.stringify(clean).toLowerCase()).not.toMatch(/pf|cost|margin|vendor_id/);
  });

  it('keeps innocent keys and handles empty / missing payloads', () => {
    expect(sanitizeEventPayload(undefined)).toEqual({});
    expect(sanitizeEventPayload({})).toEqual({});
    expect(sanitizeEventPayload({ status: 'SENT', count: 3, ready: true, at: null }))
      .toEqual({ status: 'SENT', count: 3, ready: true, at: null });
  });

  it('does not mistake an innocent word for a forbidden one', () => {
    expect(sanitizeEventPayload({ profile_id: 'x', performance: 1 }))
      .toEqual({ profile_id: 'x', performance: 1 });
  });
});

describe('buildDedupeKey', () => {
  it('defaults to one-event-per-transition-per-row', () => {
    expect(buildDedupeKey({ type: 'po.chain_complete', entityTable: 'production_items', entityId: 'i1' }))
      .toBe('po.chain_complete:production_items:i1');
  });

  it('honours an explicit key — A9 needs one reminder per signer per DAY', () => {
    expect(buildDedupeKey({
      type: 'approval.reminder', entityTable: 'document_approvals', entityId: 'a1',
      dedupeKey: 'approval.reminder:a1:2026-07-14',
    })).toBe('approval.reminder:a1:2026-07-14');
  });
});

describe('emitEvent — idempotency', () => {
  it('stores the event once and runs its handlers once', async () => {
    const admin = fakeAdmin();
    const handler = vi.fn(async () => {});
    registerHandler('site.ready', handler);

    const first = await emitEvent(admin, {
      type: 'site.ready', entityTable: 'site_readiness', entityId: 's1', projectId: 'p1',
    });
    expect(first).not.toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(admin.rows).toHaveLength(1);
  });

  it('a SECOND emit of the same event is a complete no-op — no row, NO handler', async () => {
    const admin = fakeAdmin();
    const handler = vi.fn(async () => {});
    registerHandler('site.ready', handler);

    const input = { type: 'site.ready' as const, entityTable: 'site_readiness', entityId: 's1', projectId: 'p1' };
    await emitEvent(admin, input);
    const second = await emitEvent(admin, input);

    expect(second).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(admin.rows).toHaveLength(1);
  });

  it('a different row of the same type is a different event', async () => {
    const admin = fakeAdmin();
    await emitEvent(admin, { type: 'po.chain_complete', entityTable: 'production_items', entityId: 'i1' });
    await emitEvent(admin, { type: 'po.chain_complete', entityTable: 'production_items', entityId: 'i2' });
    expect(admin.rows).toHaveLength(2);
  });

  it('an explicit dedupe key lets the same transition recur on a new day (A9)', async () => {
    const admin = fakeAdmin();
    const handler = vi.fn(async () => {});
    registerHandler('approval.reminder', handler);

    const day = (d: string) => ({
      type: 'approval.reminder' as const, entityTable: 'document_approvals', entityId: 'a1',
      dedupeKey: `approval.reminder:a1:${d}`,
    });
    await emitEvent(admin, day('2026-07-14'));
    await emitEvent(admin, day('2026-07-14'));
    await emitEvent(admin, day('2026-07-15'));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(admin.rows).toHaveLength(2);
  });

  it('marks the event processed after its handlers ran', async () => {
    const admin = fakeAdmin();
    const e = await emitEvent(admin, { type: 'site.ready', entityTable: 'site_readiness', entityId: 's1' });
    expect(admin.updates).toHaveLength(1);
    expect(admin.rows[0].processed_at).toBeTruthy();
    expect(admin.updates[0].id).toBe(e!.id);
  });
});

describe('emitEvent — stored payload', () => {
  it('sanitises before writing, so the row itself can never hold a sensitive value', async () => {
    const admin = fakeAdmin();
    await emitEvent(admin, {
      type: 'po.chain_complete',
      entityTable: 'production_items',
      entityId: 'i1',
      projectId: 'p1',
      payload: { typeName: 'Millwork', pf_usd: 999, vendor_id: 'v9', margin_pct: 10 },
    });
    expect(admin.rows[0].payload).toEqual({ typeName: 'Millwork' });
    expect(JSON.stringify(admin.rows[0]).toLowerCase()).not.toContain('vendor_id');
  });
});

describe('emitEvent — best-effort isolation', () => {
  it('returns null and does not throw when the table is missing (migration not applied)', async () => {
    const admin = fakeAdmin({ failInsert: true });
    const handler = vi.fn(async () => {});
    registerHandler('site.ready', handler);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(emitEvent(admin, { type: 'site.ready', entityTable: 'site_readiness', entityId: 's1' }))
      .resolves.toBeNull();
    expect(handler).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a handler that throws does not stop the others, and never reaches the caller', async () => {
    const admin = fakeAdmin();
    const boom = vi.fn(async () => { throw new Error('mail server down'); });
    const after = vi.fn(async () => {});
    registerHandler('site.ready', boom);
    registerHandler('site.ready', after);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(emitEvent(admin, { type: 'site.ready', entityTable: 'site_readiness', entityId: 's1' }))
      .resolves.not.toBeNull();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(admin.rows[0].processed_at).toBeTruthy();
    spy.mockRestore();
  });

  it('an event with no handlers is stored and simply does nothing', async () => {
    const admin = fakeAdmin();
    await expect(handleEvent(admin, evt({ event_type: 'container.arrived' }))).resolves.toBeUndefined();
    expect(handlersFor('container.arrived')).toEqual([]);
  });
});

describe('registerHandler', () => {
  it('runs handlers in registration order', async () => {
    const order: string[] = [];
    registerHandler('site.ready', async () => { order.push('first'); });
    registerHandler('site.ready', async () => { order.push('second'); });
    await handleEvent(fakeAdmin(), evt({ event_type: 'site.ready' }));
    expect(order).toEqual(['first', 'second']);
  });

  it('scopes handlers to their own event type', async () => {
    const other = vi.fn(async () => {});
    registerHandler('site.ready', other);
    await handleEvent(fakeAdmin(), evt({ event_type: 'lead.closed_won' }));
    expect(other).not.toHaveBeenCalled();
  });
});
