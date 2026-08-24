'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  CheckCircle2,
  Upload,
  Clock,
  AlertTriangle,
  Eye,
  XCircle,
  Briefcase,
  BarChart3,
  AlarmClock,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  FileCheck,
  ChevronDown,
} from 'lucide-react';

export interface DashboardStats {
  activeProjects: number;
  inProduction: number;
  overdueCount: number;
  marginAvg: number | null;
  newThisWeek: number;
  prodDelta: number;
  overdueDelta: number;
}

export interface ApprovalItem {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  docType: string;
  stage: number;
  versionNum: number | null;
  requesterName: string;
  waitingMs: number;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  resource: string | null;
  createdAt: string;
  actorName: string;
  projectId: string | null;
  projectCode: string | null;
}

export interface OverdueProject {
  id: string;
  code: string;
  name: string;
  currentStage: string;
  stageLabel: string;
  daysOverdue: number;
  pmName: string | null;
}

interface Props {
  userName: string;
  userRole: string;
  stats: DashboardStats;
  approvals: ApprovalItem[];
  pipeline: PipelineStage[];
  activity: ActivityItem[];
  overdue: OverdueProject[];
  today: string;
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
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  item_plan: 'Item Plan',
  item_list: 'Item List',
  price_list: 'Price List',
  book: 'Book',
  po_bo: 'PO/BO',
  pf: 'PF',
  proposal: 'Design Proposal',
  plan_layout: 'Plan Layout',
  construction_drawings: 'Construction Drawing',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'approval.approve': <CheckCircle2 size={13} color="var(--status-success)" />,
  'approval.reject': <XCircle size={13} color="var(--status-danger)" />,
  'approval.initiated': <Clock size={13} color="var(--status-warning)" />,
  'document.upload': <Upload size={13} color="var(--status-info)" />,
  'stage.auto_advanced': <ArrowUpRight size={13} color="var(--brand-teal)" />,
};

function actionSentence(action: string, resource: string | null): string {
  const r = resource ?? '';
  switch (action) {
    case 'approval.approve': return `approved ${r}`;
    case 'approval.reject': return `rejected ${r}`;
    case 'approval.initiated': return `initiated approval for ${r}`;
    case 'document.upload': return `uploaded ${r}`;
    case 'stage.auto_advanced': return `project advanced to ${r}`;
    default: return `${action.replace('.', ' ')} ${r}`.trim();
  }
}

export default function DashboardClient({
  userName, userRole, stats, approvals, pipeline, activity, overdue, today,
}: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName ? userName.split(' ')[0] : 'User';
  const maxPipelineCount = Math.max(...pipeline.map(p => p.count), 1);
  const totalPipelineProjects = pipeline.reduce((acc, p) => acc + p.count, 0);

  return (
    <div className="main-inner" style={{ maxWidth: 1280, padding: '24px 32px' }}>

      {/* ── Section Header ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-default)', margin: 0, letterSpacing: '-0.01em' }}>
            Pipeline Overview
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-subtle)' }}>
            Here&apos;s what&apos;s happening with your pipeline today — {today}
          </p>
        </div>
        <div>
          {(userRole === 'ops_manager' || userRole === 'general_manager') && (
            <Link
              href="/projects/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                background: '#0f172a',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              + New project <ChevronDown size={14} style={{ opacity: 0.7 }} />
            </Link>
          )}
        </div>
      </div>

      {/* ── 4 KPI Stat Cards ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={<Briefcase size={20} />}
          iconBg="#eff6ff"
          iconColor="#2563eb"
          label="ACTIVE PROJECTS"
          value={stats.activeProjects}
          delta={stats.newThisWeek}
          deltaLabel="new this week"
          up
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          iconBg="#fff7ed"
          iconColor="#ea580c"
          label="IN PRODUCTION"
          value={stats.inProduction}
          delta={stats.prodDelta}
          deltaLabel="vs last week"
          up
        />
        <StatCard
          icon={<AlarmClock size={20} />}
          iconBg="#fef2f2"
          iconColor="#ef4444"
          label="OVERDUE"
          labelColor="#ef4444"
          value={stats.overdueCount}
          delta={stats.overdueDelta}
          deltaLabel="vs last week"
          danger
          up={stats.overdueDelta <= 0}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          iconBg="#f8fafc"
          iconColor="#475569"
          label="MARGIN (AVG)"
          value={stats.marginAvg !== null ? `${stats.marginAvg.toFixed(1)}%` : '—'}
          delta={null}
          deltaLabel=""
          up
        />
      </div>

      {/* ── Middle Two-Column Section ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Approvals Waiting Card */}
        <div className="card" style={{ padding: 0, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: 'var(--fg-default)' }}>
                <ShieldCheck size={26} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                  {approvals.length} ITEMS
                </div>
                <h3 style={{ margin: '1px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>
                  Approvals waiting
                </h3>
              </div>
            </div>
            <Link
              href="/approvals"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0f172a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
              }}
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {approvals.length === 0 ? (
            <div style={{ padding: '44px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 48, height: 56, marginBottom: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 42, height: 50, borderRadius: 6, border: '2px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 8px' }}>
                  <div style={{ width: '80%', height: 2, background: '#cbd5e1', borderRadius: 1 }} />
                  <div style={{ width: '60%', height: 2, background: '#cbd5e1', borderRadius: 1 }} />
                  <div style={{ width: '70%', height: 2, background: '#cbd5e1', borderRadius: 1 }} />
                </div>
                <div style={{ position: 'absolute', bottom: -2, right: 0, width: 20, height: 20, borderRadius: '50%', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #ffffff' }}>
                  <CheckCircle2 size={13} strokeWidth={3} />
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-default)', marginBottom: 3 }}>
                No pending approvals
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                You&apos;re all caught up!
              </div>
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {approvals.slice(0, 6).map((a, i) => (
                <Link
                  key={a.id}
                  href={`/projects/${a.projectId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 20px',
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

        {/* Pipeline by Stage Card */}
        <div className="card" style={{ padding: 0, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                {totalPipelineProjects || stats.activeProjects} PROJECTS
              </div>
              <h3 style={{ margin: '1px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>
                Pipeline by stage
              </h3>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pipeline.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
                  No active pipeline stages
                </div>
              ) : (
                pipeline.map(p => (
                  <div key={p.stage}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--fg-default)', fontWeight: 600 }}>{p.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-default)' }}>{p.count}</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.round((p.count / maxPipelineCount) * 100)}%`,
                        background: '#6366f1',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ padding: '16px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/projects"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              View pipeline <ArrowRight size={13} />
            </Link>
          </div>
        </div>

      </div>

      {/* ── Overdue Project Alerts (if any) ────────────────────── */}
      {overdue.length > 0 && (
        <div className="card" style={{ padding: 0, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', marginBottom: 24 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={14} color="#dc2626" />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#dc2626' }}>
                NEEDS ATTENTION
              </span>
              <h3 style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--fg-default)' }}>
                Overdue Projects ({overdue.length})
              </h3>
            </div>
          </div>
          <div style={{ padding: '4px 0' }}>
            {overdue.slice(0, 5).map((p, i) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 20px',
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

      {/* ── Activity Card (Full Width at Bottom) ───────────────── */}
      <div className="card" style={{ padding: 0, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: 'var(--fg-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-faint)' }}>
                LAST 24 HOURS
              </div>
              <h3 style={{ margin: '1px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--fg-default)' }}>
                Activity
              </h3>
            </div>
          </div>
          <Link
            href="/audit"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#0f172a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            View all activity <ArrowRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--fg-faint)' }}>
            No activity in the last 24 hours
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {activity.slice(0, 8).map((ev, i) => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 20px',
                  borderBottom: i < Math.min(activity.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0, color: 'var(--fg-faint)', display: 'flex', alignItems: 'center' }}>
                    <Eye size={15} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-default)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.projectCode && (
                      <Link href={`/projects/${ev.projectId}`} style={{ fontWeight: 600, color: 'var(--brand-teal)', textDecoration: 'none', marginRight: 4 }}>
                        {ev.projectCode}
                      </Link>
                    )}
                    <strong style={{ fontWeight: 700 }}>{ev.actorName}</strong>{' '}
                    <span style={{ color: 'var(--fg-default)' }}>{actionSentence(ev.action, ev.resource)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmtTimeAgo(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  labelColor,
  value,
  delta,
  deltaLabel,
  danger,
  up,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  labelColor?: string;
  value: string | number;
  delta: number | null;
  deltaLabel: string;
  danger?: boolean;
  up?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '18px 20px',
        borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: danger ? 'var(--status-danger)' : 'var(--fg-default)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: labelColor || 'var(--fg-subtle)', marginTop: 4 }}>
          {label}
        </div>
        {delta !== null && delta !== 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 11, fontWeight: 700, color: up ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {up ? <ArrowUpRight size={12} strokeWidth={2.5} /> : <ArrowDownRight size={12} strokeWidth={2.5} />}
            <span>{delta > 0 ? '' : ''}{delta} {deltaLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
