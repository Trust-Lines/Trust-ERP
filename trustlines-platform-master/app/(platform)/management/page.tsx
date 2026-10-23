import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPortfolio, blockerRollup, workload } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { PortfolioList } from '@/components/platform/workspace/PortfolioClient';
import { toRows } from '@/lib/workspace/rows';
import { Avatar } from '@/components/platform/shared/Avatar';
import type { UserRole } from '@/types/database';

const MANAGEMENT_ROLES = ['ops_manager', 'general_manager'];

// Figma "ops_manager" (node 174:27458) surface + Status Chip (48:500) styles.
const SURFACE = 'flex min-w-0 flex-col gap-5 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-6';
const SURFACE_TITLE = 'm-0 text-[17px] font-semibold leading-[normal] text-ui-heading';
const SURFACE_SUBTITLE = 'm-0 text-[12px] leading-[1.45] text-ui-text-secondary';
const SURFACE_ROW = 'flex items-center gap-2.5 py-2 text-[13px] leading-[1.4] text-ui-body';
const CHIP = 'inline-flex items-center rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 whitespace-nowrap';

export default async function ManagementPage() {
  await requirePage('page.management');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).maybeSingle();
  const role = (me?.role ?? null) as UserRole | null;

  if (!role || !MANAGEMENT_ROLES.includes(role)) {
    return (
      <div className="main-inner">
        <div className="card" style={{ padding: 16 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Management Workspace</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            This company-wide view is limited to the Ops Manager and the General Manager.
          </p>
        </div>
      </div>
    );
  }

  const entries = await loadPortfolio(admin, { userId: user!.id, role });
  const rollup = blockerRollup(entries);
  const load = workload(entries);

  const names: Record<string, string> = {};
  if (load.length) {
    const { data } = await admin.from('profiles').select('id, full_name').in('id', load.map(w => w.userId));
    for (const p of (data ?? []) as { id: string; full_name: string }[]) names[p.id] = p.full_name;
  }

  const rows = toRows(entries, PHASE_LABELS);
  rows.sort((a, b) => b.blockers.length - a.blockers.length || (a.code ?? '').localeCompare(b.code ?? ''));
  const blocked = rows.filter(r => r.blockers.length > 0);

  const totals = entries.reduce((acc, e) => ({
    approvals: acc.approvals + e.pending.openApprovals,
    changeRequests: acc.changeRequests + e.pending.openChangeRequests,
    overdue: acc.overdue + e.pending.overdueFollowUps,
  }), { approvals: 0, changeRequests: 0, overdue: 0 });

  return (
    <div className="main-inner">
      {/* Page heading — Figma "ops_manager" 174:27573 */}
      <div className="mb-[30px] flex flex-col gap-[5px] leading-[1.35]">
        <p className="text-[11px] font-semibold text-ui-nav-active">Operations / Management</p>
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Management</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {entries.length} active projects · {blocked.length} blocked
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <Stat label="Blocked projects" value={blocked.length} warn />
        <Stat label="Pending approvals" value={totals.approvals} />
        <Stat label="Open change requests" value={totals.changeRequests} />
        <Stat label="Overdue follow-ups" value={totals.overdue} warn />
      </div>

      {/* Two side-by-side surfaces — Figma "Pattern surface" 177:29581 / 177:29619 */}
      <div className="mb-[30px] grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={SURFACE}>
          <div className="flex flex-col gap-1">
            <h2 className={SURFACE_TITLE}>Company blockers</h2>
            <p className={SURFACE_SUBTITLE}>How many projects each one holds up</p>
          </div>
          {rollup.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">Nothing is blocked company-wide.</p>
          ) : (
            <div>
              {rollup.map((b, i) => (
                <div key={b.code} className={i === 0 ? SURFACE_ROW : `${SURFACE_ROW} border-t border-ui-divider`}>
                  <span className="flex-1">{b.message}</span>
                  <span className={CHIP} style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                    {b.projects} {b.projects === 1 ? 'project' : 'projects'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={SURFACE}>
          <div className="flex flex-col gap-1">
            <h2 className={SURFACE_TITLE}>Workload</h2>
            <p className={SURFACE_SUBTITLE}>Projects per PM</p>
          </div>
          {load.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">No PMs are assigned yet.</p>
          ) : (
            <div>
              {load.map((w, i) => (
                <div key={w.userId} className={i === 0 ? SURFACE_ROW : `${SURFACE_ROW} border-t border-ui-divider`}>
                  <Avatar name={names[w.userId] ?? '?'} size="sm" />
                  <span className="flex-1">{names[w.userId] ?? w.userId}</span>
                  {w.blocked > 0 && (
                    <span className={CHIP} style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>
                      {w.blocked} blocked
                    </span>
                  )}
                  <span className="text-[13px] font-semibold tabular-nums">{w.projects}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Project health</h2>
          <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>Most blocked first</span>
        </div>
        <PortfolioList rows={blocked} emptyLabel="Every active project is on track." />
      </section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: warn && value > 0 ? 'var(--brand-orange)' : 'var(--fg-default)' }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{label}</span>
    </div>
  );
}
