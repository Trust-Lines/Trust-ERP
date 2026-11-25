import { requirePage } from '@/lib/permissions/requirePage';
import { ItMailsClient } from '@/components/platform/it/ItMailsClient';
import { itContext } from '@/lib/it/server';

// IT → Mails: the Purelymail mailboxes (lib/it/purelymail). Opening mailboxes / changing passwords
// needs IT edit rights (edit.it), like the API.
export default async function ItMailsPage() {
  await requirePage('page.it');
  const ctx = await itContext();

  return <ItMailsClient canEditMailboxes={!!ctx?.canEdit} />;
}
