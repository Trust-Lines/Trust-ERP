import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/platform/settings/SettingsClient';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import type { UserRole } from '@/types/database';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single();
  const { role = '', full_name: fullName = '' } = (profile as { role: UserRole; full_name: string } | null) ?? {};

  return (
    <div style={{ padding: 28 }}>
      <SettingsClient
        isGeneralManager={role === 'general_manager'}
        canBackUpContacts={MARKETING_MANAGE_ROLES.includes(role)}
        role={role}
        fullName={fullName}
        email={user!.email ?? ''} />
    </div>
  );
}
