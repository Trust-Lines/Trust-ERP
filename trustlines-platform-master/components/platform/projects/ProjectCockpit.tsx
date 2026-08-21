'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Circle, Clock } from 'lucide-react';
import { PHASE_LABELS, TYPE_SUB_PHASE_LABELS, type LifecyclePhase, type TypeSubPhase } from '@/lib/lifecycle/projectLifecycle';

interface RailStage { phase: LifecyclePhase; label: string; state: 'done' | 'active' | 'upcoming' }
interface Blocker { code: string; message: string; count?: number }
interface TypeCell {
  id: string; type: string; status: string; subPhase: TypeSubPhase;
  hasVendor: boolean; poSigned: boolean; pfSigned?: boolean;
  targetDate: string | null; isOverdue: boolean;
}
interface ActionOwner { kind: 'role' | 'project_pm'; role?: string; slot?: string }
interface NextAction { code: string; action: string; owner: ActionOwner; href: string; priority: number }
interface PendingCounts { openApprovals: number; openChangeRequests: number; overdueFollowUps: number }

export interface CockpitProps {
  projectId: string;
  phase: LifecyclePhase;
  rail: RailStage[];
  blockers: Blocker[];
  perType: TypeCell[];
  nextActions: NextAction[];
  pending: PendingCounts;
  canSeeInternal: boolean;
  pmNames: { tlines_pm_id: string | null; trustlines_pm_id: string | null };
}

const ROLE_LABELS: Record<string, string> = {
  production_manager: 'Production Manager',
  general_manager: 'General Manager',
  accountant: 'Accountant',
  sales_marketing_manager: 'Sales Manager',
};

function ownerLabel(owner: ActionOwner, pmNames: CockpitProps['pmNames']): string {
  if (owner.kind === 'project_pm') {
    const who = owner.slot === 'tlines_pm_id' ? pmNames.tlines_pm_id : pmNames.trustlines_pm_id;
    const role = owner.slot === 'tlines_pm_id' ? 'T-Lines PM' : 'Trust PM';
    return who ? `${role} (${who})` : role;
  }
  return ROLE_LABELS[owner.role ?? ''] ?? owner.role ?? '—';
}

const SUBPHASE_TONE: Record<TypeSubPhase, 'good' | 'warn' | 'muted'> = {
  VENDOR_PENDING: 'warn', PO_PENDING: 'warn', READY_TO_ORDER: 'muted', ORDERED: 'muted',
  IN_PRODUCTION: 'muted', READY_TO_SHIP: 'good', SHIPPING: 'good', SENT: 'good',
  ON_HOLD: 'warn', ASSEMBLY: 'muted',
};

export function ProjectCockpit({
  projectId, rail, blockers, perType, nextActions, pending, canSeeInternal, pmNames,
}: CockpitProps) {
  const activeBlockers = blockers.filter(b => b.code !== 'stage_mismatch');
  const mismatch = blockers.find(b => b.code === 'stage_mismatch');

  return (
    <section aria-label="Project cockpit" style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {rail.map((s, i) => (
            <div key={s.phase} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="pill"
                title={PHASE_LABELS[s.phase]}
                style={{
                  fontSize: 11, whiteSpace: 'nowrap',
                  fontWeight: s.state === 'active' ? 700 : 400,
                  background: s.state === 'active' ? 'var(--brand-navy)'
                    : s.state === 'done' ? 'var(--status-success-bg)' : 'var(--bg-sunken)',
                  color: s.state === 'active' ? 'white'
                    : s.state === 'done' ? 'var(--status-success-fg)' : 'var(--fg-subtle)',
                  boxShadow: s.state === 'active' ? '0 1px 3px rgba(15,42,68,0.28)' : undefined,
                }}
              >
                {s.state === 'done' && <CheckCircle2 size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />}
                {s.label}
              </span>
              {i < rail.length - 1 && <span style={{ color: 'var(--fg-subtle)', fontSize: 10 }}>›</span>}
            </div>
          ))}
        </div>

        {(activeBlockers.length > 0 || mismatch) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {activeBlockers.map(b => (
              <span key={b.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fg-subtle)' }}>
                <AlertCircle size={13} style={{ color: 'var(--status-warning-fg, #b45309)' }} /> {b.message}
              </span>
            ))}
            {mismatch && (
              <span title={mismatch.message} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic' }}>
                <Clock size={13} /> {mismatch.message}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <PendingPill label="Open approvals" value={pending.openApprovals} href="/approvals" />
        <PendingPill label="Open change requests" value={pending.openChangeRequests} href={`/projects/${projectId}/finalization`} />
        <PendingPill label="Overdue follow-ups" value={pending.overdueFollowUps} href={`/projects/${projectId}/finalization`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Next actions</h2>
          {nextActions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>Nothing is waiting — this project is on track.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {nextActions.map(a => (
                <li key={a.code}>
                  <Link href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                    <ArrowRight size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{a.action}</span>
                    <span className="pill" style={{ fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                      {ownerLabel(a.owner, pmNames)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Types</h2>
          {perType.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>No types defined yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {perType.map(t => (
                <Link
                  key={t.id}
                  href={`/projects/${projectId}/types`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ fontWeight: 600, minWidth: 90 }}>{t.type}</span>
                  <span
                    className="pill"
                    style={{
                      fontSize: 10,
                      background: SUBPHASE_TONE[t.subPhase] === 'good' ? 'var(--status-success-bg)'
                        : SUBPHASE_TONE[t.subPhase] === 'warn' ? 'var(--status-warning-bg, #fef3c7)' : 'var(--bg-sunken)',
                      color: SUBPHASE_TONE[t.subPhase] === 'good' ? 'var(--status-success-fg)'
                        : SUBPHASE_TONE[t.subPhase] === 'warn' ? 'var(--status-warning-fg, #b45309)' : 'var(--fg-subtle)',
                    }}
                  >
                    {TYPE_SUB_PHASE_LABELS[t.subPhase]}
                  </span>
                  {canSeeInternal && (
                    <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto', color: 'var(--fg-subtle)' }}>
                      <SignChip label="Vendor" ok={t.hasVendor} />
                      <SignChip label="PO" ok={t.poSigned} />
                      {t.pfSigned !== undefined && <SignChip label="PF" ok={t.pfSigned} />}
                    </span>
                  )}
                  {t.isOverdue && (
                    <span style={{ color: 'var(--status-danger, #dc2626)', fontSize: 11, marginLeft: canSeeInternal ? 8 : 'auto' }}>
                      overdue
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PendingPill({ label, value, href }: { label: string; value: number; href: string }) {
  const active = value > 0;
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, textDecoration: 'none',
        padding: '6px 12px', borderRadius: 8,
        background: active ? 'var(--status-warning-bg, #fef3c7)' : 'var(--bg-sunken)',
        color: active ? 'var(--status-warning-fg, #b45309)' : 'var(--fg-subtle)',
      }}
    >
      <strong style={{ fontSize: 15 }}>{value}</strong> {label}
    </Link>
  );
}

function SignChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span title={`${label}: ${ok ? 'yes' : 'no'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
      {ok ? <CheckCircle2 size={12} style={{ color: 'var(--status-success-fg)' }} /> : <Circle size={12} />}
      {label}
    </span>
  );
}
