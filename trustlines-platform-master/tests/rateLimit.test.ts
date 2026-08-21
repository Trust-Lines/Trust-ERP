import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit } from '@/lib/security/rateLimit';

describe('checkRateLimit', () => {
  it('allows the request when increment_rate_limit returns true', async () => {
    const admin = { rpc: vi.fn(async () => ({ data: true, error: null })) };
    const result = await checkRateLimit(admin, 'submit:abc', 10, 300);
    expect(result.allowed).toBe(true);
    expect(admin.rpc).toHaveBeenCalledWith('increment_rate_limit', expect.objectContaining({ p_bucket_key: 'submit:abc', p_limit: 10 }));
  });

  it('denies the request when increment_rate_limit returns false (over limit)', async () => {
    const admin = { rpc: vi.fn(async () => ({ data: false, error: null })) };
    const result = await checkRateLimit(admin, 'submit:abc', 10, 300);
    expect(result.allowed).toBe(false);
  });

  it('fails OPEN (allows) when the DB call errors — a broken limiter must never block real visitors', async () => {
    const admin = { rpc: vi.fn(async () => ({ data: null, error: { message: 'db down' } })) };
    const result = await checkRateLimit(admin, 'submit:abc', 10, 300);
    expect(result.allowed).toBe(true);
  });

  it('fails OPEN when the RPC call throws', async () => {
    const admin = { rpc: vi.fn(async () => { throw new Error('network error'); }) };
    const result = await checkRateLimit(admin, 'submit:abc', 10, 300);
    expect(result.allowed).toBe(true);
  });
});
