import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { ProspectsTrashClient, type ProspectTrashRow } from '@/components/platform/marketing/ProspectsTrashClient';
import { MARKETING_READ_ROLES, MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import type { UserRole } from '@/types/database';

const PURGE_DAYS = 30;

export default async function ProspectsTrashPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_READ_ROLES.includes(userRole)) redirect('/marketing');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('prospects').delete().lt('deleted_at', cutoff);

  let q = admin.from('prospects')
    .select('id, entity_type, display_name, organization_name, person_name, deleted_at, created_by, owner_id, assigned_marketing_user_id')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false })
    .limit(500);
  if (userRole === 'marketing_pr') {
    q = q.or(`created_by.eq.${user.id},owner_id.eq.${user.id},assigned_marketing_user_id.eq.${user.id}`);
  }
  const { data } = await q;

  const now = Date.now();
  const rows: ProspectTrashRow[] = ((data ?? []) as Record<string, unknown>[]).map(r => {
    const deletedAt = r.deleted_at as string;
    const ageDays = Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000);
    return {
      id: r.id as string,
      display_name: r.display_name as string,
      entity_type: r.entity_type as string,
      deleted_at: deletedAt,
      daysLeft: Math.max(0, PURGE_DAYS - ageDays),
    };
  });

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Link href="/marketing/prospects" className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>← Lead Cloud</Link>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>Lead Cloud Trash</h1>
          <p className="page-head-sub" style={{ margin: '2px 0 0' }}>
            Deleted leads/organizations are kept for {PURGE_DAYS} days, then permanently removed.
            Restoring brings back their Needs and Potentials too.
          </p>
        </div>
      </div>

      <ProspectsTrashClient rows={rows} canPurge={MARKETING_MANAGE_ROLES.includes(userRole)} />
    </div>
  );
}
