import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// Secrets the app has to store — social platform tokens, each person's SMTP password — are
// encrypted with AES-256-GCM. The key is APP_ENCRYPTION_KEY (SOCIAL_TOKEN_KEY still accepted,
// its first name): 32 random bytes, base64 — e.g. `openssl rand -base64 32`. It only lives in
// the environment, so a database dump alone never exposes a token or a mailbox password.

const PREFIX = 'v1';

function key(): Buffer {
  const raw = (process.env.APP_ENCRYPTION_KEY || process.env.SOCIAL_TOKEN_KEY)?.trim();
  if (!raw) throw new Error('APP_ENCRYPTION_KEY is not set');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return k;
}

export function tokenKeyConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decryptToken(stored: string): string {
  const [prefix, iv, tag, ct] = stored.split(':');
  if (prefix !== PREFIX || !iv || !tag || !ct) throw new Error('Stored token is not in a known format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

/** A separate key for one purpose (e.g. signing email click links), derived from the main key. */
export function deriveSecret(purpose: string): string {
  return createHmac('sha256', key()).update(`trustlines:${purpose}`).digest('base64url');
}
