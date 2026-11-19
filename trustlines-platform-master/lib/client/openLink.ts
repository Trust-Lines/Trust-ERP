// Opening a file through a temporary link from our API (Dropbox): ask the route for `{ link }`,
// then show it in a new tab.

import { ApiError, fetchJson } from './fetchJson';

/** A GET url, or a url with method/body (e.g. POST /api/design-jobs/:id/file-link). */
export type LinkRequest = string | { url: string; method?: string; body?: unknown };

/**
 * Opens `{ link }` from the API in a new tab.
 *
 * Call it straight from a click handler, before any other `await`: the tab is opened
 * synchronously first (browsers only allow pop-ups during the click) and pointed at the link
 * once it arrives. The new tab gets no `window.opener`, so the external page can't reach ours.
 *
 * Throws (ApiError, or an Error with `errorMessage`) when there's no link; the blank tab is closed.
 */
export async function openLinkInNewTab(req: LinkRequest, errorMessage = 'Could not open the file'): Promise<void> {
  const { url, method, body } = typeof req === 'string' ? { url: req, method: undefined, body: undefined } : req;
  const win = window.open('', '_blank');
  if (win) win.opener = null;
  try {
    const { link } = await fetchJson<{ link?: string }>(url, { method, body, errorMessage });
    if (!link) throw new ApiError(errorMessage, 200);
    if (win) win.location.href = link;
    else window.open(link, '_blank', 'noopener,noreferrer'); // pop-up was blocked anyway: last try
  } catch (e) {
    win?.close();
    throw e;
  }
}
