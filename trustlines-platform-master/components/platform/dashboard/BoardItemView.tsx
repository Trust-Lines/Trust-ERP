'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Archive, BriefcaseBusiness, Clock, CloudSync, Gem, Pause, Trash, X, type LucideIcon } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import type { BoardCardItem, BoardSection } from './BranchBoard';

// Design: Figma "TRUST-LINES ERP" → "Page content" (node 359:25337) — the popup a dashboard card
// opens. Layout only for now: the Potential / Opportunity / Project views, the left list and the
// actions get wired up next.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const VIEWS: { value: View; label: string; icon: LucideIcon }[] = [
  { value: 'potential', label: 'Potential', icon: Clock },
  { value: 'opportunity', label: 'Opportunity', icon: Gem },
  { value: 'project', label: 'Project', icon: BriefcaseBusiness },
];
type View = 'potential' | 'opportunity' | 'project';

const notYet = () => toast.info('Not connected yet');

export function BoardItemView({ item, section, onClose }: { item: BoardCardItem; section: BoardSection; onClose: () => void }) {
  const [view, setView] = React.useState<View>(item.kind === 'opportunity' ? (item.assign?.kind === 'potential' ? 'potential' : 'opportunity') : 'project');
  const mouseDownOnBackdrop = React.useRef(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The card's own stage tone: its tint, with the accent darkened for the text.
  const stageInk = `color-mix(in srgb, ${section.accent} 60%, black)`;
  const rows = [{ key: item.id, title: item.title, sub: item.category ?? item.subtitle, status: item.statuses?.[0] ?? section.label }];

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px' }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={item.title}
        className="flex h-[94vh] w-[96vw] max-w-[1616px] flex-col gap-6 overflow-hidden rounded-[11px] bg-ui-page-bg p-8 shadow-04"
      >
        {/* ── Page heading ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-4">
                <h2 className={`m-0 truncate text-[28px] font-semibold leading-[1.35] ${HEADING}`}>{item.title}</h2>
                {item.onHold && (
                  <span className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[4px] px-2.5 text-[12px] font-medium leading-4" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                    <Pause size={14} aria-hidden /> On Hold
                  </span>
                )}
              </div>
              {item.category && <p className={`m-0 text-[14px] font-medium leading-[1.35] ${HEADING}`}>{item.category}</p>}
            </div>
            <span className="inline-flex h-[22px] w-fit items-center gap-2 rounded-[4px] px-2.5 text-[12px] font-medium leading-4" style={{ background: section.bg, color: stageInk }}>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: stageInk }} aria-hidden />
              {section.label}
            </span>
            {item.subtitle && <p className="m-0 truncate text-[14px] leading-[1.35] text-ui-text-secondary">{item.subtitle}</p>}
          </div>

          <div className="flex shrink-0 flex-col items-end justify-between gap-6 self-stretch">
            <button type="button" aria-label="Close" onClick={onClose} className={`-m-1 flex size-10 items-center justify-center rounded-[6px] hover:bg-ui-hover-bg ${HEADING}`}>
              <X size={32} strokeWidth={1.5} aria-hidden />
            </button>
            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                {VIEWS.map(v => (
                  <button
                    key={v.value} type="button" aria-pressed={view === v.value} onClick={() => setView(v.value)}
                    className={`flex h-9 items-center gap-2 rounded-[6px] border border-solid pl-4 pr-[22px] text-[13px] font-semibold leading-[1.4] ${view === v.value ? 'border-ui-input-border bg-ui-selected-bg' : 'border-ui-divider bg-ui-surface-elevated'} text-ui-body hover:bg-ui-hover-bg`}
                  >
                    <v.icon size={16} aria-hidden /> {v.label}
                  </button>
                ))}
                <FilterSelect
                  aria-label="View"
                  options={VIEWS.map(v => ({ value: v.value, label: v.label }))}
                  value={view}
                  onValueChange={v => setView(v as View)}
                  className="h-9 w-[120px] text-[13px]"
                />
              </div>
              <span className="h-9 w-px bg-ui-divider" aria-hidden />
              <div className="flex items-center gap-2">
                <button type="button" onClick={notYet} className="flex h-10 items-center gap-2 rounded-[6px] border border-solid pl-5 pr-6 text-[13px] font-medium hover:brightness-95" style={{ background: 'var(--status-t10-bg)', borderColor: 'var(--status-t10-fg)', color: 'var(--status-t10-fg)' }}>
                  <Trash size={16} aria-hidden /> Delete
                </button>
                <button type="button" onClick={notYet} className={`flex h-10 items-center gap-2 rounded-[6px] border border-solid border-current pl-5 pr-6 text-[13px] font-medium hover:bg-ui-hover-bg ${HEADING}`}>
                  <CloudSync size={16} aria-hidden /> Back up
                </button>
                <button type="button" onClick={notYet} className="flex h-10 items-center gap-2 rounded-[6px] bg-[var(--color-secondary-700)] pl-5 pr-6 text-[13px] font-medium text-white hover:brightness-110">
                  <Archive size={16} aria-hidden /> Archive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body: list on the left, the selected view on the right ─── */}
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex w-[262px] shrink-0 flex-col gap-2 overflow-y-auto rounded-[10px] bg-ui-surface p-2">
            {rows.map(r => (
              <div key={r.key} className="flex flex-col gap-2 rounded-[6px] bg-ui-page-bg px-5 py-3">
                <div className="flex flex-col gap-[3px] leading-[1.4]">
                  <p className="m-0 text-[13px] font-semibold text-ui-body">{r.title}</p>
                  {r.sub && <p className="m-0 text-[11px] text-ui-text-secondary">{r.sub}</p>}
                </div>
                <span className="inline-flex w-fit items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>
                  {/* Figma's status icon (Status Chip, In review), tinted with the tone's text colour. */}
                  <span aria-hidden className="size-3.5 shrink-0 bg-current" style={{ mask: 'url(/icons/status-in-review.svg) center / contain no-repeat', WebkitMask: 'url(/icons/status-in-review.svg) center / contain no-repeat' }} />
                  {r.status}
                </span>
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-solid border-ui-divider bg-ui-surface" />
        </div>
      </div>
    </div>
  );
}
