import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { MailTemplatesClient, type MailTemplateRow } from '@/components/platform/marketing/MailTemplatesClient';
import type { UserRole } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MailTemplatesPage() {
  // Same gate as Contacts — this is Marketing's own tool, not a separate permission.
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.from('mail_templates')
    .select('id, name, subject, body_html, created_by, created_at, updated_at')
    .is('deleted_at', null).order('name', { ascending: true });

  return (
    <div style={{ padding: '24px 32px' }}>
      <MailTemplatesClient initialTemplates={(error ? [] : (data ?? [])) as MailTemplateRow[]} loadError={!!error} canEdit={canEdit} />
    </div>
  );
}
