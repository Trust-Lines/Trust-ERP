// Small fetch helpers for the platform APIs: a timeout on every call, and the platform's own
// error message surfaced (Meta: error.message, Google: error.message, LinkedIn: message).

export class PlatformError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string | number) {
    super(message);
  }
}

const TIMEOUT_MS = 20_000;

function messageOf(body: unknown, status: number): { message: string; code?: string | number } {
  const b = body as { error?: { message?: string; code?: number | string } | string; message?: string; error_description?: string } | null;
  if (b && typeof b.error === 'object' && b.error?.message) return { message: b.error.message, code: b.error.code };
  if (b?.error_description) return { message: b.error_description, code: typeof b.error === 'string' ? b.error : undefined };
  if (b?.message) return { message: b.message };
  return { message: `Request failed (${status})` };
}

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text.slice(0, 300) }; }
  if (!res.ok) {
    const { message, code } = messageOf(body, res.status);
    throw new PlatformError(message, res.status, code);
  }
  return { data: body as T, headers: res.headers };
}

export const getJson = async <T>(url: string, headers?: Record<string, string>) => (await requestJson<T>(url, { headers })).data;

/** POST application/x-www-form-urlencoded (OAuth token endpoints, Meta Graph writes). */
export async function postForm<T>(url: string, params: Record<string, string>, headers?: Record<string, string>): Promise<T> {
  return (await requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
  })).data;
}

export const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();

export const toDay = (iso: string | number | null | undefined): string | null => {
  if (iso === null || iso === undefined || iso === '') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** A post title from its caption: first line, at most 80 characters. */
export function titleFromCaption(caption: string | null | undefined, fallback: string): string {
  const line = (caption ?? '').split('\n').map(s => s.trim()).find(Boolean);
  if (!line) return fallback;
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}
