import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listPurelymailMailboxes } from '@/lib/it/purelymail';

const KEY = 'test-key-not-real';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('listPurelymailMailboxes', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errorLog = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllEnvs(); errorLog.mockRestore(); });

  it('does not call Purelymail without a key', async () => {
    vi.stubEnv('PURELYMAIL_API_KEY', '  ');
    const fetchMock = vi.fn();
    expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists the addresses (POST listUser, token header, empty body), sorted and de-duplicated', async () => {
    vi.stubEnv('PURELYMAIL_API_KEY', KEY);
    const fetchMock = vi.fn().mockResolvedValue(json({ type: 'success', result: { users: ['b@trust.com', 'a@trust.com', 'b@trust.com'] } }));
    expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: true, addresses: ['a@trust.com', 'b@trust.com'] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://purelymail.com/api/v0/listUser');
    expect(init.method).toBe('POST');
    expect(init.headers['Purelymail-Api-Token']).toBe(KEY);
    expect(init.body).toBe('{}');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('treats an empty account as a successful empty list', async () => {
    vi.stubEnv('PURELYMAIL_API_KEY', KEY);
    const fetchMock = vi.fn().mockResolvedValue(json({ type: 'success', result: { users: [] } }));
    expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: true, addresses: [] });
  });

  it('maps a refused token (HTTP 200 + type error) to unauthorized and never logs the key or message', async () => {
    vi.stubEnv('PURELYMAIL_API_KEY', KEY);
    const fetchMock = vi.fn().mockResolvedValue(json({ type: 'error', code: 'invalidToken', message: `secret detail ${KEY}` }));
    expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unauthorized' });
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain('secret detail');
  });

  it('maps network failure, timeout, HTTP errors and odd shapes to unavailable', async () => {
    vi.stubEnv('PURELYMAIL_API_KEY', KEY);
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    for (const fetchMock of [
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      vi.fn().mockRejectedValue(timeout),
      vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 500 })),
      vi.fn().mockResolvedValue(json({ type: 'success', result: {} })),
    ]) {
      expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unavailable' });
    }
  });
});

describe('GET /api/it/mails/purelymail', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('@/lib/it/server'); vi.doUnmock('@/lib/it/purelymail'); });

  async function route(allowed: boolean, result?: unknown) {
    const list = vi.fn().mockResolvedValue(result);
    vi.doMock('@/lib/it/server', () => ({
      itApi: vi.fn().mockResolvedValue(allowed
        ? { ctx: { userId: 'u1' }, deny: null }
        : { ctx: null, deny: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) }),
    }));
    vi.doMock('@/lib/it/purelymail', () => ({ listPurelymailMailboxes: list }));
    const { GET } = await import('@/app/api/it/mails/purelymail/route');
    return { res: await GET(), list };
  }

  it('refuses a user without IT access and never calls Purelymail', async () => {
    const { res, list } = await route(false);
    expect(res.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('returns the mailboxes', async () => {
    const { res } = await route(true, { ok: true, addresses: ['a@trust.com'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mailboxes: [{ address: 'a@trust.com' }] });
  });

  it('says when the key is missing (503) or the provider failed (502)', async () => {
    const missing = await route(true, { ok: false, reason: 'not_configured' });
    expect(missing.res.status).toBe(503);
    expect(await missing.res.json()).toEqual({ code: 'not_configured' });
    vi.resetModules();
    const down = await route(true, { ok: false, reason: 'unavailable' });
    expect(down.res.status).toBe(502);
    expect(await down.res.json()).toEqual({ code: 'unavailable' });
  });
});
