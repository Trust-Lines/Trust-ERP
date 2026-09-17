import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { ProspectsTrashClient, type ProspectTrashRow, type NeedTrashRow } from '@/components/platform/marketing/ProspectsTrashClient';
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
  await admin.from('prospect_needs').delete().lt('deleted_at', cutoff);

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

  // Needs (and the Potentials/Opportunities cascade-trashed with them) get deleted
  // individually from a Contact's own Needs tab — that Contact usually stays active. Only
  // show those here; a Need whose Contact is ALSO in the trash is already covered by
  // restoring the Contact itself (its restore endpoint brings the Need back too), so
  // listing it separately here would just be a confusing duplicate.
  let nq = admin.from('prospect_needs')
    .select('id, prospect_id, title, classification, deleted_at, created_by')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false })
    .limit(500);
  if (userRole === 'marketing_pr') {
    nq = nq.eq('created_by', user.id);
  }
  const { data: needData } = await nq;
  const needRows = (needData ?? []) as { id: string; prospect_id: string; title: string; classification: string; deleted_at: string }[];

  const prospectIds = [...new Set(needRows.map(n => n.prospect_id))];
  const { data: parents } = prospectIds.length
    ? await admin.from('prospects').select('id, display_name, deleted_at').in('id', prospectIds)
    : { data: [] as { id: string; display_name: string; deleted_at: string | null }[] };
  const parentById = new Map(((parents ?? []) as { id: string; display_name: string; deleted_at: string | null }[]).map(p => [p.id, p]));

  const needRowsOut: NeedTrashRow[] = needRows
    .filter(n => { const parent = parentById.get(n.prospect_id); return parent && !parent.deleted_at; })
    .map(n => {
      const ageDays = Math.floor((now - new Date(n.deleted_at).getTime()) / 86_400_000);
      return {
        id: n.id,
        prospect_id: n.prospect_id,
        prospect_name: parentById.get(n.prospect_id)?.display_name ?? 'Unknown Contact',
        title: n.title,
        classification: n.classification,
        deleted_at: n.deleted_at,
        daysLeft: Math.max(0, PURGE_DAYS - ageDays),
      };
    });

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Link href="/marketing/prospects" className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>← Contacts</Link>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>Marketing Trash</h1>
          <p className="page-head-sub" style={{ margin: '2px 0 0' }}>
            Deleted Contacts and Needs (Potentials/Opportunities) are kept for {PURGE_DAYS} days, then permanently removed.
            Restoring a Contact brings back its Needs and Potentials too.
          </p>
        </div>
      </div>

      <ProspectsTrashClient rows={rows} needRows={needRowsOut} canPurge={MARKETING_MANAGE_ROLES.includes(userRole)} />
    </div>
  );
}
