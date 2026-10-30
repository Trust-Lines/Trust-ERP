'use client';

// T-ERP ADAPTATION: the Trust System app shell this page relied on — Auth → Socket → PaymentRules
// (same order as the Trust app) and the wait for /auth/me. Used by both the T-ERP board
// (components/platform/production/board) and the classic Trust board (TrustProjectsApp).
import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { PaymentRulesProvider } from './contexts/PaymentRulesContext';

const STATUS_CLS = 'm-0 rounded-[8px] bg-ui-surface p-5 text-[13px] text-ui-body';

function Gate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p className={STATUS_CLS}>Connecting to the Trust System…</p>;
  if (!isAuthenticated) {
    return (
      <p className={STATUS_CLS}>
        Could not connect to the Trust System. Check that TRUST_API_URL and the API key (TRUST_API_KEY or INTEGRATION_API_KEY) are set for T-ERP,
        and that you have access to the Production board.
      </p>
    );
  }
  return <>{children}</>;
}

export function TrustProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>
        <PaymentRulesProvider>
          <Gate>{children}</Gate>
        </PaymentRulesProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
