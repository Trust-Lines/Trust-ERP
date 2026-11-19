'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

/** Opens the file from Dropbox (same temporary-link endpoint as the project documents table). */
export function OpenFile({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const win = window.open('', '_blank');
    const res = await fetch(`/api/files/view?documentId=${encodeURIComponent(id)}`).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (body?.link && win) { win.opener = null; win.location.href = body.link; return; }
    win?.close();
    toast.error('Could not open the file');
  }
  return (
    <button type="button" onClick={() => void open()} disabled={busy} aria-label={`Open ${name}`}
      className="inline-flex size-[35px] cursor-pointer items-center justify-center rounded-[6px] border border-current bg-ui-surface-elevated text-current transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:opacity-60">
      <ExternalLink className="size-5" aria-hidden />
    </button>
  );
}
