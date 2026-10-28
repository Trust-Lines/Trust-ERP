import { requirePage } from '@/lib/permissions/requirePage';
import { AssetLibraryClient } from '@/components/platform/design/library/AssetLibraryClient';

// Roles & Permissions switch; follows page.design until set separately (catalog.ts PAGE_PARENT).
export default async function Page() {
  await requirePage('page.design_assets');
  return (
    <div style={{ padding: 28 }}>
      <AssetLibraryClient />
    </div>
  );
}
