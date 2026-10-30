'use client';

// T-ERP ADAPTATION: the Trust System's App shell for this one page — the providers it relied on
// (Auth → Socket → PaymentRules, same order as the Trust app), the wait for /auth/me, and the
// .trust-projects wrapper the scoped stylesheet hangs off. Rendered client-only (see
// components/platform/production/TrustProjectsBoard.tsx): the board reads window/localStorage.
import './isolation.css';
import './styles.scoped.css';
import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { PaymentRulesProvider } from './contexts/PaymentRulesContext';
import OperationalBoard from './pages/OperationalBoard';

function Gate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p className="m-0 rounded-[8px] bg-ui-surface p-5 text-[13px] text-ui-body">Connecting to the Trust System…</p>;
  if (!isAuthenticated) {
    return (
      <p className="m-0 rounded-[8px] bg-ui-surface p-5 text-[13px] text-ui-body">
        Could not connect to the Trust System. Check that TRUST_API_URL and TRUST_API_KEY are set for T-ERP,
        and that you have access to the Production board.
      </p>
    );
  }
  return <>{children}</>;
}

export default function TrustProjectsApp() {
  return (
    <AuthProvider>
      <SocketProvider>
        <PaymentRulesProvider>
          <Gate>
            <div className="trust-projects">
              <OperationalBoard mode="projects" />
            </div>
          </Gate>
        </PaymentRulesProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
