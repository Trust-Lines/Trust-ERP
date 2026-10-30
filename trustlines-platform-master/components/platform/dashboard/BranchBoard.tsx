'use client';

import * as React from 'react';
import Link from 'next/link';
import { MapPinOff, Pause, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import { toast } from 'sonner';
import { ProjectQuickView } from './ProjectQuickView';
// The real, editable opportunity popup — same one /leads and /marketing/opportunities use
// (comments, files, ClickUp reference, inline edits) — not a dashboard-only rebuild.
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';

// Design: Figma "Tlines-Websites" → "Desktop - 17" (node 60:1139) — the 4-branch board that
// replaces the old company-wide dashboard. Each column is one real T-Lines region
// (lib/regions.ts), each row one pipeline stage. Who sees which columns is decided by the
// caller (app/(platform)/dashboard/page.tsx, via lib/access/regionScope) — this component
// only renders whatever columns it's given.
//
// Every card opens a quick-view popup in place — a project's shows files + progress, an
// opportunity's shows its pipeline details — instead of navigating off the dashboard.

export interface BoardCardItem {
  id: string;
  kind: 'project' | 'opportunity' | 'trust';   // trust = a Trust System project (no popup yet)
  badgeTop: string;
  badgeBottom: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  pmName: string | null;
  pmLabel: string;
  onHold: boolean;
  // Raw yyyy-mm-dd (project: est. delivery, falling back to closed-deal date; opportunity: the
  // date it became an opportunity — ClickUp's own creation date, reliably set, unlike the
  // often-blank expected_close_date) — kept separate from dateLabel so the date filter can
  // compare it without reparsing the formatted display string.
  dateISO: string | null;
  dateLabel: string | null;
  href: string;
  /** Short line under the address, e.g. which types have a PF code / what hasn't shipped. */
  note?: string | null;
  /** Status chips: the deal's stage, or each Trust type's production status. */
  statuses?: string[];
  /** "Assign to": the person for this card in the stage it's in (board_assignees, per stage). */
  assign?: { kind: string; stage: string; label: string; userId: string | null };
}

const assignKey = (item: BoardCardItem) => `${item.assign?.kind}:${item.id}:${item.assign?.stage}`;

/** "Assign to" on the cards — every active user, chosen from the design-system Select. */
const AssignContext = React.createContext<{
  options: { value: string; label: string }[];
  canAssign: boolean;
  assigned: Record<string, string | null>;
  assign: (item: BoardCardItem, userId: string | null) => void;
}>({ options: [], canAssign: false, assigned: {}, assign: () => {} });

const UNASSIGNED = '';

function AssignBox({ item, section }: { item: BoardCardItem; section: BoardSection }) {
  const { options, canAssign, assigned, assign } = React.useContext(AssignContext);
  const key = assignKey(item);
  const current = key in assigned ? assigned[key] : item.assign?.userId ?? null;
  const name = options.find(o => o.value === current)?.label ?? null;
  // The card's own tone, darker for the name — not a form field.
  const ink = `color-mix(in srgb, ${section.accent} 60%, black)`;
  return (
    <span
      className="flex w-[210px] shrink-0 flex-col rounded-[8px] px-3 pb-1.5 pt-2 leading-normal shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      style={{ background: `color-mix(in srgb, ${section.bg} 35%, white)`, color: ink }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <span className="text-[12px] font-medium opacity-80">Assign to</span>
      {canAssign ? (
        <FilterSelect
          aria-label={`Assign ${item.assign?.label ?? ''} to`}
          options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...options]}
          value={current ?? UNASSIGNED}
          onValueChange={v => assign(item, v || null)}
          className="h-7 border-0 bg-transparent px-0 text-[16px] font-bold text-current hover:border-0 dark:border-0 dark:bg-transparent dark:px-0"
        />
      ) : (
        <span className="truncate text-[16px] font-bold">{name ?? 'Unassigned'}</span>
      )}
    </span>
  );
}

export interface BoardSection {
  key: string;
  label: string;
  accent: string;   // text, dot + badges
  labelColor?: string; // section heading, when it differs from accent
  bg: string;        // section tint
  items: BoardCardItem[];
  emptyLabel: string;
}

export interface BoardColumn {
  regionCode: string;
  logoSrc: string;
  logoCode: string;
  headerColor: string;
  sections: BoardSection[];
}

// The source PNGs (public/TLINES LOGOS PNG) are 4500x4500 canvases with a lot of transparent
// padding baked in around the actual mark — measured once (bounding box of non-transparent
// pixels) so the header can crop straight to the logo instead of shrinking it to fit the pad.
const LOGO_INSET: Record<string, { l: number; t: number; r: number; b: number }> = {
  NE:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  SE:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  NW:  { l: 23.8,  t: 34.53, r: 23.8,  b: 34.6 },
  CVW: { l: 13.27, t: 37.93, r: 13.27, b: 38 },
};

function CroppedLogo({ src, code, className }: { src: string; code: string; className?: string }) {
  const inset = LOGO_INSET[code] ?? { l: 0, t: 0, r: 0, b: 0 };
  const w = 100 - inset.l - inset.r;
  const h = 100 - inset.t - inset.b;
  return (
    <span className={`relative block overflow-hidden ${className ?? ''}`} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={src}
        className="absolute max-w-none"
        style={{
          width: `${(100 / w) * 100}%`,
          height: `${(100 / h) * 100}%`,
          left: `${-(inset.l / w) * 100}%`,
          top: `${-(inset.t / h) * 100}%`,
          filter: 'brightness(0) invert(1)',
        }}
      />
    </span>
  );
}

function Card({ item, section, onOpen }: {
  item: BoardCardItem; section: BoardSection; onOpen: (item: BoardCardItem) => void;
}) {
  // Cards hold the Assign to dropdown, so no card is a <button> (a control can't sit inside one).
  const opens = item.kind !== 'trust';
  return (
    <div
      role={opens ? 'button' : undefined}
      tabIndex={opens ? 0 : undefined}
      className={`relative flex w-full flex-col gap-1.5 rounded-[10px] border border-solid pb-3.5 pl-4 pr-3.5 pt-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring ${opens ? 'cursor-pointer hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:brightness-[0.98]' : ''}`}
      style={{ background: section.bg, color: section.accent, borderColor: `color-mix(in srgb, ${section.accent} 35%, transparent)`, borderLeftWidth: 4, borderLeftColor: section.accent }}
      onClick={opens ? () => onOpen(item) : undefined}
      onKeyDown={opens ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item); } } : undefined}
    >
      <span
        className="absolute -top-3.5 left-3 flex h-6 min-w-[92px] items-center justify-center rounded-[5px] px-2 text-[15px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
        style={{ background: section.accent, color: 'var(--ui-surface-elevated)' }}
      >
        {[item.badgeTop, item.badgeBottom].filter(Boolean).join(' ')}
      </span>
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate text-[18px] font-bold leading-tight">{item.title}</span>
            {item.onHold && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-semibold" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                <Pause size={11} aria-hidden /> On Hold
              </span>
            )}
          </span>
          {item.category && <span className="mt-0.5 block truncate text-[12px] font-medium leading-normal opacity-90">{item.category}</span>}
        </span>
        {item.dateLabel && <span className="shrink-0 text-[12px] font-medium leading-normal">{item.dateLabel}</span>}
      </span>
      {item.statuses && item.statuses.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {item.statuses.map(s => (
            <span key={s} className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold leading-none"
              style={{ background: section.accent, color: 'var(--ui-surface-elevated)' }}>
              {s}
            </span>
          ))}
        </span>
      )}
      <span className="flex w-full items-end justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[12px] leading-normal">{item.subtitle}</span>
          {item.note && <span className="mt-0.5 block text-[12px] font-bold leading-normal">{item.note}</span>}
        </span>
        {item.assign ? <AssignBox item={item} section={section} /> : item.pmName && (
          <span className="flex shrink-0 flex-col rounded-[4px] px-2 py-0.5 leading-normal" style={{ background: section.accent, color: 'var(--ui-surface-elevated)' }}>
            <span className="text-[13px] font-semibold">{item.pmName}</span>
            <span className="text-[10px]">{item.pmLabel}</span>
          </span>
        )}
      </span>
    </div>
  );
}

function Section({ section, onOpen }: { section: BoardSection; onOpen: (item: BoardCardItem) => void }) {
  const empty = section.items.length === 0;
  return (
    <div className={`flex flex-col ${empty ? 'gap-1.5' : 'gap-7'}`}>
      <div className="flex items-center gap-1">
        <span className="size-2 shrink-0 rounded-full" style={{ background: section.labelColor ?? section.accent }} />
        <span className="min-w-0 flex-1 text-[12px] font-bold uppercase tracking-wide leading-normal" style={{ color: section.labelColor ?? section.accent }}>
          {section.label}
        </span>
      </div>
      {empty ? (
        <p className="m-0 truncate rounded-[8px] p-3 text-[12px] leading-normal" style={{ background: section.bg, color: section.accent }}>
          {section.emptyLabel}
        </p>
      ) : (
        section.items.map(item => <Card key={item.id} item={item} section={section} onOpen={onOpen} />)
      )}
    </div>
  );
}

type Preset = '' | 'week' | 'month';
const PRESETS = [{ value: '', label: 'All dates' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }];
const DATE_INPUT = 'h-9 rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 text-[13px] font-medium text-ui-body outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(p: Preset): [string, string] {
  if (!p) return ['', ''];
  const now = new Date();
  if (p === 'month') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return [iso(start), iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))];
}

// Figma "Page heading" (node 376:31511).
function PageHead({ from, to, preset, canCreateTask, onFrom, onTo, onPreset }: {
  from: string; to: string; preset: Preset; canCreateTask: boolean;
  onFrom: (v: string) => void; onTo: (v: string) => void; onPreset: (p: Preset) => void;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'General', href: '/dashboard' }, { label: 'Dashboard', href: '/dashboard' }]} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">Dashboard</h1>
        <p className="m-0 text-[13px] text-ui-body">Keep handoffs moving. Clear the blockers before they affect delivery.</p>
      </div>
      <div
        className="flex flex-wrap items-end gap-3"
        title="Project cards: delivery date. Opportunity cards: date it became an opportunity (ClickUp creation date). Cards with no date are hidden while a filter is set."
      >
        <label className="flex flex-col gap-[5px] text-[11px] leading-[1.35] text-ui-body">
          From
          <input type="date" value={from} onChange={e => onFrom(e.target.value)} className={DATE_INPUT} />
        </label>
        <label className="flex flex-col gap-[5px] text-[11px] leading-[1.35] text-ui-body">
          To
          <input type="date" value={to} onChange={e => onTo(e.target.value)} className={DATE_INPUT} />
        </label>
        <FilterSelect
          aria-label="Date range" value={preset} options={PRESETS} onValueChange={v => onPreset((v ?? '') as Preset)}
          className="h-9 w-auto rounded-[6px] border-ui-divider bg-ui-input-bg text-[13px] font-medium text-ui-body dark:rounded-[6px] dark:border-ui-divider dark:bg-ui-input-bg"
        />
        {canCreateTask && (
          <Link href="/sales-tasks" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-3 text-[13px] font-medium text-ui-btn-accent-fg no-underline hover:brightness-95">
            <Plus size={16} aria-hidden /> Create task
          </Link>
        )}
      </div>
    </div>
  );
}

function Column({ column, onOpen }: { column: BoardColumn; onOpen: (item: BoardCardItem) => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] bg-ui-surface p-2.5">
      <div className="flex h-[105px] items-center justify-center rounded-[11px] py-[13px]" style={{ background: column.headerColor }}>
        <CroppedLogo src={column.logoSrc} code={column.logoCode} className="h-[62px]" />
      </div>
      {/* No fixed/stretched height — each column is exactly as tall as its own content. */}
      <div className="flex flex-col gap-4 rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
        {column.sections.map(section => (
          <Section key={section.key} section={section} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function BranchBoard({ columns, assignees, canEdit, canCreateTask, top, trustError, users = [], canAssign = false }: {
  columns: BoardColumn[];
  /** Everyone who can be picked in a Trust card's "Assign to", and whether this viewer may. */
  users?: { id: string; full_name: string }[];
  canAssign?: boolean;
  /** Why the Trust System sections are empty, when it couldn't be read. */
  trustError?: string | null;
  canCreateTask: boolean;
  /** Greeting, My Tasks and KPIs: they sit between the page heading and the board. */
  top: React.ReactNode;
  // Same "marketingAssignees" list /leads passes into this popup (profiles that can own an
  // opportunity) and the same canEdit gate that page computes from the viewer's role — both
  // decided server-side in app/(platform)/dashboard/page.tsx, not guessed here.
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
}) {
  const [openProjectId, setOpenProjectId] = React.useState<string | null>(null);
  const [assigned, setAssigned] = React.useState<Record<string, string | null>>({});
  const assignOptions = React.useMemo(() => users.map(u => ({ value: u.id, label: u.full_name })), [users]);
  const assign = React.useCallback(async (item: BoardCardItem, userId: string | null) => {
    if (!item.assign) return;
    const key = assignKey(item);
    const before = key in assigned ? assigned[key] : item.assign.userId;
    if (before === userId) return;
    setAssigned(a => ({ ...a, [key]: userId }));
    try {
      const res = await fetch('/api/tlines-dashboard/assignee', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKind: item.assign.kind, itemId: item.id, stage: item.assign.stage, label: item.assign.label, userId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not save');
    } catch (e) {
      setAssigned(a => ({ ...a, [key]: before }));
      toast.error(e instanceof Error ? e.message : 'Could not save the assignment');
    }
  }, [assigned]);
  const assignCtx = React.useMemo(() => ({ options: assignOptions, canAssign, assigned, assign }), [assignOptions, canAssign, assigned, assign]);
  const [openOpportunityId, setOpenOpportunityId] = React.useState<string | null>(null);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('');

  const handleOpen = (item: BoardCardItem) => {
    if (item.kind === 'project') setOpenProjectId(item.id);
    else if (item.kind === 'opportunity') setOpenOpportunityId(item.id);
  };

  const filteredColumns = React.useMemo(() => {
    if (!dateFrom && !dateTo) return columns;
    const inRange = (d: string | null) => {
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    return columns.map(column => {
      const sections = column.sections.map(s => ({ ...s, items: s.items.filter(i => inRange(i.dateISO)) }));
      return { ...column, sections };
    });
  }, [columns, dateFrom, dateTo]);

  const applyPreset = (p: Preset) => {
    const [from, to] = presetRange(p);
    setPreset(p); setDateFrom(from); setDateTo(to);
  };

  return (
    <AssignContext.Provider value={assignCtx}>
      <PageHead
        from={dateFrom} to={dateTo} preset={preset} canCreateTask={canCreateTask} onPreset={applyPreset}
        onFrom={v => { setDateFrom(v); setPreset(''); }} onTo={v => { setDateTo(v); setPreset(''); }}
      />
      {top}
      {trustError && (
        <p role="status" className="m-0 rounded-[8px] px-3 py-2 text-[13px] font-medium" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
          Trust System couldn’t be read — Finalization to Shipped are empty: {trustError}
        </p>
      )}
      {columns.length === 0 ? (
        <EmptyState
          boxed
          icon={<MapPinOff />}
          title="No branch is assigned to your account yet"
          description="Ask an admin to set your region on the Team page."
        />
      ) : (
        // items-start: columns must NOT stretch to match the tallest one (grid's default).
        <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {filteredColumns.map(column => (
            <Column key={column.regionCode} column={column} onOpen={handleOpen} />
          ))}
        </div>
      )}
      <ProjectQuickView projectId={openProjectId} onClose={() => setOpenProjectId(null)} />
      {openOpportunityId && (
        <OpportunityQuickView
          opportunityId={openOpportunityId}
          kind="opportunity"
          assignees={assignees}
          canEdit={canEdit}
          onClose={() => setOpenOpportunityId(null)}
        />
      )}
    </AssignContext.Provider>
  );
}
