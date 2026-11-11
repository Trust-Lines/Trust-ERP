'use client';

/**
 * Inline <script> that runs during HTML parsing (before first paint) without React's dev warning
 * "Encountered a script tag while rendering React component".
 *
 * Pattern from node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md:
 * the server renders type="text/javascript" so the browser executes it while parsing; the client
 * render uses type="text/plain" (a data block React doesn't warn about, never executed), and
 * suppressHydrationWarning accepts the type mismatch. Must be a Client Component so the client
 * render actually takes the `window` branch.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
