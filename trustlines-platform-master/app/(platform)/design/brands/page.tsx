import { requirePage } from '@/lib/permissions/requirePage';
import { BrandKitsClient } from '@/components/platform/design/library/BrandKitsClient';

// Roles & Permissions switch; follows page.design until set separately (catalog.ts PAGE_PARENT).
export default async function Page() {
  await requirePage('page.design_brands');
  return (
    <div style={{ padding: 28 }}>
      <BrandKitsClient />
    </div>
  );
}
