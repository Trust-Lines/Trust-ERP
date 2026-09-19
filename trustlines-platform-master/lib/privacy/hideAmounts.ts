// "Hide amounts" privacy mode — masks money on screen, per device (localStorage).
// This is a shoulder-surfing guard, NOT access control: the numbers are still in the page data.

export const HIDE_AMOUNTS_KEY = 'tl.hideAmounts';
export const HIDE_AMOUNTS_EVENT = 'tl:hide-amounts-changed';

// A currency symbol/code followed by a number, optionally with a K/M/B suffix. Only the number is
// replaced — the symbol stays so the column still reads as money and the layout doesn't jump.
const AMOUNT_RE = /((?:US\$|\$|€|£|\b(?:USD|EUR|GBP)\s?)\s?)-?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?/g;
const QUICK_TEST_RE = /[$€£]|USD|EUR|GBP/;

export const AMOUNT_MASK = '•••••';

export function maskAmounts(text: string): string {
  if (!QUICK_TEST_RE.test(text)) return text;
  return text.replace(AMOUNT_RE, (_m, sym: string) => sym + AMOUNT_MASK);
}

export function readHideAmounts(): boolean {
  try { return localStorage.getItem(HIDE_AMOUNTS_KEY) === '1'; } catch { return false; }
}

export function writeHideAmounts(on: boolean): void {
  try {
    if (on) localStorage.setItem(HIDE_AMOUNTS_KEY, '1'); else localStorage.removeItem(HIDE_AMOUNTS_KEY);
  } catch { /* storage blocked — the toggle just won't persist */ }
  window.dispatchEvent(new Event(HIDE_AMOUNTS_EVENT));
}
