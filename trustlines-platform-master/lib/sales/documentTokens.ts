import { createHash, randomBytes } from 'node:crypto';

// Server-only helpers for estimates / contracts: document numbers, the secure link token and
// the hash that freezes a contract's text at send time.

/** EST-202610-4F2A9C / CTR-202610-…: readable, unique enough with the UNIQUE index catching the rare clash. */
export function documentNumber(prefix: 'EST' | 'CTR', now = new Date()): string {
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${ym}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export const newPublicToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const isPublicToken = (t: string) => /^[A-Za-z0-9_-]{40,64}$/.test(t);

/** What the customer signs, frozen at send time: any later edit would change this hash. */
export function contractContentHash(c: { title: string; terms: string; amount: number; currency: string }): string {
  return createHash('sha256').update(JSON.stringify([c.title, c.terms, Number(c.amount).toFixed(2), c.currency])).digest('hex');
}
