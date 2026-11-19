'use client';

import { ExternalLink } from 'lucide-react';
import { useDropboxLink } from '@/hooks/use-dropbox-link';

/** Opens the file from Dropbox (same temporary-link endpoint as the project documents table). */
export function OpenFile({ id, name }: { id: string; name: string }) {
  const { open, opening } = useDropboxLink();
  return (
    <button type="button" onClick={() => void open(`/api/files/view?documentId=${encodeURIComponent(id)}`)} disabled={opening} aria-label={`Open ${name}`}
      className="inline-flex size-[35px] cursor-pointer items-center justify-center rounded-[6px] border border-current bg-ui-surface-elevated text-current transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:opacity-60">
      <ExternalLink className="size-5" aria-hidden />
    </button>
  );
}
