'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ChevronRight, CheckCircle2, Upload, Clock, AlertTriangle, Eye, XCircle } from 'lucide-react';

export interface DashboardStats {
  activeProjects:  number;
  inProduction:    number;
  overdueCount:    number;
  marginAvg:       number | null;
  newThisWeek:     number;
  prodDelta:       number;
  overdueDelta:    number;
}

export interface ApprovalItem {
  id:           string;
  projectId:    string;
  projectCode:  string;
  projectName:  string;
  docType:      string;
  stage:        number;
  versionNum:   number | null;
  requesterName: string;
  waitingMs:    number;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  color: string;
}

export interface ActivityItem {
  id:        string;
  action:    string;
  resource:  string | null;
  createdAt: string;
  actorName: string;
  projectId: string | null;
  projectCode: string | null;
}

export interface OverdueProject {
  id:           string;
  code:         string;
  name:         string;
  currentStage: string;
  stageLabel:   string;
  daysOverdue:  number;
  pmName:       string | null;
}

interface Props {
  userName:    string;
  userRole:    string;
  stats:       DashboardStats;
  approvals:   ApprovalItem[];
  pipeline:    PipelineStage[];
  activity:    ActivityItem[];
  overdue:     OverdueProject[];
  today:       string;
}

function fmtWait(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `waiting ${d}d ${h % 24}h`;
  return `waiting ${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function fmtTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  item_plan:    'Item Plan',
  item_list:    'Item List',
  price_list:   'Price List',
  book:         'Book',
  po_bo:        'PO/BO',
  pf:           'PF',
  proposal:     'Design Proposal',
  plan_layout:  'Plan Layout',
  construction_drawings: 'Construction Drawing',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'approval.approve':   <CheckCircle2 size={13} color="var(--status-success)" />,
  'approval.reject':    <XCircle size={13} color="var(--status-danger)" />,
  'approval.initiated': <Clock size={13} color="var(--status-warning)" />,
  'document.upload':    <Upload size={13} color="var(--status-info)" />,
  'stage.auto_advanced':<ArrowUpRight size={13} color="var(--brand-teal)" />,
};

function actionSentence(action: string, resource: string | null): string {
  const r = resource ?? '';
  switch (action) {
    case 'approval.approve':   return `approved ${r}`;
    case 'approval.reject':    return `rejected ${r}`;
    case 'approval.initiated': return `initiated approval for ${r}`;
    case 'document.upload':    return `uploaded ${r}`;
    case 'stage.auto_advanced':return `project advanced to ${r}`;
    default:                   return `${action.replace('.', ' ')} ${r}`.trim();
  }
}

export default function DashboardClient({
  userName, userRole, stats, approvals, pipeline, activity, overdue, today,
}: Props) {
  const dayName  = new Date(today).toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr  = new Date(today).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const maxPipelineCount = Math.max(...pipeline.map(p => p.count), 1);

  return (
    <div className="main-inner" style={{ maxWidth: 1280 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-default)', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-subtle)' }}>
            {dayName}, {dateStr} · {stats.activeProjects} active projects · Trust-Lines internal view
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(userRole === 'ops_manager' || userRole === 'general_manager') && (
            <Link href="/projects/new" className="btn btn-primary">+ New project</Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Active Projects"
          value={stats.activeProjects}
          delta={stats.newThisWeek}
          deltaLabel="new this week"
          up
        />
        <StatCard
          label="In Production"
          value={stats.inProduction}
          delta={stats.prodDelta}
          deltaLabel="vs last week"
          up
        />
        <StatCard
          label="Overdue"
          value={stats.overdueCount}
          delta={stats.overdueDelta}
          deltaLabel="vs last week"
          danger
          up={stats.overdueDelta <= 0}
        />
        <StatCard
          label="Margin (avg)"
          value={stats.marginAvg !== null ? `${stats.marginAvg.toFixed(1)}%` : '—'}
          delta={null}
          deltaLabel=""
          up
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                  {approvals.length} ITEMS
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>Approvals waiting</h3>
              </div>
              <Link href="/approvals" style={{ fontSize: 12, color: 'var(--brand-teal)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600 }}>
                View all <ArrowUpRight size={12} />
              </Link>
            </div>

            {approvals.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--fg-faint)' }}>
                No pending approvals
              </div>
            ) : (
              <div>
                {approvals.slice(0, 6).map((a, i) => (
                  <Link
                    key={a.id}
                    href={`/projects/${a.projectId}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px',
                      borderBottom: i < Math.min(approvals.length, 6) - 1 ? '1px solid var(--border-subtle)' : 'none',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--brand-teal-100)', color: 'var(--brand-teal-600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {a.requesterName.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--fg-default)', fontWeight: 500 }}>
                        <strong>{a.requesterName}</strong>{' '}
                        submitted {DOC_TYPE_LABELS[a.docType] ?? a.docType} V{a.versionNum ?? 1} for stage {a.stage} approval
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                          background: 'var(--phase-3-bg)', color: 'var(--phase-5)',
                        }}>{a.projectCode}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{fmtWait(a.waitingMs)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--fg-faint)" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                LAST 24 HOURS
              </span>
              <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>Activity</h3>
            </div>
            {activity.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--fg-faint)' }}>
                No activity in the last 24 hours
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {activity.slice(0, 8).map((ev) => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px' }}>
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      {ACTION_ICONS[ev.action] ?? <Eye size={13} color="var(--fg-faint)" />}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--fg-default)', lineHeight: 1.4 }}>
                      {ev.projectCode && (
                        <Link href={`/projects/${ev.projectId}`} style={{ fontWeight: 600, color: 'var(--brand-teal)', textDecoration: 'none', marginRight: 4 }}>
                          {ev.projectCode}
                        </Link>
                      )}
                      <strong>{ev.actorName}</strong>{' '}
                      {actionSentence(ev.action, ev.resource)}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--fg-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {fmtTimeAgo(ev.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                {stats.activeProjects} PROJECTS
              </span>
              <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>Pipeline by stage</h3>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pipeline.map(p => (
                <div key={p.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-default)', fontWeight: 500 }}>{p.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)' }}>{p.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((p.count / maxPipelineCount) * 100)}%`,
                      background: p.color,
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {overdue.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} color="var(--status-danger)" />
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                    NEEDS ATTENTION
                  </span>
                  <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>Overdue</h3>
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                {overdue.slice(0, 5).map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: i < Math.min(overdue.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}>
                        {p.code}{p.pmName ? ` · ${p.pmName}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                        background: 'var(--phase-3-bg)', color: 'var(--phase-5)',
                      }}>{p.stageLabel}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-danger)', whiteSpace: 'nowrap' }}>
                        · -{p.daysOverdue}d
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta, deltaLabel, danger, up }: {
  label:      string;
  value:      string | number;
  delta:      number | null;
  deltaLabel: string;
  danger?:    boolean;
  up?:        boolean;
}) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: danger ? 'var(--status-danger)' : 'var(--fg-default)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)', marginTop: 6 }}>
        {label}
      </div>
      {delta !== null && delta !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, color: up ? 'var(--status-success)' : 'var(--status-danger)' }}>
          {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          <span>{delta > 0 ? '+' : ''}{delta} {deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
