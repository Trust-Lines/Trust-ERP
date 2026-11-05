'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Intent prefetch: a nav link that loads its page — data included — the moment the user
 * shows they're about to click it, so the click itself opens instantly.
 *
 * 1. In the viewport  → Next's default prefetch (the route's loading shell; cheap).
 * 2. Hover ≥ INTENT_MS, keyboard focus, or touch start → upgrade to a FULL prefetch
 *    (`prefetch={true}`: server render + data). People hover a link roughly 200–400 ms
 *    before they click, which is usually enough for the data to be ready by then.
 *    The short delay keeps a cursor just sweeping across the menu from rendering every page.
 * 3. Once upgraded it stays upgraded; Next's router cache handles expiry/refetch.
 *
 * Prefetching only runs in production builds (`next dev` never prefetches).
 */
const INTENT_MS = 70;

export function IntentLink(props: React.ComponentProps<typeof Link>) {
  const { onMouseEnter, onMouseLeave, onFocus, onTouchStart, ...rest } = props;
  const [full, setFull] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const upgrade = () => setFull(true);

  return (
    <Link
      {...rest}
      prefetch={full ? true : null}
      onMouseEnter={e => {
        if (!full && !timer.current) timer.current = setTimeout(upgrade, INTENT_MS);
        onMouseEnter?.(e);
      }}
      onMouseLeave={e => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        onMouseLeave?.(e);
      }}
      onFocus={e => { upgrade(); onFocus?.(e); }}
      onTouchStart={e => { upgrade(); onTouchStart?.(e); }}
    />
  );
}
