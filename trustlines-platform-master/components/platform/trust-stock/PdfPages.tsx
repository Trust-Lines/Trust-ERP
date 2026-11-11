'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import { rowBox, type PfRowLayout } from './pfImport';

// The chosen PF PDF drawn page by page with pdf.js, with what goes on top of it: the scan line
// while the Trust System reads the file, and a box + label on every product row it found.
// Nothing here invents data — the boxes come from the server's `layout`.

export interface Highlight { key: string; layout: PfRowLayout; label: string }
interface PageInfo { widthPx: number; heightPx: number; heightPt: number; scale: number }

export function PdfPages({ file, scanning, highlights, scrollRef, reducedMotion }: {
  file: File;
  scanning: boolean;
  highlights: Highlight[];
  /** The scrolling box around the pages (the scan line and new highlights keep themselves in view). */
  scrollRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const stack = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);

  // Load + draw.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (cancelled) return;
        const width = Math.max(280, (stack.current?.clientWidth ?? 520) - 2);
        const info: PageInfo[] = [];
        const loaded = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          info.push({ widthPx: width, heightPx: base.height * scale, heightPt: base.height, scale });
          loaded.push(page);
        }
        if (cancelled) return;
        setPages(info);
        await new Promise(r => requestAnimationFrame(r)); // canvases mounted
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 0; i < loaded.length && !cancelled; i++) {
          const c = canvases.current[i];
          if (!c) continue;
          const vp = loaded[i].getViewport({ scale: info[i].scale * dpr });
          c.width = vp.width; c.height = vp.height;
          await loaded[i].render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
        }
      } catch (e) {
        if (!cancelled) setFailed(e instanceof Error ? e.message : 'Could not draw the PDF');
      }
    })();
    return () => { cancelled = true; doc?.destroy?.(); };
  }, [file]);

  // Scan line: down the pages in turn, looping while the server reads; the box follows it.
  useEffect(() => {
    if (!scanning || reducedMotion || !pages.length) return;
    const total = pages.reduce((t, p) => t + p.heightPx + 12, 0);
    const duration = Math.max(1200, pages.length * 1100);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const y = (((now - start) % duration) / duration) * total;
      if (line.current) line.current.style.transform = `translateY(${y}px)`;
      const box = scrollRef.current;
      if (box) box.scrollTop = Math.max(0, y - box.clientHeight * 0.4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scanning, reducedMotion, pages, scrollRef]);

  // Keep the newest highlight in view.
  const last = highlights.at(-1);
  useEffect(() => {
    if (!last || !pages[last.layout.page]) return;
    const el = pageEls.current[last.layout.page];
    const box = scrollRef.current;
    if (!el || !box) return;
    const p = pages[last.layout.page];
    const { top } = rowBox(last.layout, p.heightPt, p.scale, p.widthPx);
    box.scrollTo({ top: Math.max(0, el.offsetTop + top - box.clientHeight * 0.35), behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [last, pages, scrollRef, reducedMotion]);

  return (
    <div ref={stack} className="relative flex flex-col gap-3">
      {!pages.length && !failed && (
        <div className="flex h-[420px] items-center justify-center gap-2 rounded-[6px] bg-ui-page-bg text-[12px] text-ui-text-secondary">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Drawing the PDF…
        </div>
      )}
      {failed && <div className="rounded-[6px] bg-ui-page-bg p-4 text-[12px] text-ui-text-secondary">The PDF can’t be shown here ({failed}). Reading still works.</div>}
      {pages.map((p, i) => (
        <div key={i} ref={el => { pageEls.current[i] = el; }} className="relative overflow-hidden rounded-[4px] bg-white shadow-01" style={{ width: p.widthPx, height: p.heightPx }}>
          <canvas ref={el => { canvases.current[i] = el; }} style={{ width: p.widthPx, height: p.heightPx, display: 'block' }} aria-label={`PDF page ${i + 1}`} />
          {highlights.filter(h => h.layout.page === i).map(h => {
            const b = rowBox(h.layout, p.heightPt, p.scale, p.widthPx);
            return (
              <div key={h.key} title={h.label} className="pf-row-hit pointer-events-none absolute rounded-[3px]" style={{ top: b.top, height: Math.max(b.height, 10), left: b.left, width: b.width }}>
                {/* Only the row just found carries its label, so older labels don't cover the prices. */}
                {h.key === last?.key && (
                  <span className="absolute -top-[18px] right-0 whitespace-nowrap rounded-[3px] bg-[var(--color-secondary-700)] px-1.5 py-px font-mono text-[10px] text-white dark:bg-primary-50 dark:text-primary-950">{h.label}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {scanning && !reducedMotion && pages.length > 0 && (
        <div ref={line} aria-hidden className="pf-scan-line pointer-events-none absolute left-0 right-0 top-0">
          <span className="pf-scan-caret" />
        </div>
      )}
    </div>
  );
}
