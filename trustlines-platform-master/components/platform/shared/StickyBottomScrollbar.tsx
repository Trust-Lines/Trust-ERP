'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function StickyBottomScrollbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [visible, setVisible] = useState(true);
  const syncing = useRef(false);

  useEffect(() => {
    function update() {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, width: r.width });
      setScrollWidth(el.scrollWidth);
      setVisible(r.bottom > 0 && r.top < window.innerHeight);
    }
    update();
    const ro = new ResizeObserver(update);
    if (targetRef.current) ro.observe(targetRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !barEl) return;
    function onTargetScroll() {
      if (syncing.current) return;
      syncing.current = true;
      barEl!.scrollLeft = el!.scrollLeft;
      syncing.current = false;
    }
    function onBarScroll() {
      if (syncing.current) return;
      syncing.current = true;
      el!.scrollLeft = barEl!.scrollLeft;
      syncing.current = false;
    }
    barEl.scrollLeft = el.scrollLeft;
    el.addEventListener('scroll', onTargetScroll);
    barEl.addEventListener('scroll', onBarScroll);
    return () => { el.removeEventListener('scroll', onTargetScroll); barEl.removeEventListener('scroll', onBarScroll); };
  }, [targetRef, barEl]);

  const setBarRef = useCallback((node: HTMLDivElement | null) => setBarEl(node), []);

  if (!rect || !visible || scrollWidth <= rect.width + 2) return null;

  return (
    <div
      ref={setBarRef}
      style={{
        position: 'fixed', bottom: 0, left: rect.left, width: rect.width, height: 14,
        overflowX: 'auto', overflowY: 'hidden', zIndex: 500,
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ width: scrollWidth, height: 1 }} />
    </div>
  );
}
