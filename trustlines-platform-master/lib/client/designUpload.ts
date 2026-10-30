// Browser-only. Uploads a file straight to Dropbox through a one-shot link our API issues
// ({ action: 'upload-link', fileName, ...extra } POSTed to `apiUrl`), so the ~4.5 MB serverless
// body cap never applies. Returns the stored Dropbox path; throws with a readable message.
export async function uploadViaLink(apiUrl: string, file: File, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch(apiUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload-link', fileName: file.name, ...extra }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || typeof b.link !== 'string') throw new Error(b.error ?? `Could not start uploading ${file.name}`);

  // Documented content type first; if the browser's CORS preflight rejects it the one-shot link is
  // still unused, so retry with Dropbox's no-preflight type.
  for (const contentType of ['application/octet-stream', 'text/plain; charset=dropbox-cors-hack']) {
    try {
      const up = await fetch(b.link, { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
      if (!up.ok) throw new Error(`Dropbox rejected ${file.name}`);
      const meta = await up.json().catch(() => null) as { path_display?: string; path_lower?: string } | null;
      const path = meta?.path_display ?? meta?.path_lower;
      if (!path) throw new Error(`Could not upload ${file.name}`);
      return path;
    } catch (e) {
      if (contentType.startsWith('text/plain')) throw e;
    }
  }
  throw new Error(`Could not upload ${file.name}`);
}

/** Opens a link fetched asynchronously without the popup blocker eating it. */
export async function openFetchedLink(fetchLink: () => Promise<string | null>): Promise<void> {
  const win = window.open('', '_blank');
  const link = await fetchLink().catch(() => null);
  if (!link) { win?.close(); return; }
  if (win) win.location.href = link; else window.open(link, '_blank', 'noopener,noreferrer');
}
