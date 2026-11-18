'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The board's own horizontal scrollbar sits at its bottom, often below the window. A second one
 * stays pinned to the bottom of the window (sticky) and scrolls the board with it.
 * `remeasureKey` re-attaches the size observer when the board's content changes shape.
 */
export function useStickyScrollbar(remeasureKey: unknown) {
  const boxRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [bar, setBar] = useState({ scroll: 0, client: 0 });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBar(b => (b.scroll === box.scrollWidth && b.client === box.clientWidth ? b : { scroll: box.scrollWidth, client: box.clientWidth }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, [remeasureKey]);
  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to) return;
    if (syncing.current) { syncing.current = false; return; }
    if (to.scrollLeft !== from.scrollLeft) { syncing.current = true; to.scrollLeft = from.scrollLeft; }
  };
  return {
    boxRef, barRef,
    /** Content wider than the box: show the pinned bar. */
    showBar: bar.scroll > bar.client + 1,
    barWidth: bar.scroll,
    onBoxScroll: () => follow(boxRef.current, barRef.current),
    onBarScroll: () => follow(barRef.current, boxRef.current),
  };
}
