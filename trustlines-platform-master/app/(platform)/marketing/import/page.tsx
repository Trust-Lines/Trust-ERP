import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { ContactImportClient } from '@/components/platform/marketing/ContactImportClient';

export default async function ContactImportPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';

  return (
    <div style={{ padding: '24px 32px' }}>
      {MARKETING_WRITE_ROLES.includes(role) ? (
        <ContactImportClient />
      ) : (
        <p style={{ color: 'var(--fg-subtle)' }}>You don't have permission to import Contacts.</p>
      )}
    </div>
  );
}
