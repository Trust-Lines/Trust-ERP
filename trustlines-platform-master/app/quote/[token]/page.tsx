'use client';

import { useParams } from 'next/navigation';
import { SalesDocumentPage } from '@/components/public/SalesDocumentPage';

// Public page behind the estimate link the salesperson sends (no login — the token is the key).
export default function PublicEstimatePage() {
  const { token } = useParams<{ token: string }>();
  return <SalesDocumentPage kind="estimate" token={token} />;
}
