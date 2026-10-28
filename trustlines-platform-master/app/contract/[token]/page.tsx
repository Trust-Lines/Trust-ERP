'use client';

import { useParams } from 'next/navigation';
import { SalesDocumentPage } from '@/components/public/SalesDocumentPage';

// Public page behind the contract link the salesperson sends (no login — the token is the key).
export default function PublicContractPage() {
  const { token } = useParams<{ token: string }>();
  return <SalesDocumentPage kind="contract" token={token} />;
}
