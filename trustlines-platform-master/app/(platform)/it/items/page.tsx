import { requirePage } from '@/lib/permissions/requirePage';
import { ItItemsLibraryClient } from '@/components/platform/it/ItItemsLibraryClient';

// IT Items Library (Figma 843:41158). Same page switch as IT Tickets. There is no IT equipment
// endpoint yet, so the list is passed in empty and no sample items are shown.
export default async function ItItemsLibraryPage() {
  await requirePage('page.it');

  return <ItItemsLibraryClient items={[]} canCreate={false} />;
}
