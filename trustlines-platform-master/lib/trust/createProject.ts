// Opens a won project in the Trust System (POST /projects) — the same request the Production
// board's "Add project" sends — so the Trust Lines team gets it without retyping it. Its Dropbox
// folders are already made on our side, so none are asked of Trust. Never throws: returns why it
// didn't happen, so closing the deal never fails on the Trust System.
import { loadTrustProjects, trustConnection } from '@/lib/trust/board';

const BUCKETS = new Set(['TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW', 'TLINES_HQ', 'TLINES_TC']);

export async function createTrustProject(p: {
  region: string; projectNo: number; name: string; address: string; types: string[];
}): Promise<{ ok: true; existed: boolean } | { ok: false; error: string }> {
  if (!BUCKETS.has(p.region)) return { ok: false, error: `region ${p.region} has no Trust System section` };
  const conn = trustConnection();
  if ('error' in conn) return { ok: false, error: `Trust System ${conn.error}` };

  // Already there (e.g. the Trust Lines team added it by hand) — leave it as it is.
  const existing = await loadTrustProjects({ includeDone: true });
  if (existing.projects.some(x => x.projectNo === String(p.projectNo))) return { ok: true, existed: true };

  try {
    const res = await fetch(`${conn.base}/projects`, {
      method: 'POST',
      headers: { 'X-API-Key': conn.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: p.region, projectNo: String(p.projectNo), name: p.name, address: p.address,
        types: [...new Set(p.types.map(t => t.trim().toUpperCase()).filter(Boolean))],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      return { ok: false, error: `Trust System: HTTP ${res.status}${msg ? ` — ${msg}` : ''}` };
    }
    return { ok: true, existed: false };
  } catch (e) {
    return { ok: false, error: `Trust System: ${e instanceof Error ? e.message : String(e)}` };
  }
}
