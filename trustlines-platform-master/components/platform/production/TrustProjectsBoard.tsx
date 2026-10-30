'use client';

import dynamic from 'next/dynamic';

// The Trust System Projects board (modules/trust-projects), client-only: it reads window,
// localStorage and opens portals while rendering, none of which exist on the server.
const TrustProjectsApp = dynamic(() => import('@/modules/trust-projects/TrustProjectsApp'), {
  ssr: false,
  loading: () => <p className="m-0 rounded-[8px] bg-ui-surface p-5 text-[13px] text-ui-body">Loading the Projects board…</p>,
});

export function TrustProjectsBoard() {
  return <TrustProjectsApp />;
}
