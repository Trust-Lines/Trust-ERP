'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Excel-like column widths for the sheet tables (Trust Stock, Production tracker): each column fits
// its widest text by itself; drag a header's right edge to resize, double-click it to fit again.
// Widths someone sets are remembered in this browser (localStorage, per table).

let measureCtx: CanvasRenderingContext2D | null = null;
export function textWidth(s: string, font: string) {
  if (typeof document === 'undefined') return s.length * 7;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return s.length * 7;
  measureCtx.font = font;
  return measureCtx.measureText(s).width;
}

export interface SizedColumn<T> {
  id: string;
  label: string;
  /** The cell's text, for fitting the width. */
  text: (row: T) => string;
  /** Text sits in a chip / filled cell: a little more room. */
  chip?: boolean;
  min?: number;
}

export function useColumnWidths<T>(storageKey: string, cols: SizedColumn<T>[], rows: T[]) {
  const [manual, setManual] = useState<Record<string, number>>({});
  useEffect(() => {
    try { setManual(JSON.parse(localStorage.getItem(storageKey) ?? '{}')); } catch { /* storage off */ }
  }, [storageKey]);
  const persist = useCallback((next: Record<string, number>) => {
    setManual(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage off */ }
  }, [storageKey]);

  const auto = useMemo(() => {
    const family = typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : 'sans-serif';
    const out: Record<string, number> = {};
    for (const c of cols) {
      let w = textWidth(c.label, `600 12px ${family}`) + 26;
      for (const r of rows) w = Math.max(w, textWidth(c.text(r), `400 13px ${family}`) + (c.chip ? 44 : 24));
      out[c.id] = Math.round(Math.min(460, Math.max(c.min ?? 64, w)));
    }
    return out;
  }, [cols, rows]);

  const width = (id: string) => manual[id] ?? auto[id] ?? 100;
  const startResize = (id: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = width(id);
    let latest = { ...manual };
    const move = (ev: PointerEvent) => { latest = { ...latest, [id]: Math.max(48, Math.round(w0 + ev.clientX - x0)) }; setManual(latest); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); persist(latest); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const fit = (id: string) => { const next = { ...manual }; delete next[id]; persist(next); };
  return { width, startResize, fit };
}

/** The drag handle on a header cell's right edge (the header cell must be `relative`). */
export function ColumnResizer({ onResize, onFit, label }: { onResize: (e: React.PointerEvent) => void; onFit: () => void; label: string }) {
  return (
    <span
      role="separator" aria-orientation="vertical" aria-label={`Resize ${label}`} title="Drag to resize · double-click to fit"
      onPointerDown={onResize} onDoubleClick={onFit}
      className="absolute -right-[3px] top-0 z-[2] h-full w-[6px] cursor-col-resize select-none hover:bg-[var(--color-info-normal)]/40"
    />
  );
}
