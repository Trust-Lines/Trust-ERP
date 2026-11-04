// Browser-only. Uploads a file straight to Dropbox through a one-shot link our API issues
// ({ action: 'upload-link', fileName, ...extra } POSTed to `apiUrl`), so the ~4.5 MB serverless
// body cap never applies. Returns the stored Dropbox path; throws with a readable message.
// Over Dropbox's 150 MB one-shot limit the file goes up in 4 MB chunks instead, to the same path
// (app/api/public/design-upload, allowed by the ticket the upload-link step signed).

const ONE_SHOT_MAX = 150 * 1024 * 1024;
const CHUNK = 4 * 1024 * 1024;

export async function uploadViaLink(
  apiUrl: string, file: File, extra: Record<string, unknown> = {},
  opts: { onProgress?: (fraction: number) => void } = {},
): Promise<string> {
  const res = await fetch(apiUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload-link', fileName: file.name, ...extra }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || typeof b.link !== 'string') throw new Error(b.error ?? `Could not start uploading ${file.name}`);

  if (file.size > ONE_SHOT_MAX) {
    if (typeof b.ticket !== 'string') throw new Error(`${file.name} is over 150 MB — this upload can't take files that big`);
    return uploadInChunks(file, b.ticket, opts.onProgress);
  }

  // Documented content type first; if the browser's CORS preflight rejects it the one-shot link is
  // still unused, so retry with Dropbox's no-preflight type.
  for (const contentType of ['application/octet-stream', 'text/plain; charset=dropbox-cors-hack']) {
    try {
      const up = await fetch(b.link, { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
      if (!up.ok) throw new Error(`Dropbox rejected ${file.name}`);
      // A one-shot link's reply is just { "content-hash" } — no path. The API picked the path
      // (a free name, so Dropbox doesn't rename it): that's where the file is.
      const meta = await up.json().catch(() => null) as { path_display?: string; path_lower?: string } | null;
      const path = meta?.path_display ?? meta?.path_lower ?? (typeof b.path === 'string' ? b.path : null);
      if (!path) throw new Error(`Could not upload ${file.name}`);
      return path;
    } catch (e) {
      // The file may be in Dropbox even so (e.g. its reply was lost, then the retry hit the used
      // link). When the API told us where it lands, hand that back — its save step checks it.
      if (contentType.startsWith('text/plain')) {
        if (typeof b.path === 'string') return b.path;
        throw e;
      }
    }
  }
  throw new Error(`Could not upload ${file.name}`);
}

/** 4 MB at a time through our API into one Dropbox upload session; each chunk is retried twice. */
async function uploadInChunks(file: File, ticket: string, onProgress?: (fraction: number) => void): Promise<string> {
  let sessionId = '';
  for (let offset = 0; offset < file.size || offset === 0; offset += CHUNK) {
    const last = offset + CHUNK >= file.size;
    const chunk = file.slice(offset, Math.min(offset + CHUNK, file.size));
    let body: { sessionId?: string; path?: string; error?: string } = {};
    for (let attempt = 0; ; attempt++) {
      const res = await fetch('/api/public/design-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'x-ticket': ticket, 'x-session': sessionId, 'x-offset': String(offset), 'x-last': last ? '1' : '0' },
        body: chunk,
      }).catch(() => null);
      body = res ? await res.json().catch(() => ({})) : { error: 'Network error' };
      if (res?.ok) break;
      if (attempt >= 2 || (res && res.status < 500)) throw new Error(body.error ?? `Could not upload ${file.name}`);
    }
    onProgress?.(Math.min(1, (offset + chunk.size) / file.size));
    if (last) {
      if (!body.path) throw new Error(`Could not upload ${file.name}`);
      return body.path;
    }
    sessionId = body.sessionId ?? sessionId;
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
