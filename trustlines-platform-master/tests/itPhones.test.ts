import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { auditFields, cleanPhoneInput } from '@/lib/it/phones';
import { decryptToken } from '@/lib/crypto/secrets';

describe('cleanPhoneInput', () => {
  beforeEach(() => { vi.stubEnv('APP_ENCRYPTION_KEY', randomBytes(32).toString('base64')); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('needs a number on create and keeps only known fields', () => {
    expect(cleanPhoneInput({ number: '' }, false)).toEqual({ error: 'Enter the phone number' });
    const r = cleanPhoneInput({ number: ' +1 555 0100 ', carrier: 'T-Mobile', holderId: 'nope', evil: 'x', startDate: '2026-11-20' }, false);
    if ('error' in r) throw new Error(r.error);
    expect(r.value).toMatchObject({ number: '+1 555 0100', carrier: 'T-Mobile', holder_id: null, personal_device: false });
    // Dates are never typed: the server stamps them.
    expect(r.value).not.toHaveProperty('start_date');
    expect(r.value).not.toHaveProperty('evil');
  });

  it('encrypts secrets, clears on empty, keeps when absent (edit)', () => {
    const r = cleanPhoneInput({ password: 'p@ss', pin: '' }, true);
    if ('error' in r) throw new Error(r.error);
    expect(decryptToken(r.value.password_enc as string)).toBe('p@ss');
    expect(r.value.pin_enc).toBeNull();
    expect(r.value).not.toHaveProperty('account_number_enc');
    expect(r.value).not.toHaveProperty('number');
  });

  it('refuses to store secrets without the encryption key', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', '');
    vi.stubEnv('SOCIAL_TOKEN_KEY', '');
    expect(cleanPhoneInput({ number: '5550100', password: 'x' }, false)).toEqual({ error: expect.stringContaining('APP_ENCRYPTION_KEY') });
  });

  it('never puts secret values in the audit form', () => {
    const r = cleanPhoneInput({ number: '5550100', password: 'secret-1', accountNumber: '' }, false);
    if ('error' in r) throw new Error(r.error);
    const a = JSON.stringify(auditFields(r.value));
    expect(a).not.toContain('secret-1');
    expect(a).toContain('"password_enc":"set"');
  });
});

describe('GET /api/it/phones/[id]/secret', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('@/lib/it/server'); vi.doUnmock('@/lib/audit/log'); });

  it('refuses without IT edit rights and reads nothing', async () => {
    const from = vi.fn();
    vi.doMock('@/lib/it/server', () => ({ itApi: vi.fn().mockResolvedValue({ ctx: null, deny: new Response('{}', { status: 403 }) }) }));
    vi.doMock('@/lib/audit/log', () => ({ logAudit: vi.fn() }));
    const { GET } = await import('@/app/api/it/phones/[id]/secret/route');
    const req = { nextUrl: new URL('http://x/?kind=password') } as never;
    const res = await GET(req, { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) });
    expect(res.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
});
