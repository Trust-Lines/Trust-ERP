'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileQuestion, Loader2, X } from 'lucide-react';
import { viewKind } from '@/lib/files/viewKind';

// Full-screen viewer for the Files tab: a file opens here instead of downloading.
//   PDF / image / video / audio / text → shown inline (streamed by /files/view)
//   Word / Excel / PowerPoint          → "Preview with Microsoft Office" (sends a temporary link
//                                        to Microsoft's viewer, so only on request)
//   anything else (DWG, PSD, renders…) → name + size, Download only when asked
// ← / → step through the folder's files, Esc closes.

export interface ViewerFile { name: string; path: string; size: number | null }

export function FileViewer({ projectId, files, index, onIndex, onClose, getLink, formatBytes }: {
  projectId: string;
  files: ViewerFile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Temporary Dropbox link for a file (download / Office preview). */
  getLink: (path: string) => Promise<string>;
  formatBytes: (n: number | null) => string;
}) {
  const file = files[index];
  const kind = viewKind(file.name);
  const src = `/api/projects/${projectId}/files/view?path=${encodeURIComponent(file.path)}`;
  const [loading, setLoading] = useState(true);
  const [office, setOffice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLoading(kind !== 'none' && kind !== 'office'); setOffice(null); }, [file.path, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [index, files.length, onIndex, onClose]);

  async function download() {
    setBusy(true);
    try {
      const link = await getLink(file.path);
      const a = document.createElement('a');
      a.href = link; a.rel = 'noopener'; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setBusy(false); }
  }

  async function previewOffice() {
    setBusy(true);
    try {
      const link = await getLink(file.path);
      setOffice(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(link)}`);
      setLoading(true);
    } finally { setBusy(false); }
  }

  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-white/20 bg-white/5 px-3 text-[13px] text-white hover:bg-white/15 disabled:opacity-40';

  return (
    <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[9999] flex flex-col bg-black/95">
      <div className="flex shrink-0 items-center gap-2 bg-black/60 px-4 py-2">
        <button type="button" className={btn} onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous file"><ChevronLeft size={16} /></button>
        <button type="button" className={btn} onClick={() => onIndex(index + 1)} disabled={index >= files.length - 1} aria-label="Next file"><ChevronRight size={16} /></button>
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-[13px] font-semibold text-white">{file.name}</div>
          <div className="text-[11px] text-white/60">{index + 1} / {files.length}{file.size != null ? ` · ${formatBytes(file.size)}` : ''}</div>
        </div>
        {kind !== 'none' && kind !== 'office' && (
          <a href={src} target="_blank" rel="noreferrer" className={`${btn} no-underline`}><ExternalLink size={14} /> New tab</a>
        )}
        <button type="button" className={btn} onClick={() => void download()} disabled={busy}><Download size={14} /> Download</button>
        <button type="button" className={btn} onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-white/70" />
          </div>
        )}
        {kind === 'pdf' || kind === 'text' ? (
          <iframe key={src} src={src} title={file.name} onLoad={() => setLoading(false)} className="h-full w-full border-0 bg-white" />
        ) : kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={file.name} onLoad={() => setLoading(false)} onError={() => setLoading(false)} className="max-h-full max-w-full object-contain" />
        ) : kind === 'video' ? (
          <video key={src} src={src} controls autoPlay onLoadedData={() => setLoading(false)} onError={() => setLoading(false)} className="max-h-full max-w-full" />
        ) : kind === 'audio' ? (
          <audio key={src} src={src} controls autoPlay onLoadedData={() => setLoading(false)} onError={() => setLoading(false)} />
        ) : kind === 'office' && office ? (
          <iframe key={office} src={office} title={file.name} onLoad={() => setLoading(false)} className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white">
            <FileQuestion size={40} className="text-white/60" aria-hidden />
            <div className="text-[14px] font-semibold">{file.name}</div>
            {kind === 'office' ? (
              <>
                <p className="m-0 text-[12px] text-white/70">Word / Excel / PowerPoint files open in Microsoft’s online viewer (it reads a temporary Dropbox link).</p>
                <button type="button" className={btn} onClick={() => void previewOffice()} disabled={busy}><ExternalLink size={14} /> Preview with Microsoft Office</button>
              </>
            ) : (
              <p className="m-0 text-[12px] text-white/70">This file type (CAD, Photoshop, render scenes…) can’t be shown in the browser. Open it in its program after downloading.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
