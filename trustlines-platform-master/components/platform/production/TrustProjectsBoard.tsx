'use client';

import dynamic from 'next/dynamic';

// Both boards render client-only: the Trust System layer reads window/localStorage and opens
// realtime connections, none of which exist on the server.
const loading = () => <p className="m-0 rounded-[8px] bg-ui-surface p-5 text-[13px] text-ui-body">Loading the Projects board…</p>;

/** The Trust System data with T-ERP's design system (components/platform/production/board). */
const NativeBoard = dynamic(async () => {
  const [{ TrustProviders }, { ProjectsBoard }] = await Promise.all([
    import('@/modules/trust-projects/TrustProviders'),
    import('./board/ProjectsBoard'),
  ]);
  return function NativeBoard({ canEdit }: { canEdit: boolean }) {
    return <TrustProviders><ProjectsBoard canEdit={canEdit} /></TrustProviders>;
  };
}, { ssr: false, loading });

/** The Trust System page as-is (modules/trust-projects), until the T-ERP board covers every action. */
const ClassicBoard = dynamic(() => import('@/modules/trust-projects/TrustProjectsApp'), { ssr: false, loading });

export function TrustProjectsBoard({ classic = false, canEdit = false }: { classic?: boolean; canEdit?: boolean }) {
  return classic ? <ClassicBoard /> : <NativeBoard canEdit={canEdit} />;
}
