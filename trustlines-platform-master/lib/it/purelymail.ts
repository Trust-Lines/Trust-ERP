// Purelymail (company mail host) — server-side only: list mailboxes, list domains, create a
// mailbox, change a mailbox password.
//
// API (spec: https://news.purelymail.com/api/index.html → swagger-spec.js, "Purelymail API" 0.0.1):
//   every call is  POST https://purelymail.com/api/v0/<op>   header Purelymail-Api-Token: <key>
//   listUser    {}                                              → result.users: string[] (≤ 1000)
//   listDomains { includeShared }                               → result.domains: { name, isShared, … }[]
//   createUser  { userName (local part), domainName, password, enablePasswordReset, recoveryEmail?, … } → {}
//   modifyUser  { userName (full address), newPassword }        → {}
// Errors come back as HTTP 200 too, with { type: 'error', code, message } (seen live with no token:
// code 'invalidToken') — so the body's `type` decides, not the status.
//
// The key is read from PURELYMAIL_API_KEY here only. It, the auth header, passwords and the
// provider's raw error text never go to logs or to the browser: callers get a reason (and the
// provider's short error code), logs get a short tag.

const BASE = 'https://purelymail.com/api/v0';
const TIMEOUT_MS = 10_000;

export type PurelymailFailure = { ok: false; reason: 'not_configured' | 'unauthorized' | 'unavailable' | 'rejected'; code?: string };
export type PurelymailListResult = { ok: true; addresses: string[] } | PurelymailFailure;

/** The configured key, or null when it's missing / blank. */
export function purelymailKey(): string | null {
  const k = process.env.PURELYMAIL_API_KEY?.trim();
  return k ? k : null;
}

async function call(op: string, payload: Record<string, unknown>, fetchImpl: typeof fetch): Promise<{ ok: true; result: Record<string, unknown> } | PurelymailFailure> {
  const key = purelymailKey();
  if (!key) return { ok: false, reason: 'not_configured' };

  let res: Response;
  try {
    res = await fetchImpl(`${BASE}/${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Purelymail-Api-Token': key },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[purelymail] ${op}: request failed`, e instanceof Error && e.name === 'TimeoutError' ? '(timeout)' : '(network)');
    return { ok: false, reason: 'unavailable' };
  }

  const body = await res.json().catch(() => null) as { type?: string; code?: unknown; result?: unknown } | null;
  if (!res.ok || !body) {
    console.error(`[purelymail] ${op}: HTTP`, res.status);
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'unauthorized' : 'unavailable' };
  }
  if (body.type === 'error') {
    // Only the provider's short code is logged / returned (e.g. invalidToken), never its message.
    const code = typeof body.code === 'string' ? body.code.replace(/[^\w.-]/g, '').slice(0, 40) || 'unknown' : 'unknown';
    console.error(`[purelymail] ${op}: error`, code);
    return /token|permission/i.test(code) ? { ok: false, reason: 'unauthorized', code } : { ok: false, reason: 'rejected', code };
  }
  if (!body.result || typeof body.result !== 'object') {
    console.error(`[purelymail] ${op}: unexpected response shape`);
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, result: body.result as Record<string, unknown> };
}

export async function listPurelymailMailboxes(fetchImpl: typeof fetch = fetch): Promise<PurelymailListResult> {
  const r = await call('listUser', {}, fetchImpl);
  if (!r.ok) return r.reason === 'rejected' ? { ok: false, reason: 'unavailable', code: r.code } : r;
  const users = r.result.users;
  if (!Array.isArray(users)) {
    console.error('[purelymail] listUser: unexpected response shape');
    return { ok: false, reason: 'unavailable' };
  }
  const addresses = [...new Set(users.filter((u): u is string => typeof u === 'string').map(u => u.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  return { ok: true, addresses };
}

/** The account's own domains (not Purelymail's shared ones) — where new mailboxes can go. */
export async function listPurelymailDomains(fetchImpl: typeof fetch = fetch): Promise<{ ok: true; domains: string[] } | PurelymailFailure> {
  const r = await call('listDomains', { includeShared: false }, fetchImpl);
  if (!r.ok) return r;
  const list = Array.isArray(r.result.domains) ? r.result.domains as { name?: unknown; isShared?: unknown }[] : null;
  if (!list) return { ok: false, reason: 'unavailable' };
  return { ok: true, domains: list.filter(d => typeof d.name === 'string' && d.isShared !== true).map(d => d.name as string).sort() };
}

export async function createPurelymailMailbox(input: { userName: string; domainName: string; password: string; recoveryEmail: string | null }, fetchImpl: typeof fetch = fetch): Promise<{ ok: true } | PurelymailFailure> {
  const r = await call('createUser', {
    userName: input.userName,
    domainName: input.domainName,
    password: input.password,
    // Self-service reset only when there's somewhere to send it.
    enablePasswordReset: !!input.recoveryEmail,
    ...(input.recoveryEmail ? { recoveryEmail: input.recoveryEmail, recoveryEmailDescription: 'Set by IT' } : {}),
  }, fetchImpl);
  return r.ok ? { ok: true } : r;
}

export async function changePurelymailPassword(address: string, newPassword: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true } | PurelymailFailure> {
  const r = await call('modifyUser', { userName: address, newPassword }, fetchImpl);
  return r.ok ? { ok: true } : r;
}

// ── Input checks (shared by the routes) ──
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;
const DOMAIN = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 12;

export function passwordError(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for the password`;
  if (p.length > 128) return 'The password is too long (max 128 characters)';
  return null;
}

export function cleanNewMailbox(raw: unknown): { value: { userName: string; domainName: string; password: string; recoveryEmail: string | null } } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const userName = typeof b.userName === 'string' ? b.userName.trim().toLowerCase() : '';
  const domainName = typeof b.domainName === 'string' ? b.domainName.trim().toLowerCase() : '';
  const recovery = typeof b.recoveryEmail === 'string' ? b.recoveryEmail.trim() : '';
  if (!LOCAL_PART.test(userName)) return { error: 'Enter the part before @ — letters, numbers, dots, dashes' };
  if (!DOMAIN.test(domainName)) return { error: 'Pick the domain' };
  const pw = passwordError(b.password);
  if (pw) return { error: pw };
  if (recovery && !EMAIL.test(recovery)) return { error: 'The recovery email isn’t a valid address' };
  return { value: { userName, domainName, password: b.password as string, recoveryEmail: recovery || null } };
}

export function isMailboxAddress(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL.test(v);
}
