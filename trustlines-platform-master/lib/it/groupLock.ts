// IT item grouping ("Add to Set") is locked behind a password on top of edit.it. The password is
// checked on the server only: IT_GROUP_PASSWORD when set, otherwise the default chosen by the
// business (stored here as its SHA-256 only). A correct password gives a signed, httpOnly cookie
// for 30 minutes, bound to the user; every group change checks it again.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { deriveSecret } from '@/lib/crypto/secrets';

export const GROUP_COOKIE = 'it_group_unlock';
export const GROUP_UNLOCK_SECONDS = 30 * 60;

const DEFAULT_PASSWORD_SHA256 = 'd34115b61acb7d6e14be460183068ef3b292fd734ce9408a84150a4b6d616294';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

export function groupPasswordOk(input: unknown): boolean {
  if (typeof input !== 'string' || !input || input.length > 200) return false;
  const env = process.env.IT_GROUP_PASSWORD?.trim();
  const want = env ? sha256(env) : Buffer.from(DEFAULT_PASSWORD_SHA256, 'hex');
  return timingSafeEqual(sha256(input), want);
}

function secret(): string | null {
  try { return deriveSecret('it-group-unlock'); } catch { return null; }
}

const sign = (key: string, userId: string, exp: number) =>
  createHmac('sha256', key).update(`${userId}.${exp}`).digest('base64url');

/** Cookie value for `userId`, valid GROUP_UNLOCK_SECONDS from `now`; null without APP_ENCRYPTION_KEY. */
export function makeGroupToken(userId: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + GROUP_UNLOCK_SECONDS;
  return `${exp}.${sign(key, userId, exp)}`;
}

export function groupTokenOk(token: string | undefined, userId: string, now = Date.now()): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !sig || exp < Math.floor(now / 1000)) return false;
  const key = secret();
  if (!key) return false;
  const want = Buffer.from(sign(key, userId, exp));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}
