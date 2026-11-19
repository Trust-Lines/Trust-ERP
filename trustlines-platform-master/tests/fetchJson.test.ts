import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorText, fetchJson, isAccessDenied, sendJson } from '@/lib/client/fetchJson';

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchJson', () => {
  it('returns the parsed body on success and defaults to GET without a body', async () => {
    const f = mockFetch(() => json({ ok: true, n: 2 }));
    await expect(fetchJson<{ n: number }>('/api/x')).resolves.toEqual({ ok: true, n: 2 });
    const init = f.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('sends plain bodies as JSON', async () => {
    const f = mockFetch(() => json({}));
    await fetchJson('/api/x', { method: 'PATCH', body: { a: 1 } });
    const init = f.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends FormData as-is, without a JSON content type', async () => {
    const f = mockFetch(() => json({}));
    const form = new FormData(); form.set('file', 'x');
    await fetchJson('/api/up', { method: 'POST', body: form });
    const init = f.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });

  it('returns {} for an empty or non-JSON success body', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await expect(fetchJson('/api/x', { method: 'DELETE' })).resolves.toEqual({});
  });

  it("throws the server's error message with the status and body", async () => {
    mockFetch(() => json({ error: 'Not your project' }, 403));
    const err = await fetchJson('/api/x').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Not your project');
    expect(err.status).toBe(403);
    expect(err.body).toEqual({ error: 'Not your project' });
    expect(isAccessDenied(err)).toBe(true);
  });

  it("prefers the server's message over errorMessage (same as `b.error ?? 'fallback'`)", async () => {
    mockFetch(() => json({ error: 'Note is too long' }, 400));
    await expect(fetchJson('/api/x', { errorMessage: 'Could not post the note' })).rejects.toThrow('Note is too long');
    // …and errorText at the call site passes it through rather than replacing it with its fallback.
    const err = await fetchJson('/api/x', { errorMessage: 'Could not post the note' }).catch(e => e);
    expect(errorText(err, 'Could not post the note')).toBe('Note is too long');
  });

  it('uses errorMessage when the server error is empty or not a string', async () => {
    mockFetch(() => json({ error: '' }, 400));
    await expect(fetchJson('/api/x', { errorMessage: 'Could not save' })).rejects.toThrow('Could not save');
    mockFetch(() => json({ error: { code: 'X' } }, 400));
    await expect(fetchJson('/api/x', { errorMessage: 'Could not save' })).rejects.toThrow('Could not save');
  });

  it('falls back to errorMessage, then a default, when the server gives no message', async () => {
    mockFetch(() => new Response('<html>boom</html>', { status: 500 }));
    await expect(fetchJson('/api/x', { errorMessage: 'Could not delete' })).rejects.toThrow('Could not delete');
    await expect(fetchJson('/api/x')).rejects.toThrow('Something went wrong — please try again.');
  });

  it('turns a network failure into ApiError status 0', async () => {
    mockFetch(() => { throw new TypeError('Failed to fetch'); });
    const err = await fetchJson('/api/x', { errorMessage: 'Could not post' }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('Could not post');
    expect(isAccessDenied(err)).toBe(false);
  });

  it('lets an abort through unchanged', async () => {
    mockFetch(() => { throw new DOMException('aborted', 'AbortError'); });
    await expect(fetchJson('/api/x')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('sendJson (compat)', () => {
  it('keeps the (url, method, body) form', async () => {
    const f = mockFetch(() => json({ id: '1' }));
    await expect(sendJson<{ id: string }>('/api/x', 'POST', { a: 1 })).resolves.toEqual({ id: '1' });
    expect(f.mock.calls[0][1].method).toBe('POST');
  });
});

describe('errorText', () => {
  it('uses the error message, or the fallback for anything else', () => {
    expect(errorText(new ApiError('Too large', 413))).toBe('Too large');
    expect(errorText('nope', 'Could not save')).toBe('Could not save');
  });
});
