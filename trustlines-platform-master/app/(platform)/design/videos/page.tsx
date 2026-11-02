import { requirePage } from '@/lib/permissions/requirePage';
import { ProductVideosClient } from '@/components/platform/design/library/ProductVideosClient';

// Roles & Permissions switch; follows page.design until set separately (catalog.ts PAGE_PARENT).
export default async function Page() {
  await requirePage('page.design_videos');
  return (
    <div style={{ padding: 28 }}>
      <ProductVideosClient />
    </div>
  );
}
