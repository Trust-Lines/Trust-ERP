import { requirePage } from '@/lib/permissions/requirePage';
import { ContactManagerClient } from '@/components/platform/marketing/ContactManagerClient';

// Sales → Contacts: the Contact Manager (search every Contact, open a quick view) read-only.
// Editing Contacts stays with Marketing (MARKETING_WRITE_ROLES on every write route).
export default async function SalesContactsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  await requirePage('page.sales_contacts');
  const { open } = await searchParams;
  return (
    <div style={{ padding: '24px 32px' }}>
      <ContactManagerClient canEdit={false} initialOpenId={open ?? null} />
    </div>
  );
}
