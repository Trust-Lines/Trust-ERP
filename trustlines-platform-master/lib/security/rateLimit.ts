
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RateLimitResult {
  allowed: boolean;
}

export async function checkRateLimit(admin: any, bucketKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const bucketMs = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
    const { data, error } = await admin.rpc('increment_rate_limit', {
      p_bucket_key: bucketKey, p_window_start: windowStart, p_limit: limit,
    });
    if (error) { console.error('[rateLimit] check failed, failing open:', error.message); return { allowed: true }; }
    return { allowed: data === true };
  } catch (e) {
    console.error('[rateLimit] unexpected error, failing open:', e instanceof Error ? e.message : e);
    return { allowed: true };
  }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function hashIp(ip: string): Promise<string> {
  const enc = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
