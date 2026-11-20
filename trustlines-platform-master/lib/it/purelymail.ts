// Purelymail (company mail host) — server-side only. Step 1: list the account's mailboxes.
//
// API (spec: https://news.purelymail.com/api/index.html → swagger-spec.js, "Purelymail API" 0.0.1):
//   POST https://purelymail.com/api/v0/listUser   header Purelymail-Api-Token: <key>   body {}
//   → { type: 'success', result: { users: string[] } }   (up to 1000 addresses)
// Errors come back as HTTP 200 too, with { type: 'error', code, message } (seen live with no token:
// code 'invalidToken') — so the body's `type` decides, not the status.
//
// The key is read from PURELYMAIL_API_KEY here only. It, the auth header and the provider's raw
// error text never go to logs or to the browser: callers get a reason code, logs get a short tag.

const LIST_USERS_URL = 'https://purelymail.com/api/v0/listUser';
const TIMEOUT_MS = 10_000;

export type PurelymailListResult =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: 'not_configured' | 'unauthorized' | 'unavailable' };

/** The configured key, or null when it's missing / blank. */
export function purelymailKey(): string | null {
  const k = process.env.PURELYMAIL_API_KEY?.trim();
  return k ? k : null;
}

export async function listPurelymailMailboxes(fetchImpl: typeof fetch = fetch): Promise<PurelymailListResult> {
  const key = purelymailKey();
  if (!key) return { ok: false, reason: 'not_configured' };

  let res: Response;
  try {
    res = await fetchImpl(LIST_USERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Purelymail-Api-Token': key },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error('[purelymail] listUser: request failed', e instanceof Error && e.name === 'TimeoutError' ? '(timeout)' : '(network)');
    return { ok: false, reason: 'unavailable' };
  }

  const body = await res.json().catch(() => null) as
    | { type?: string; code?: unknown; result?: { users?: unknown } }
    | null;
  if (!res.ok || !body) {
    console.error('[purelymail] listUser: HTTP', res.status);
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'unauthorized' : 'unavailable' };
  }
  if (body.type === 'error') {
    // Only the provider's short code is logged (e.g. invalidToken), never its message.
    const code = typeof body.code === 'string' ? body.code.slice(0, 40) : 'unknown';
    console.error('[purelymail] listUser: error', code);
    return { ok: false, reason: /token|auth|permission/i.test(code) ? 'unauthorized' : 'unavailable' };
  }
  const users = body.result?.users;
  if (!Array.isArray(users)) {
    console.error('[purelymail] listUser: unexpected response shape');
    return { ok: false, reason: 'unavailable' };
  }
  const addresses = [...new Set(users.filter((u): u is string => typeof u === 'string').map(u => u.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  return { ok: true, addresses };
}
