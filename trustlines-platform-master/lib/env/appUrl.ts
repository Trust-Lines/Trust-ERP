// lib/env/appUrl.ts — 2026-09-04
//
// 🔴 Fixes a real, live production bug: every one of the ~13 call sites that used to
// inline `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'` (survey links,
// document-approval emails, team-invite emails, Dropbox review links, PO/PF
// notifications, sales delivery links, design-job review links…) was silently building
// `http://localhost:3000/...` URLs in the real Vercel deployment, because
// `NEXT_PUBLIC_APP_URL` was never set there. Confirmed live: the "Public Survey Link"
// on a campaign read `http://localhost:3000/survey/...` while the app itself was
// running at `t-erp.vercel.app`.
//
// Fix: before falling back to localhost, try Vercel's own automatically-injected
// deployment env vars — `VERCEL_PROJECT_PRODUCTION_URL` (the stable production domain,
// preferred so links stay the same across deploys) and `VERCEL_URL` (the current
// deployment's own URL, used on preview deploys that have no separate production
// domain). Neither needs to be configured by hand; Vercel sets them on every build.
// An explicit `NEXT_PUBLIC_APP_URL` (e.g. a real custom domain) always wins when set.

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`.replace(/\/+$/, '');

  return 'http://localhost:3000';
}
