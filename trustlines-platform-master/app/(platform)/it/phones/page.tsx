import { requirePage } from '@/lib/permissions/requirePage';
import { ItPhonesClient } from '@/components/platform/it/ItPhonesClient';

// IT → Phone Numbers (Figma 966:39447). There is no company phone-line data source in the codebase
// yet, so the list is passed in empty and no sample rows are shown. When it exists: load the lines
// here (number, carrier, device, holder, firm) and enable "New Number" behind an authorised route.
export default async function ItPhonesPage() {
  await requirePage('page.it');

  return <ItPhonesClient lines={[]} canCreate={false} />;
}
