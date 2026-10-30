import { requirePage } from '@/lib/permissions/requirePage';
import { CustomerReviewsClient } from '@/components/platform/design/library/CustomerReviewsClient';

// Roles & Permissions switch; follows page.design until set separately (catalog.ts PAGE_PARENT).
export default async function Page() {
  await requirePage('page.design_reviews');
  return (
    <div style={{ padding: 28 }}>
      <CustomerReviewsClient />
    </div>
  );
}
