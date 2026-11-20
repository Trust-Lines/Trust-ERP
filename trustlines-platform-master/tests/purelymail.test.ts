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
    expect(await listPurelymailMailboxes(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unauthorized', code: 'invalidToken' });
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

describe('create mailbox / change password (service)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.stubEnv('PURELYMAIL_API_KEY', KEY); });

  it('creates with the documented body; reset only with a recovery email', async () => {
    const { createPurelymailMailbox } = await import('@/lib/it/purelymail');
    const fetchMock = vi.fn().mockResolvedValue(json({ type: 'success', result: {} }));
    expect(await createPurelymailMailbox({ userName: 'ali', domainName: 'trust.com', password: 'x'.repeat(12), recoveryEmail: null }, fetchMock as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://purelymail.com/api/v0/createUser');
    expect(JSON.parse(init.body)).toEqual({ userName: 'ali', domainName: 'trust.com', password: 'x'.repeat(12), enablePasswordReset: false });
  });

  it('passes Purelymail refusals back as rejected with only the short code', async () => {
    const { changePurelymailPassword } = await import('@/lib/it/purelymail');
    const fetchMock = vi.fn().mockResolvedValue(json({ type: 'error', code: 'passwordTooWeak', message: 'long provider text' }));
    expect(await changePurelymailPassword('ali@trust.com', 'y'.repeat(12), fetchMock as unknown as typeof fetch))
      .toEqual({ ok: false, reason: 'rejected', code: 'passwordTooWeak' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://purelymail.com/api/v0/modifyUser');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ userName: 'ali@trust.com', newPassword: 'y'.repeat(12) });
  });

  it('validates new mailbox input', async () => {
    const { cleanNewMailbox } = await import('@/lib/it/purelymail');
    expect('error' in cleanNewMailbox({ userName: 'a b', domainName: 'trust.com', password: 'x'.repeat(12) })).toBe(true);
    expect('error' in cleanNewMailbox({ userName: 'ali', domainName: 'trust.com', password: 'short' })).toBe(true);
    expect(cleanNewMailbox({ userName: ' Ali.K ', domainName: 'Trust.com', password: 'x'.repeat(12) }))
      .toEqual({ value: { userName: 'ali.k', domainName: 'trust.com', password: 'x'.repeat(12), recoveryEmail: null } });
  });
});

describe('POST create / password routes', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('@/lib/it/server'); vi.doUnmock('@/lib/it/purelymail'); vi.doUnmock('@/lib/audit/log'); });

  async function setup(allowed: boolean, result: unknown) {
    const create = vi.fn().mockResolvedValue(result);
    const change = vi.fn().mockResolvedValue(result);
    const audit = vi.fn();
    vi.doMock('@/lib/it/server', () => ({
      itApi: vi.fn().mockResolvedValue(allowed
        ? { ctx: { userId: 'u1' }, deny: null }
        : { ctx: null, deny: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) }),
    }));
    vi.doMock('@/lib/audit/log', () => ({ logAudit: audit }));
    vi.doMock('@/lib/it/purelymail', async () => ({ ...(await vi.importActual<object>('@/lib/it/purelymail')), createPurelymailMailbox: create, changePurelymailPassword: change }));
    const createRoute = await import('@/app/api/it/mails/purelymail/route');
    const pwRoute = await import('@/app/api/it/mails/purelymail/password/route');
    return { create, change, audit, createRoute, pwRoute };
  }
  const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;

  it('refuses without IT edit rights and never calls Purelymail', async () => {
    const { create, change, createRoute, pwRoute } = await setup(false, { ok: true });
    expect((await createRoute.POST(req({ userName: 'ali', domainName: 'trust.com', password: 'x'.repeat(12) }))).status).toBe(403);
    expect((await pwRoute.POST(req({ address: 'ali@trust.com', newPassword: 'x'.repeat(12) }))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('creates (201) and audits without the password', async () => {
    const { audit, createRoute } = await setup(true, { ok: true });
    const res = await createRoute.POST(req({ userName: 'ali', domainName: 'trust.com', password: 'secret-pass-123' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ address: 'ali@trust.com' });
    expect(JSON.stringify(audit.mock.calls)).not.toContain('secret-pass-123');
  });

  it('answers 422 with the provider code when Purelymail refuses, 400 on a weak password', async () => {
    const { pwRoute, change } = await setup(true, { ok: false, reason: 'rejected', code: 'userNotFound' });
    const res = await pwRoute.POST(req({ address: 'ali@trust.com', newPassword: 'x'.repeat(12) }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ code: 'rejected', providerCode: 'userNotFound' });
    expect((await pwRoute.POST(req({ address: 'ali@trust.com', newPassword: 'short' }))).status).toBe(400);
    expect(change).toHaveBeenCalledTimes(1);
  });
});
