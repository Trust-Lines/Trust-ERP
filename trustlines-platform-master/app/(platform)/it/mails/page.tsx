import { requirePage } from '@/lib/permissions/requirePage';
import { ItMailsClient } from '@/components/platform/it/ItMailsClient';

// IT → Mails (Figma 879:12933). There is no company-mailbox data source in the codebase
// yet, so the list is passed in empty and no sample rows are shown. When it exists: load the
// mailbox list here (no passwords), and reveal passwords one at a time through an authorised,
// audited endpoint.
export default async function ItMailsPage() {
  await requirePage('page.it');

  return <ItMailsClient accounts={[]} canCreate={false} />;
}
