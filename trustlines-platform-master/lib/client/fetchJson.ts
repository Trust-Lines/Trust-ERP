// Browser-side JSON calls to our own API routes: one place for the fetch → parse → check-ok
// boilerplate that was copied across the app as `res.json().catch(() => ({}))`.

/** A failed API call. `status` is the HTTP status, or 0 when the request never got a response. */
export class ApiError extends Error {
  readonly status: number;
  /** The parsed response body (`{}` when it wasn't JSON). */
  readonly body: Record<string, unknown>;
  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_ERROR = 'Something went wrong — please try again.';
const NETWORK_ERROR = 'Network error — check your connection and try again.';

export interface FetchJsonOptions {
  method?: string;
  /** Plain values are sent as JSON. FormData is sent as-is (multipart uploads). */
  body?: unknown;
  /** Shown when the server gives no `error` message, and when the request fails to send. */
  errorMessage?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Calls an API route and returns its parsed JSON body.
 * Throws ApiError on a non-2xx response (message = the server's `error`, else `errorMessage`)
 * and on a network failure (status 0). An empty or non-JSON success body comes back as `{}`.
 */
export async function fetchJson<T = Record<string, unknown>>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { method = 'GET', body, errorMessage, signal, headers } = opts;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const init: RequestInit = {
    method,
    signal,
    headers: body === undefined || isForm ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e; // callers that abort want to see it
    throw new ApiError(errorMessage ?? NETWORK_ERROR, 0);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const serverMessage = typeof data.error === 'string' && data.error ? data.error : null;
    throw new ApiError(serverMessage ?? errorMessage ?? DEFAULT_ERROR, res.status, data);
  }
  return data as T;
}

/** The message to show for any caught error: ApiError's text, another Error's text, or the fallback. */
export function errorText(e: unknown, fallback = DEFAULT_ERROR): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** True when the caller isn't signed in or isn't allowed (401 / 403). */
export const isAccessDenied = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403);

/** The older (url, method, body) form, kept for existing callers. */
export function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return fetchJson<T>(url, { method, body });
}
