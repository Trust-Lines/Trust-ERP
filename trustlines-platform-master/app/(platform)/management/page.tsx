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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Management Workspace</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          {entries.length} active projects · {blocked.length} blocked
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <Stat label="Blocked projects" value={blocked.length} warn />
        <Stat label="Pending approvals" value={totals.approvals} />
        <Stat label="Open change requests" value={totals.changeRequests} />
        <Stat label="Overdue follow-ups" value={totals.overdue} warn />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 22 }}>
        <section className="card">
          <div className="card-head">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Company blockers</span>
            <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>How many projects each one holds up</span>
          </div>
          {rollup.length === 0 ? (
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>Nothing is blocked company-wide.</p>
            </div>
          ) : (
            <div className="card-body flush">
              {rollup.map((b, i) => (
                <div key={b.code} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px',
                  borderTop: i === 0 ? undefined : '1px solid var(--border-subtle)',
                }}>
                  <span style={{ fontSize: 12.5, flex: 1 }}>{b.message}</span>
                  <span className="pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>
                    {b.projects} {b.projects === 1 ? 'project' : 'projects'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Workload</span>
            <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>Projects per PM</span>
          </div>
          {load.length === 0 ? (
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>No PMs are assigned yet.</p>
            </div>
          ) : (
            <div className="card-body flush">
              {load.map((w, i) => (
                <div key={w.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px',
                  borderTop: i === 0 ? undefined : '1px solid var(--border-subtle)',
                }}>
                  <Avatar name={names[w.userId] ?? '?'} size="sm" />
                  <span style={{ fontSize: 12.5, flex: 1 }}>{names[w.userId] ?? w.userId}</span>
                  {w.blocked > 0 && (
                    <span className="pill" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
                      {w.blocked} blocked
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{w.projects}</span>
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
