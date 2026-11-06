// A signed, short-lived "ticket" for one upload target: the Dropbox path an upload-link step
// picked (lib/design/dropboxDirect → uploadTargetIn), after that route checked who may upload.
// The chunked upload route (app/api/public/design-upload — for files over Dropbox's 150 MB
// one-shot link limit) writes only to the path a valid ticket names, so nobody can choose where
// a file goes. Server-only: signed with a server secret that never reaches the browser.
import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 6 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.UPLOAD_TICKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('No secret to sign upload tickets with');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function signUploadTicket(path: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: path, e: now + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** The ticket's path, or null when it's forged, tampered with or expired. */
export function verifyUploadTicket(ticket: string | null | undefined, now = Date.now()): string | null {
  const [payload, mac] = String(ticket ?? '').split('.');
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload)); const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { p?: string; e?: number };
    if (typeof p !== 'string' || typeof e !== 'number' || e < now || !p.startsWith('/Design/') || p.includes('..')) return null;
    return p;
  } catch { return null; }
}
