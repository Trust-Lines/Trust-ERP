'use client';

import { Activity } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { AuditRow } from './ProjectDetailClient';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { PersonFace } from '@/components/ui/avatar-directory';

interface Props {
  events: AuditRow[];
  userRole: string;
  userId: string;
  className?: string;
}

type ActionLabel = (n: unknown, o: unknown) => string;

const ACTION_LABELS: Record<string, ActionLabel> = {
  'document.approved':  (n) => `approved ${_str(n, 'doc_type', 'document')} v${_str(n, 'version', '')}`,
  'stage.advanced':     (n, o) => `advanced stage from ${_str(o, 'stage', '?').replace(/_/g,' ')} to ${_str(n, 'stage', '?').replace(/_/g,' ')}`,
  'document.uploaded':  (n) => `uploaded ${_str(n, 'fileName', _str(n, 'doc_type', 'document'))}`,
  'document.created':   (n) => `created ${_str(n, 'doc_type', 'document')}`,
  'qc.failed':          () => 'QC failed',
  'document.rejected':  () => 'rejected document',
  'stage.overdue':      () => 'stage marked overdue',
  'gate.blocked':       (n) => `gate blocked: ${_str(n, 'reason', '')}`,
  'project.created':    (n) => `created project ${_str(n, 'code', '')}`,
  'stage.overridden':   (n) => `overrode stage gate — reason: ${_str(n, 'reason', '')}`,
};

function _str(val: unknown, key: string, fallback: string): string {
  if (val && typeof val === 'object' && key in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)[key]);
  }
  return fallback;
}

function actionLabel(action: string, n: unknown, o: unknown): string {
  return ACTION_LABELS[action]?.(n, o) ?? action.replace(/\./g, ' ');
}

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function relativeTime(d: string): string {
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Figma "Project Detail" › Activity (node 245:28820).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

export function AuditTrail({ events, userRole, className }: Props) {
  const [showAll, setShowAll] = useState(false);
  const PAGE = 10;

  const isTlinesPm = userRole === 'tlines_pm';
  const visible = showAll ? events : events.slice(0, PAGE);

  return (
    <div className={cn('flex flex-col gap-3.5 rounded-[8px] border border-ui-divider bg-ui-page-bg p-4', className)}>
      <h2 className={cn('m-0 text-[20px] font-semibold tracking-[0.4px]', HEADING)}>Activity</h2>

      {isTlinesPm && <p className="m-0 text-[12px] text-ui-text-secondary">Showing your activity only.</p>}

      {visible.length === 0 ? (
        <EmptyState size="sm" className="justify-center px-4 py-7" icon={<Activity />} title="No activity yet." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((ev, i) => {
            const label = actionLabel(ev.action, ev.new_value, ev.old_value);
            const actor = ev.actor?.full_name ?? 'System';
            return (
              <Fragment key={ev.id}>
                {i > 0 && <div aria-hidden className="h-px bg-ui-divider" />}
                <div className="flex items-center gap-2.5">
                  <span className="flex size-[39px] shrink-0 items-center justify-center rounded-[6px] bg-ui-selected-bg text-[12px] leading-[1.4] text-ui-body">
                    <PersonFace name={actor} fallback={initialsOf(actor)} />
                  </span>
                  <div className={cn('min-w-0 flex-1 leading-[normal]', HEADING)}>
                    <p className="m-0 truncate text-[14px] font-semibold tracking-[-0.308px]">{actor}</p>
                    <p className="m-0 text-[12px] tracking-[-0.264px]">{label}</p>
                  </div>
                  <span suppressHydrationWarning className="shrink-0 whitespace-nowrap text-[14px] leading-[1.5] tracking-[-0.308px] text-ui-text-secondary">
                    {relativeTime(ev.created_at)}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {events.length > PAGE && (
        <button
          type="button" onClick={() => setShowAll(s => !s)}
          className="self-start border-0 bg-transparent p-0 text-[13px] font-medium text-ui-nav-active hover:underline"
        >
          {showAll ? 'Show less' : `Load more (${events.length - PAGE} more)`}
        </button>
      )}
    </div>
  );
}
