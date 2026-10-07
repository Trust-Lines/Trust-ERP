import { describe, it, expect } from 'vitest';
import { publicCorsHeaders } from '@/lib/security/publicCors';

describe('publicCorsHeaders', () => {
  it.each(['https://tlines.us', 'https://www.tlines.us', 'https://sm.tlines.us'])('allows %s', origin => {
    const h = publicCorsHeaders(origin) as Record<string, string>;
    expect(h['Access-Control-Allow-Origin']).toBe(origin);
  });

  it('does not allow other origins or lookalikes', () => {
    for (const origin of ['https://evil.example', 'https://tlines.us.evil.example', 'http://tlines.us', null]) {
      const h = publicCorsHeaders(origin) as Record<string, string>;
      expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    }
  });
});
