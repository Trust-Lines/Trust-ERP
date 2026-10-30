'use client';

// T-ERP ADAPTATION: the classic Trust System board, as-is, inside the .trust-projects wrapper the
// scoped stylesheet hangs off. Rendered client-only (components/platform/production/TrustProjectsBoard.tsx):
// the board reads window/localStorage while rendering.
import './isolation.css';
import './styles.scoped.css';
import { TrustProviders } from './TrustProviders';
import OperationalBoard from './pages/OperationalBoard';

export default function TrustProjectsApp() {
  return (
    <TrustProviders>
      <div className="trust-projects">
        <OperationalBoard mode="projects" />
      </div>
    </TrustProviders>
  );
}
