import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeadsTrashClient, type TrashRow } from '@/components/platform/leads/LeadsTrashClient';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { composeProjectCode } from '@/lib/regions';

const PURGE_DAYS = 30;
const PURGE_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];

export default async function LeadsTrashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;
  let q = adm.from('lead_intake').select('*').order('created_at', { ascending: false }).limit(500);
  if (role === 'sales_rep') q = q.eq('created_by', user.id);
  const { data } = await q;

  const deleted = ((data ?? []) as Record<string, unknown>[]).filter(r => !!r.deleted_at);

  const now = Date.now();
  const rows: TrashRow[] = deleted.map(r => {
    const deletedAt = r.deleted_at as string;
    const ageDays = Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000);
    return {
      id: r.id as string,
      name: (r.customer_name as string) || 'Untitled lead',
      project_no: r.project_number != null
        ? composeProjectCode(r.service_line as string, r.region as string, r.project_number as number)
        : null,
      deleted_at: deletedAt,
      daysLeft: Math.max(0, PURGE_DAYS - ageDays),
    };
  });

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Link href="/leads" className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>← Leads</Link>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>Leads Trash</h1>
          <p className="page-head-sub" style={{ margin: '2px 0 0' }}>
            Deleted leads are kept for {PURGE_DAYS} days, then permanently removed.
            This bin is separate from the Trust projects trash.
          </p>
        </div>
      </div>

      <LeadsTrashClient rows={rows} canPurge={PURGE_ROLES.includes(role)} />
    </div>
  );
}
