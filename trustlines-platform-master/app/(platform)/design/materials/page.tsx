import { requirePage } from '@/lib/permissions/requirePage';
import { MaterialsClient } from '@/components/platform/design/library/MaterialsClient';

// Roles & Permissions switch; follows page.design until set separately (catalog.ts PAGE_PARENT).
export default async function Page() {
  await requirePage('page.design_materials');
  return (
    <div style={{ padding: 28 }}>
      <MaterialsClient />
    </div>
  );
}
