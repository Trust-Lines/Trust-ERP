import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPortfolio, blockerRollup, workload } from '@/lib/workspace/portfolio';
import { PHASE_LABELS, phaseRank } from '@/lib/lifecycle/projectLifecycle';
import { ManagementHealthTable, type HealthRow } from '@/components/platform/workspace/ManagementHealthTable';
import { toRows } from '@/lib/workspace/rows';
import type { LifecyclePhase } from '@/lib/lifecycle/projectLifecycle';
import type { UserRole } from '@/types/database';

const MANAGEMENT_ROLES = ['ops_manager', 'general_manager'];

// Figma "ops_manager" (node 178:29671): heading, two "Pattern surface" cards with value bars
// (178:30300), then the project table (178:29818). Only data this page already had is shown —
// the frame's date range, "Create task" and revenue chart have no backing feature here.
const SURFACE = 'flex min-w-0 flex-col gap-5 rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-6';
const SURFACE_TITLE = 'm-0 text-[17px] font-semibold leading-[normal] text-ui-heading';
const SURFACE_SUBTITLE = 'm-0 text-[12px] leading-[1.45] text-ui-text-secondary';
const BAR_TONES = ['t1', 't2', 't6', 't8', 't4', 't5', 't7', 't3'];

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
      <div style={{ padding: 28 }}>
        <div className="rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-6">
          <h1 className="m-0 mb-1 text-[17px] font-semibold text-ui-heading">Management Workspace</h1>
          <p className="m-0 text-[13px] text-ui-body">
            This company-wide view is limited to the Ops Manager and the General Manager.
          </p>
        </div>
      </div>
    );
  }

  const entries = await loadPortfolio(admin, { userId: user!.id, role });
  const rollup = blockerRollup(entries);
  const load = workload(entries);

  // Names for every PM slot used by the workload card and the table's Owner column.
  const pmIds = [...new Set(entries.flatMap(e => [e.project.trustlines_pm_id, e.project.tlines_pm_id, e.project.pm_supervisor_id]).filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (pmIds.length) {
    const { data } = await admin.from('profiles').select('id, full_name').in('id', pmIds);
    for (const p of (data ?? []) as { id: string; full_name: string }[]) names[p.id] = p.full_name;
  }

  const ownerById = new Map(entries.map(e => {
    const id = e.project.trustlines_pm_id ?? e.project.tlines_pm_id ?? e.project.pm_supervisor_id;
    return [e.project.id, id ? (names[id] ?? null) : null] as const;
  }));
  const today = Date.parse(new Date().toISOString().slice(0, 10));

  const rows: HealthRow[] = toRows(entries, PHASE_LABELS).map(r => {
    const overdue = r.deadlines.filter(d => d.isOverdue).map(d => Math.max(0, Math.round((today - Date.parse(d.targetDate)) / 86400000)));
    return {
      ...r,
      ownerName: ownerById.get(r.projectId) ?? null,
      daysLate: r.deadlines.length === 0 ? null : overdue.length ? Math.max(...overdue) : 0,
      phaseRank: phaseRank(r.phase as LifecyclePhase),
    };
  });
  const blocked = rows.filter(r => r.blockers.length > 0);

  const totals = entries.reduce((acc, e) => ({
    approvals: acc.approvals + e.pending.openApprovals,
    changeRequests: acc.changeRequests + e.pending.openChangeRequests,
    overdue: acc.overdue + e.pending.overdueFollowUps,
  }), { approvals: 0, changeRequests: 0, overdue: 0 });

  const maxLoad = Math.max(1, ...load.map(w => w.projects));

  return (
    <div className="flex flex-col gap-[30px]" style={{ padding: 28 }}>
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Operations', href: '/production' }, { label: 'Management', href: '/management' }]} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Management</h1>
        <p className="m-0 text-[13px] text-ui-body">
          Keep handoffs moving. Clear the blockers before they affect delivery. · {entries.length} active projects · {blocked.length} blocked
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Blocked projects" value={blocked.length} warn />
        <Stat label="Pending approvals" value={totals.approvals} />
        <Stat label="Open change requests" value={totals.changeRequests} />
        <Stat label="Overdue follow-ups" value={totals.overdue} warn />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={SURFACE}>
          <div className="flex flex-col gap-1">
            <h2 className={SURFACE_TITLE}>Company Blockers</h2>
            <p className={SURFACE_SUBTITLE}>How many projects each one holds up</p>
          </div>
          <Summary value={`${blocked.length} Blocked`} note={`${rollup.length} blocker ${rollup.length === 1 ? 'type' : 'types'}`} />
          {rollup.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">Nothing is blocked company-wide.</p>
          ) : (
            <div className="flex flex-col gap-[22px]">
              {rollup.map((b, i) => (
                <Bar key={b.code} label={b.message} value={b.projects} max={Math.max(1, entries.length)} tone={BAR_TONES[i % BAR_TONES.length]} />
              ))}
            </div>
          )}
          <Footnote>Bar = share of the {entries.length} active projects</Footnote>
        </section>

        <section className={SURFACE}>
          <div className="flex flex-col gap-1">
            <h2 className={SURFACE_TITLE}>Workload</h2>
            <p className={SURFACE_SUBTITLE}>Projects per PM</p>
          </div>
          <Summary value={`${load.length} ${load.length === 1 ? 'PM' : 'PMs'}`} note={`${entries.length} active projects`} />
          {load.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-text-secondary">No PMs are assigned yet.</p>
          ) : (
            <div className="flex flex-col gap-[22px]">
              {load.map((w, i) => (
                <Bar
                  key={w.userId}
                  label={names[w.userId] ?? w.userId}
                  detail={w.blocked > 0 ? `${w.blocked} blocked` : undefined}
                  value={w.projects}
                  max={maxLoad}
                  tone={BAR_TONES[i % BAR_TONES.length]}
                />
              ))}
            </div>
          )}
          <Footnote>Counts every PM slot (T-Lines PM, Trust Lines PM, supervisor) on active projects</Footnote>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className={SURFACE_TITLE}>Project Health</h2>
          <span className={SURFACE_SUBTITLE}>Blocked projects · most blocked first</span>
        </div>
        <ManagementHealthTable rows={blocked} emptyLabel="Every active project is on track." />
      </section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-ui-divider bg-ui-surface-elevated px-5 py-4">
      <span className={warn && value > 0 ? 'text-[26px] font-semibold leading-none text-error-normal' : 'text-[26px] font-semibold leading-none text-ui-heading'}>
        {value}
      </span>
      <span className="text-[12px] leading-[1.45] text-ui-text-secondary">{label}</span>
    </div>
  );
}

function Summary({ value, note }: { value: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="m-0 text-[26px] font-semibold leading-[normal] whitespace-nowrap text-ui-heading">{value}</p>
      <p className="m-0 text-[12px] leading-[1.45] text-ui-text-secondary">{note}</p>
    </div>
  );
}

// Figma "Stage value": label (+ muted detail) and value over a 14px track.
function Bar({ label, detail, value, max, tone }: { label: string; detail?: string; value: number; max: number; tone: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 text-[13px] text-ui-body">
        <p className="m-0 min-w-0 truncate">
          {label}
          {detail && <span className="text-ui-text-disabled"> · {detail}</span>}
        </p>
        <p className="m-0 shrink-0 font-semibold tabular-nums">{value}</p>
      </div>
      <div className="relative h-3.5 w-full overflow-hidden rounded-[3px] bg-ui-surface" role="img" aria-label={`${label}: ${value} of ${max}`}>
        <div className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${pct}%`, background: `var(--status-${tone}-bg)` }} />
      </div>
    </div>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="h-px w-full bg-ui-divider" />
      <p className="m-0 text-[12px] leading-[1.45] text-ui-text-secondary">{children}</p>
    </div>
  );
}
