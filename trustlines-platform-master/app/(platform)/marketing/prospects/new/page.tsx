import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { LeadCaptureWizard } from '@/components/platform/marketing/LeadCaptureWizard';
import type { UserRole } from '@/types/database';

export default async function CaptureLeadPage() {
  await requirePage('page.marketing_contacts');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_WRITE_ROLES.includes(userRole)) redirect('/marketing/prospects');

  return (
    <div className="main-inner">
      {/* Heading, progress and Contact Preview live inside the wizard (Figma "Capture New Contact"). */}
      <LeadCaptureWizard />
    </div>
  );
}
