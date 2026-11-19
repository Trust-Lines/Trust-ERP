'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { errorText } from '@/lib/client/fetchJson';
import { openLinkInNewTab, type LinkRequest } from '@/lib/client/openLink';

export interface OpenLinkOptions {
  /** Toast text when the server gives no message. */
  errorMessage?: string;
  /** Replace the default error toast (e.g. a toast with a "Try again" action). */
  onError?: (e: unknown) => void;
}

/**
 * Opens a file through a temporary Dropbox link in a new tab, with an `opening` flag for the button.
 * Call `open` directly from the click handler (see openLinkInNewTab for why).
 * Resolves true when the tab was pointed at the file, false when it failed (the error is already shown).
 */
export function useDropboxLink() {
  const [opening, setOpening] = useState(false);

  const open = useCallback(async (req: LinkRequest, opts: OpenLinkOptions = {}): Promise<boolean> => {
    const message = opts.errorMessage ?? 'Could not open the file';
    setOpening(true);
    try {
      await openLinkInNewTab(req, message);
      return true;
    } catch (e) {
      if (opts.onError) opts.onError(e);
      else toast.error(errorText(e, message));
      return false;
    } finally {
      setOpening(false);
    }
  }, []);

  return { open, opening };
}
