import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLinkInNewTab } from '@/lib/client/openLink';

type FakeWin = { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };

function setup({ link, status = 200, error, popupBlocked = false }: { link?: string; status?: number; error?: string; popupBlocked?: boolean }) {
  const win: FakeWin = { opener: 'parent', location: { href: 'about:blank' }, close: vi.fn() };
  const calls: string[] = [];
  const open = vi.fn((url?: string) => { calls.push(`open:${url}`); return popupBlocked ? null : win; });
  const fetchFn = vi.fn(async () => { calls.push('fetch'); return new Response(JSON.stringify(link ? { link } : { error }), { status }); });
  vi.stubGlobal('window', { open });
  vi.stubGlobal('fetch', fetchFn);
  return { win, open, fetchFn, calls };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('openLinkInNewTab', () => {
  it('opens the tab before the request, without an opener, then points it at the link', async () => {
    const { win, calls } = setup({ link: 'https://dropbox.example/f.pdf' });
    await openLinkInNewTab('/api/files/view?documentId=1');
    expect(calls).toEqual(['open:', 'fetch']); // tab first — still inside the click
    expect(win.opener).toBeNull();
    expect(win.location.href).toBe('https://dropbox.example/f.pdf');
    expect(win.close).not.toHaveBeenCalled();
  });

  it('sends method and body for POST link routes', async () => {
    const { fetchFn } = setup({ link: 'https://x' });
    await openLinkInNewTab({ url: '/api/design-jobs/j/file-link', method: 'POST', body: { source: 'design', id: 'f' } });
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"source":"design","id":"f"}');
  });

  it("closes the blank tab and throws the server's message on failure", async () => {
    const { win } = setup({ status: 403, error: 'Not your project' });
    await expect(openLinkInNewTab('/api/files/view?documentId=1', 'Could not open file')).rejects.toThrow('Not your project');
    expect(win.close).toHaveBeenCalled();
  });

  it('treats a success without a link as a failure', async () => {
    const { win } = setup({ status: 200 });
    await expect(openLinkInNewTab('/api/x', 'Could not open file')).rejects.toThrow('Could not open file');
    expect(win.close).toHaveBeenCalled();
  });

  it('falls back to a direct noopener open when the pop-up was blocked', async () => {
    const { open } = setup({ link: 'https://x/f', popupBlocked: true });
    await openLinkInNewTab('/api/x');
    expect(open).toHaveBeenLastCalledWith('https://x/f', '_blank', 'noopener,noreferrer');
  });
});
