import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/platform/settings/SettingsClient';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import type { UserRole } from '@/types/database';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single();
  const { role = '', full_name: fullName = '' } = (profile as { role: UserRole; full_name: string } | null) ?? {};
  // Separate read: before migration 135 the column doesn't exist and this just yields no photo.
  const { data: photo } = await supabase.from('profiles').select('avatar_path, avatar_updated_at').eq('id', user!.id).single();
  const p = photo as { avatar_path: string | null; avatar_updated_at: string | null } | null;
  const avatarUrl = p?.avatar_path ? `/api/avatar/${user!.id}?v=${Date.parse(p.avatar_updated_at ?? '') || 0}` : null;

  return (
    <div style={{ padding: 28 }}>
      <SettingsClient
        isGeneralManager={role === 'general_manager'}
        canBackUpContacts={MARKETING_MANAGE_ROLES.includes(role)}
        role={role}
        fullName={fullName}
        avatarUrl={avatarUrl}
        email={user!.email ?? ''} />
    </div>
  );
}
