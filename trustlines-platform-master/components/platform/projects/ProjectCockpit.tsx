'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Check, CircleCheck, Clock, Layers } from 'lucide-react';
import { PHASE_LABELS, TYPE_SUB_PHASE_LABELS, type LifecyclePhase, type TypeSubPhase } from '@/lib/lifecycle/projectLifecycle';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

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

const SUBPHASE_TONE: Record<TypeSubPhase, 't2' | 't7' | 't0'> = {
  VENDOR_PENDING: 't7', PO_PENDING: 't7', READY_TO_ORDER: 't0', ORDERED: 't0',
  IN_PRODUCTION: 't0', READY_TO_SHIP: 't2', SHIPPING: 't2', SENT: 't2',
  ON_HOLD: 't7', ASSEMBLY: 't0',
};

// Figma "Project Detail" (node 245:28820).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD_TITLE = cn('m-0 text-[20px] font-semibold tracking-[0.4px]', HEADING);
const CARD = 'flex flex-col gap-3.5 rounded-[8px] border border-ui-divider bg-ui-page-bg p-4';
const RAIL_CHIP = 'inline-flex items-center justify-center gap-1 rounded-[4px] py-4 pl-4 pr-5 text-[12px] font-medium leading-4 whitespace-nowrap';

export function ProjectCockpit({
  projectId, rail, blockers, perType, nextActions, pending, canSeeInternal, pmNames,
}: CockpitProps) {
  const activeBlockers = blockers.filter(b => b.code !== 'stage_mismatch');
  const mismatch = blockers.find(b => b.code === 'stage_mismatch');

  return (
    <section aria-label="Project cockpit" className="flex flex-col gap-[18px]">
      <div className="rounded-[8px] border border-ui-selected-bg px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {rail.map(s => (
            <span
              key={s.phase}
              title={PHASE_LABELS[s.phase]}
              className={cn(RAIL_CHIP, s.state === 'active' && 'min-w-fit flex-1 bg-[var(--color-primary-500)] text-white')}
              style={s.state === 'active' ? undefined : s.state === 'done'
                ? { background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)' }
                : { background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}
            >
              {s.state === 'done' && <CircleCheck size={14} aria-hidden />}
              {s.label}
            </span>
          ))}
        </div>

        {(activeBlockers.length > 0 || mismatch) && (
          <div className="mt-2.5 flex flex-wrap gap-2 px-1 pb-1">
            {activeBlockers.map(b => (
              <span key={b.code} className="inline-flex items-center gap-1.5 text-[12px] text-ui-body">
                <AlertCircle size={13} aria-hidden style={{ color: 'var(--status-t7-fg)' }} /> {b.message}
              </span>
            ))}
            {mismatch && (
              <span title={mismatch.message} className="inline-flex items-center gap-1.5 text-[12px] italic text-ui-body">
                <Clock size={13} aria-hidden /> {mismatch.message}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <PendingPill label="Open Approvals" value={pending.openApprovals} href="/approvals" />
        <PendingPill label="Open change requests" value={pending.openChangeRequests} href={`/projects/${projectId}/finalization`} />
        <PendingPill label="Overdue follow-ups" value={pending.overdueFollowUps} href={`/projects/${projectId}/finalization`} />
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <div className={CARD}>
          <h2 className={CARD_TITLE}>Next actions</h2>
          {nextActions.length === 0 ? (
            <p className="m-0 text-[13px] text-ui-body">Nothing is waiting — this project is on track.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {nextActions.map((a, i) => (
                <Fragment key={a.code}>
                  {i > 0 && <li aria-hidden className="h-px bg-ui-divider" />}
                  <li>
                    <Link href={a.href} className="flex items-center gap-2 text-inherit no-underline hover:underline">
                      <ArrowRight size={16} aria-hidden className={cn('shrink-0', HEADING)} />
                      <span className={cn('min-w-0 flex-1 text-[14px] font-semibold leading-[1.5] tracking-[-0.308px]', HEADING)}>{a.action}</span>
                      <span className={cn('whitespace-nowrap rounded-[4px] bg-ui-selected-bg px-3 text-[12px] leading-[1.5] tracking-[-0.264px]', HEADING)}>
                        {ownerLabel(a.owner, pmNames)}
                      </span>
                    </Link>
                  </li>
                </Fragment>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <h2 className={CARD_TITLE}>Types</h2>
          {perType.length === 0 ? (
            <EmptyState size="sm" className="py-0" icon={<Layers />} title="No types defined yet." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {perType.map((t, i) => {
                const tone = SUBPHASE_TONE[t.subPhase];
                return (
                  <Fragment key={t.id}>
                    {i > 0 && <div aria-hidden className="h-px bg-ui-divider" />}
                    <Link href={`/projects/${projectId}/types`} className="flex flex-wrap items-center gap-2.5 text-inherit no-underline hover:opacity-80">
                      <span className={cn('text-[14px] font-semibold leading-[1.5] tracking-[-0.308px]', HEADING)}>{t.type}</span>
                      <span
                        className="rounded-[4px] px-[13px] py-px text-[12px] leading-[1.5] tracking-[-0.264px] whitespace-nowrap"
                        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
                      >
                        {TYPE_SUB_PHASE_LABELS[t.subPhase]}
                      </span>
                      {t.isOverdue && <span className="text-[11px]" style={{ color: 'var(--status-t10-fg)' }}>overdue</span>}
                      {canSeeInternal && (
                        <span className="ml-auto inline-flex items-center gap-2.5">
                          <SignChip label="Vendor" ok={t.hasVendor} />
                          <SignChip label="PO" ok={t.poSigned} />
                          {t.pfSigned !== undefined && <SignChip label="PF" ok={t.pfSigned} />}
                        </span>
                      )}
                    </Link>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PendingPill({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className={cn('flex min-w-[220px] flex-1 items-center justify-center gap-1 rounded-[8px] bg-ui-selected-bg py-4 pl-4 pr-5 leading-4 no-underline whitespace-nowrap transition-opacity hover:opacity-85', HEADING)}
    >
      <span className="text-[20px] font-semibold">{value}</span>
      <span className="text-[12px] font-medium">{label}</span>
    </Link>
  );
}

function SignChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span title={`${label}: ${ok ? 'yes' : 'no'}`} className={cn('inline-flex items-center gap-1 text-[14px] leading-[1.5] tracking-[-0.308px]', HEADING)}>
      <span className="inline-flex size-[15px] items-center justify-center rounded-[4px] border border-solid border-current">
        {ok && <Check size={11} strokeWidth={3} aria-hidden />}
      </span>
      {label}
    </span>
  );
}
