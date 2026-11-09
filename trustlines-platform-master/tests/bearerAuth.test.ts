import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mobile app auth: `Authorization: Bearer <jwt>` must be verified with the Auth server and become
// the session for PostgREST; without it, the cookie session is used exactly as before.
let authHeader: string | null = null;
const getUser = vi.fn();
const createServerClient = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'authorization' ? authHeader : null) }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => { createServerClient(...args); return { auth: { getUser, getClaims: vi.fn(async () => ({ data: null, error: new Error('no cookie') })), getSession: vi.fn(async () => ({ data: { session: null } })) } }; },
}));
vi.mock('@/lib/viewAs', () => ({ withViewAs: (c: unknown) => c }));

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  createServerClient.mockReset();
});

describe('bearer auth (mobile app)', () => {
  it('verifies the bearer token and sends it to PostgREST', async () => {
    authHeader = 'Bearer jwt-abc';
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const { requireUser } = await import('@/lib/supabase/server');
    const res = await requireUser();
    expect(res.user?.id).toBe('u1');
    expect(getUser).toHaveBeenCalledWith('jwt-abc');
    const opts = createServerClient.mock.calls[0][2] as { global?: { headers?: Record<string, string> } };
    expect(opts.global?.headers?.Authorization).toBe('Bearer jwt-abc');
  });

  it('rejects an invalid bearer token with 401', async () => {
    authHeader = 'Bearer forged';
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid JWT') });
    const { requireUser } = await import('@/lib/supabase/server');
    const res = await requireUser();
    expect(res.user).toBeNull();
    expect(res.unauth?.status).toBe(401);
  });

  it('without a bearer token uses the cookie session (no Authorization override)', async () => {
    authHeader = null;
    const { requireUser } = await import('@/lib/supabase/server');
    const res = await requireUser();
    expect(res.user).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
    const opts = createServerClient.mock.calls[0][2] as { global?: unknown };
    expect(opts.global).toBeUndefined();
  });
});
