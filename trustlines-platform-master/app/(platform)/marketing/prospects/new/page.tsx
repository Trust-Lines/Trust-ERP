import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { LeadCaptureWizard } from '@/components/platform/marketing/LeadCaptureWizard';
import type { UserRole } from '@/types/database';

export default async function CaptureLeadPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_WRITE_ROLES.includes(userRole)) redirect('/marketing/prospects');

  return (
    <div className="main-inner" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Capture New Lead</h1>
      <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: '0 0 20px' }}>
        Nothing here creates a project, reserves a project number, or touches Dropbox —
        that happens only once Sales accepts an Opportunity handoff.
      </p>
      <LeadCaptureWizard />
    </div>
  );
}
