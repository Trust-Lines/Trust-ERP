import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import type { UserRole } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Who is looking at an Email Campaigns page, and whether their mailbox is connected. */
export async function emailPageContext() {
  await requirePage('page.marketing_email');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_READ_ROLES.includes(role)) redirect('/marketing');

  const admin = createAdminClient() as any;
  const { data: mail } = await admin.from('user_mail_settings').select('user_id').eq('user_id', user.id).maybeSingle();
  return {
    admin, userId: user.id, role,
    canEdit: MARKETING_WRITE_ROLES.includes(role), isManager: MARKETING_MANAGE_ROLES.includes(role), mailReady: !!mail,
  };
}

/** Choices for the audience filters — the same lists the Contacts page offers. */
export async function audienceOptions(admin: any) {
  const [{ data: campaigns }, { data: sources }] = await Promise.all([
    admin.from('marketing_campaigns').select('id, name').is('deleted_at', null).order('name').limit(500),
    admin.from('prospects').select('source_raw_label').not('source_raw_label', 'is', null).limit(5000),
  ]);
  return {
    marketingCampaigns: ((campaigns ?? []) as { id: string; name: string }[]).map(c => ({ value: c.id, label: c.name })),
    sources: [...new Set(((sources ?? []) as { source_raw_label: string }[]).map(r => r.source_raw_label.trim()).filter(Boolean))].sort(),
  };
}
