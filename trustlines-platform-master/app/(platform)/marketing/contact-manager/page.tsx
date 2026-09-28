import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { ContactManagerClient } from '@/components/platform/marketing/ContactManagerClient';
import type { UserRole } from '@/types/database';

export default async function ContactManagerPage() {
  // Same gate as Contacts — this is a second, simpler front door onto the same table.
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  return (
    <div style={{ padding: '24px 32px' }}>
      <ContactManagerClient canEdit={canEdit} />
    </div>
  );
}
