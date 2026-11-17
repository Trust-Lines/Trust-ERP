import { requirePage } from '@/lib/permissions/requirePage';
import { ItItemDetailClient } from '@/components/platform/it/ItItemDetailClient';

// IT item detail (Figma 880:14431). Same page switch as the Items Library. There is no IT equipment
// endpoint yet, so no item is loaded and the page shows placeholders only.
export default async function ItItemDetailPage(_props: { params: Promise<{ id: string }> }) {
  await requirePage('page.it');

  return <ItItemDetailClient item={null} />;
}
