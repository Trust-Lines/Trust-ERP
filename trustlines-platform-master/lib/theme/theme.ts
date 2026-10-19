// Light / dark theme — chosen per device (localStorage), like "Hide amounts".
// The `dark` class on <html> switches every token in app/globals.css (.dark block).
// The head script in app/layout.tsx applies it before first paint so the page never flashes.

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'tl.theme';
export const THEME_EVENT = 'tl:theme-changed';

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePreference): void {
  const dark = resolveTheme(pref) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function writeThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, pref);
  } catch { /* storage blocked — applies for this page only */ }
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Inline <head> script: same logic as applyTheme, before React loads. */
export const THEME_HEAD_SCRIPT =
  "try{var t=localStorage.getItem('" + THEME_KEY + "');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
  "var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light'}catch(e){}";
