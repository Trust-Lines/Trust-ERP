'use client';

import { useEffect } from 'react';
import { HIDE_AMOUNTS_EVENT, HIDE_AMOUNTS_KEY, maskAmounts, readHideAmounts } from '@/lib/privacy/hideAmounts';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

// Server HTML that React hasn't hydrated yet (a page segment that streams in after the root
// layout) must not be touched: rewriting its text makes React's hydration see different text
// and throw "Hydration failed". Such nodes wait here and are masked once React owns them.
const pending = new Set<Node>();
// After this, mask anything left (not React's, or hydration is long done). Kept under the head
// script's 4 s safety reveal in app/layout.tsx, so a figure is never shown unmasked.
const GIVE_UP_MS = 3500;
let startedAt = 0;

/** React marks every element it has rendered or hydrated with an internal "__reactFiber$…" key. */
function hydrated(el: Element | null): boolean {
  if (!el) return true;
  for (const k in el) if (k.startsWith('__reactFiber')) return true;
  return false;
}

function maskTextNode(n: Node, force = false) {
  const v = n.nodeValue;
  if (!v) return;
  const parent = n.parentElement;
  if (parent && SKIP_TAGS.has(parent.tagName)) return;
  const m = maskAmounts(v);
  if (m === v) return;
  if (!force && !hydrated(parent) && Date.now() - startedAt < GIVE_UP_MS) { pending.add(n); return; }
  pending.delete(n);
  n.nodeValue = m;
}

function maskTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { maskTextNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) maskTextNode(walker.currentNode);
}

/** Re-checks the waiting nodes; true when none are left. */
function flushPending(): boolean {
  const giveUp = Date.now() - startedAt >= GIVE_UP_MS;
  for (const n of [...pending]) {
    if (!n.isConnected) { pending.delete(n); continue; }
    if (giveUp || hydrated(n.parentElement)) maskTextNode(n, true);
  }
  return pending.size === 0;
}

/**
 * Mounted once in the root layout. While "Hide amounts" is on, every currency figure on the page
 * (tables, KPI cards, quick views, tooltips, modals — anything that appears later too) is rewritten
 * to "$•••••". One observer instead of touching the ~60 files that print money.
 * Turning it OFF reloads the page: the original text is simply re-rendered, nothing to restore.
 */
export function AmountsMasker() {
  useEffect(() => {
    const root = document.documentElement;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (observer) return;
      root.setAttribute('data-hide-amounts', '');
      startedAt = Date.now();
      maskTree(document.body);
      observer = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'characterData') maskTextNode(m.target);
          else m.addedNodes.forEach(maskTree);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      // Release the pre-paint cover (head script) only when every figure is masked — the parts
      // still waiting for hydration are re-checked every 100 ms.
      const release = () => root.setAttribute('data-amounts-masked', '');
      if (flushPending()) release();
      else timer = setInterval(() => { if (flushPending()) { release(); if (timer) clearInterval(timer); timer = null; } }, 100);
    }

    function sync() {
      if (readHideAmounts()) start();
      else if (observer) { observer.disconnect(); observer = null; window.location.reload(); }
      else { root.removeAttribute('data-hide-amounts'); root.removeAttribute('data-amounts-masked'); }
    }

    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === HIDE_AMOUNTS_KEY) sync(); };
    window.addEventListener(HIDE_AMOUNTS_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      observer?.disconnect();
      if (timer) clearInterval(timer);
      window.removeEventListener(HIDE_AMOUNTS_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}
