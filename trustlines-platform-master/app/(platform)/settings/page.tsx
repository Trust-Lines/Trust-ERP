import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/platform/settings/SettingsClient';
import type { UserRole } from '@/types/database';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? '';

  return (
    <div className="main-inner">
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <SettingsClient isGeneralManager={role === 'general_manager'} />
    </div>
  );
}
