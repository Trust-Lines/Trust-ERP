import { notFound } from 'next/navigation';

// Unmatched URLs never reach a segment's not-found.tsx on their own (they fall through to the
// root one, outside the app shell). This catch-all routes them into (platform)/not-found.tsx
// so signed-in users see the 404 inside the sidebar + top bar. Static routes still win.
export default function MissingRoute() {
  notFound();
}
