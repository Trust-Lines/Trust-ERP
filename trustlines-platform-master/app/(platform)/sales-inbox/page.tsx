import { requirePage } from '@/lib/permissions/requirePage';
import { createAdminClient } from '@/lib/supabase/admin';
import { WebLeadsClient, type WebLeadRow } from '@/components/platform/website/WebLeadsClient';

export const dynamic = 'force-dynamic';

// Sales → Store Maker Inbox: everyone who wrote in through the Store Maker website (web_leads,
// migration 122). Same inbox Marketing sees under Website → Leads; Sales can mark, note and turn
// a submission into a Contact. Permanent deletion stays with Marketing.
export default async function SalesInboxPage() {
  await requirePage('page.sales_web_leads');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('web_leads').select('*').order('created_at', { ascending: false }).limit(500);

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 className="mb-1 text-[22px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">Store Maker Inbox</h1>
      <p className="mb-5 text-[13px] text-ui-body">People who wrote in through the Store Maker website. Newest first.</p>
      <WebLeadsClient
        initial={(data ?? []) as WebLeadRow[]}
        canEdit
        loadError={!!error}
        contactBase="/sales-contacts?open="
        canDelete={false}
      />
    </div>
  );
}
