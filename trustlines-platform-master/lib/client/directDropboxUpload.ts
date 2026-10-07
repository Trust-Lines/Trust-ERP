// Browser-only. Uploads an ORIGINAL (uncompressed) image straight to Dropbox through a one-shot
// link issued by the notes route (see lib/marketing/directUpload.ts), so the ~4.5 MB serverless
// body cap never applies. Returns the stored Dropbox path, or null on ANY problem — callers must
// then fall back to the classic multipart upload. Never throws.
export async function uploadImageDirect(notesUrl: string, file: File): Promise<string | null> {
  try {
    const linkRes = await fetch(notesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload-link', fileName: file.name }),
    });
    if (!linkRes.ok) return null;
    const { link } = await linkRes.json().catch(() => ({} as { link?: string }));
    if (typeof link !== 'string' || !link.startsWith('https://')) return null;

    // First the documented content type; if the browser's CORS preflight rejects it the request
    // never left the device (so the one-shot link is still unused) — retry with Dropbox's
    // "no preflight" content type, which the server treats as the same raw bytes.
    for (const contentType of ['application/octet-stream', 'text/plain; charset=dropbox-cors-hack']) {
      try {
        const up = await fetch(link, { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
        if (!up.ok) return null;
        const meta = await up.json().catch(() => null) as { path_lower?: string } | null;
        return typeof meta?.path_lower === 'string' ? meta.path_lower : null;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}
