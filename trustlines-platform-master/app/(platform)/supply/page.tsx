import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { PortfolioList } from '@/components/platform/workspace/PortfolioClient';
import { toRows } from '@/lib/workspace/rows';
import type { UserRole } from '@/types/database';

// Roadmap Month 2, tasks 15/16 — a real Supply workspace. Before this, "Supply" in the sidebar
// was just an alias for the generic /projects list — a pm_millwork/pm_ceiling person had to open
// every project one at a time to see what item plan/list/PO/PF step was next. This reuses the
// SAME portfolio engine /pm already proved out (Phase 10's lifecycle + Phase 11.4's N+1-safe
// batch loader) rather than inventing a second "what's pending" derivation — one source of truth
// for "what is blocking this project" everywhere in the app.
const SEES_ALL_ROLES = ['ops_manager', 'general_manager', 'supply_manager'];

export default async function SupplyWorkspacePage() {
  await requirePage('page.projects');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).maybeSingle();
  const role = (me?.role ?? null) as UserRole | null;

  const seesAll = SEES_ALL_ROLES.includes(role ?? '');
  const viewer = { userId: user!.id, role };
  const entries = await loadPortfolio(admin, viewer, seesAll ? {} : { pmOf: user!.id });

  const rows = toRows(entries, PHASE_LABELS);
  const maxPriority = (r: (typeof rows)[number]) => Math.max(0, ...r.myActions.map(a => a.priority));
  rows.sort((a, b) => maxPriority(b) - maxPriority(a) || b.blockers.length - a.blockers.length || (a.code ?? '').localeCompare(b.code ?? ''));

  const mine = rows.filter(r => r.myActions.length > 0);
  const blocked = rows.filter(r => r.myActions.length === 0 && r.blockers.length > 0);
  const onTrack = rows.filter(r => r.myActions.length === 0 && r.blockers.length === 0);

  return (
    <div className="main-inner">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Supply Workspace</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
          {seesAll
            ? 'Every active project in production, and what item plan / list / PO / PF step is next.'
            : 'The projects you supply-manage, and what is waiting on you.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat label="Waiting on me" value={mine.length} tone="warn" />
        <Stat label="Blocked" value={blocked.length} />
        <Stat label="On track" value={onTrack.length} />
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            {seesAll ? 'No active production projects yet.' : 'No projects assigned to you as a production PM yet.'}
          </p>
        </div></div>
      ) : (
        <>
          {mine.length > 0 && (
            <Section title="Waiting on me" hint="Your next step on each project">
              <PortfolioList rows={mine} emptyLabel="" />
            </Section>
          )}

          <Section title="Blocked" hint="Someone else's step, but not moving">
            <PortfolioList rows={blocked} emptyLabel="Nothing is blocked." />
          </Section>

          {onTrack.length > 0 && (
            <Section title="On track" hint="No blockers">
              <PortfolioList rows={onTrack} emptyLabel="" />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontSize: 20, fontWeight: 700,
        color: tone === 'warn' && value > 0 ? 'var(--brand-orange)' : 'var(--fg-default)',
      }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{label}</span>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{title}</h2>
        <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{hint}</span>
      </div>
      {children}
    </section>
  );
}
