import { describe, expect, it } from 'vitest';
import { toProxyUrl } from '@/modules/trust-projects/lib/auth';

// Every request of the moved Trust System page must reach T-ERP's /api/trust proxy.
describe('toProxyUrl', () => {
  it('maps the Trust API paths onto the proxy', () => {
    expect(toProxyUrl('/api/projects?page=1&limit=50')).toBe('/api/trust/projects?page=1&limit=50');
    expect(toProxyUrl('/api/auth/me')).toBe('/api/trust/auth/me');
    expect(toProxyUrl('/api/realtime/config')).toBe('/api/trust/realtime/config');
  });
  it('does not mistake /api/trust-stock for the proxy prefix', () => {
    expect(toProxyUrl('/api/trust-stock/groups')).toBe('/api/trust/trust-stock/groups');
  });
  it('leaves already-proxied and absolute URLs alone', () => {
    expect(toProxyUrl('/api/trust/projects')).toBe('/api/trust/projects');
    expect(toProxyUrl('https://example.com/x')).toBe('https://example.com/x');
  });
});
