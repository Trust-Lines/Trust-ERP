// Dropbox SDK errors, read the same way everywhere. A DropboxResponseError carries the HTTP status
// and a body that is usually JSON ({ error_summary, error }) but can be plain text (rate limits,
// bad arguments) — so error_summary alone is often empty and the UI showed just "Dropbox:".

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DropboxErrorInfo { status: number | null; summary: string; notFound: boolean; transient: boolean; retryAfterMs: number | null }

export function dropboxErrorInfo(e: unknown): DropboxErrorInfo {
  const err = e as any;
  const status: number | null = typeof err?.status === 'number' ? err.status : null;
  const body = err?.error;
  const summary =
    (typeof body?.error_summary === 'string' && body.error_summary.trim()) ||
    (typeof body === 'string' && body.trim().slice(0, 200)) ||
    (body && typeof body === 'object' && JSON.stringify(body.error ?? body).slice(0, 200)) ||
    (e instanceof Error && e.message) ||
    (status ? `HTTP ${status}` : 'Dropbox error');
  const retryAfter = Number(body?.error?.retry_after ?? err?.headers?.['retry-after'] ?? NaN);
  const notFound = /not_found/.test(summary);
  const transient = status === 429 || (status != null && status >= 500) || /too_many|fetch failed|ECONNRESET|ETIMEDOUT|socket|timeout/i.test(summary);
  return { status, summary, notFound, transient, retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : null };
}

/** A readable one-liner for the UI, in plain words for the common cases. */
export function dropboxErrorMessage(e: unknown): string {
  const i = dropboxErrorInfo(e);
  if (i.status === 429 || /too_many/.test(i.summary)) return 'Dropbox is busy right now (rate limit) — try again in a few seconds';
  if (i.notFound) return 'This folder or file is not in Dropbox';
  return `Dropbox: ${i.summary}`;
}

/** Run a Dropbox call, retrying rate limits and passing network / server errors (3 tries, short waits). */
export async function withDropboxRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      const info = dropboxErrorInfo(e);
      if (!info.transient || i >= tries - 1) throw e;
      await new Promise(r => setTimeout(r, Math.min(info.retryAfterMs ?? 800 * 2 ** i, 5000)));
    }
  }
}
