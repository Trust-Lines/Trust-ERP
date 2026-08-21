'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const MIN_WIDTH = 60;

export function useResizableColumns(storageKey: string, defaults: number[]) {
  const [widths, setWidths] = useState<number[]>(defaults);
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
      if (Array.isArray(saved) && saved.length === defaults.length && saved.every((n: unknown) => typeof n === 'number')) {
        setWidths(saved as number[]);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(MIN_WIDTH, d.startWidth + (e.clientX - d.startX));
      setWidths(prev => (prev[d.index] === next ? prev : prev.map((w, i) => (i === d.index ? next : w))));
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setWidths(prev => { window.localStorage.setItem(storageKey, JSON.stringify(prev)); return prev; });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [storageKey]);

  const startResize = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { index, startX: e.clientX, startWidth: widths[index] };
  }, [widths]);

  return { widths, startResize };
}
