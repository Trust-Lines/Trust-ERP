'use client';

import { useEffect } from 'react';
import { HIDE_AMOUNTS_EVENT, HIDE_AMOUNTS_KEY, maskAmounts, readHideAmounts } from '@/lib/privacy/hideAmounts';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

function maskTextNode(n: Node) {
  const v = n.nodeValue;
  if (!v) return;
  const parent = n.parentElement;
  if (parent && SKIP_TAGS.has(parent.tagName)) return;
  const m = maskAmounts(v);
  if (m !== v) n.nodeValue = m;
}

function maskTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { maskTextNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) maskTextNode(walker.currentNode);
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

    function start() {
      if (observer) return;
      root.setAttribute('data-hide-amounts', '');
      maskTree(document.body);
      observer = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'characterData') maskTextNode(m.target);
          else m.addedNodes.forEach(maskTree);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      // first pass done — release the pre-paint cover set by the head script
      root.setAttribute('data-amounts-masked', '');
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
      window.removeEventListener(HIDE_AMOUNTS_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}
