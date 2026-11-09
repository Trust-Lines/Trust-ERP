import { requirePage } from '@/lib/permissions/requirePage';
import { PaymentsClient } from '@/components/platform/payments/PaymentsClient';

export default async function PaymentsPage() {
  await requirePage('page.payments');
  return <PaymentsClient />;
}
