'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Columns2, MapPinOff, Pause, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import { toast } from 'sonner';
import { BoardItemView } from './BoardItemView';
import type { TrustItem } from '@/lib/trust/board';

// Design: Figma "Tlines-Websites" → "Desktop - 17" (node 60:1139) — the 4-branch board that
// replaces the old company-wide dashboard. Each column is one real T-Lines region
// (lib/regions.ts), each row one pipeline stage. Who sees which columns is decided by the
// caller (app/(platform)/dashboard/page.tsx, via lib/access/regionScope) — this component
// only renders whatever columns it's given.
//
// Every card opens its popup in place (BoardItemView) instead of navigating off the dashboard.

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
  /** The project number ("490") — the popup gathers everything we hold for it. */
  projectNo?: string | null;
  /** The Trust System's types for that number (PO + PF, Production, Shipping tabs). */
  trustItems?: TrustItem[] | null;
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
  // Figma "id-badge" (node 572:29260): solid stage tone, white text.
  return (
    <span
      className="flex max-w-[140px] shrink-0 flex-col justify-center rounded-[4px] px-1.5 py-0.5 leading-normal text-white"
      style={{ background: section.solid ?? section.accent }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <span className="text-[6px]">Assigned to:</span>
      {canAssign ? (
        <FilterSelect
          aria-label={`Assign ${item.assign?.label ?? ''} to`}
          options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...options]}
          value={current ?? UNASSIGNED}
          onValueChange={v => assign(item, v || null)}
          className="h-auto min-h-0 gap-0.5 border-0 bg-transparent p-0 text-[9px] font-semibold leading-normal text-white hover:border-0 dark:border-0 dark:bg-transparent dark:p-0 dark:text-white [&_svg]:size-2.5"
        />
      ) : (
        <span className="truncate text-[9px] font-semibold">{name ?? 'Unassigned'}</span>
      )}
    </span>
  );
}

/** The person a card is filtered by under "Accounts": its board assignee, else its PM. */
function useCardAccount() {
  const { options, assigned } = React.useContext(AssignContext);
  return React.useCallback((item: BoardCardItem): string | null => {
    if (item.assign) {
      const key = assignKey(item);
      return key in assigned ? assigned[key] : item.assign.userId;
    }
    return item.pmName ? options.find(o => o.label === item.pmName)?.value ?? null : null;
  }, [options, assigned]);
}

export interface BoardSection {
  key: string;
  label: string;
  accent: string;   // text, dot + badges
  labelColor?: string; // section heading, when it differs from accent
  bg: string;        // section tint
  /** Strong shade in both themes — fills under white text (stage bar, badges). */
  solid?: string;
  items: BoardCardItem[];
  emptyLabel: string;
}

export interface BoardColumn {
  regionCode: string;
  /** Shown in the Columns menu (e.g. "T-Lines North East"). */
  name?: string;
  logoSrc: string;
  logoCode: string;
  headerColor: string;
  sections: BoardSection[];
  /** A text header instead of the branch logo (the Trust Lines dashboard's stage columns). */
  title?: string;
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
  item: BoardCardItem; section: BoardSection; onOpen: OpenCard;
}) {
  // Cards hold the Assign to dropdown, so no card is a <button> (a control can't sit inside one).
  // Figma card (node 572:29240): stage tint, number badge on the top edge, 16px title, 10px meta.
  const solid = section.solid ?? section.accent;
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex w-full cursor-pointer flex-col gap-[3px] rounded-[8px] pb-2.5 pl-3 pr-2.5 pt-4 text-left transition-[filter,box-shadow] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
      style={{ background: section.bg, color: section.accent }}
      onClick={() => onOpen(item, section)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item, section); } }}
    >
      <span
        className="absolute -top-3 left-[9px] flex h-5 min-w-[87px] items-center justify-center whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[14px] font-medium leading-normal text-white"
        style={{ background: solid }}
      >
        {[item.badgeTop, item.badgeBottom].filter(Boolean).join(' ')}
      </span>
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate text-[16px] font-bold leading-normal">{item.title}</span>
            {item.onHold && (
              <span className="inline-flex h-3.5 shrink-0 items-center gap-0.5 rounded-[2px] bg-ui-surface-elevated px-0.5 py-px text-[10px] font-medium leading-normal" style={{ color: 'var(--status-t0-fg)' }}>
                <Pause size={10} aria-hidden /> On Hold
              </span>
            )}
          </span>
          {item.category && <span className="block truncate text-[10px] leading-normal">{item.category}</span>}
        </span>
        {item.dateLabel && <span className="shrink-0 text-[10px] leading-normal">{item.dateLabel}</span>}
      </span>
      {item.statuses && item.statuses.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {item.statuses.map(s => (
            <span key={s} className="inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold leading-none text-white"
              style={{ background: solid }}>
              {s}
            </span>
          ))}
        </span>
      )}
      <span className="flex w-full items-end justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[10px] leading-normal">{item.subtitle}</span>
          {item.note && <span className="block text-[10px] font-bold leading-normal">{item.note}</span>}
        </span>
        {item.assign ? <AssignBox item={item} section={section} /> : item.pmName && (
          <span className="flex max-w-[140px] shrink-0 flex-col rounded-[4px] px-1.5 py-0.5 leading-normal text-white" style={{ background: solid }}>
            <span className="text-[6px]">{item.pmLabel}:</span>
            <span className="truncate text-[9px] font-semibold">{item.pmName}</span>
          </span>
        )}
      </span>
    </div>
  );
}

type OpenCard = (item: BoardCardItem, section: BoardSection) => void;

// Figma stage bar (node 572:29233): solid stage tone, dot, uppercase label, count and a chevron
// that opens / closes the stage's cards.
function Section({ section, open, onToggle, onOpen }: {
  section: BoardSection; open: boolean; onToggle: () => void; onOpen: OpenCard;
}) {
  const empty = section.items.length === 0;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="flex shrink-0 flex-col gap-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-1 rounded-[4px] border-0 px-1 py-2 text-left text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
        style={{ background: section.solid ?? section.labelColor ?? section.accent }}
      >
        <span aria-hidden className="size-1 shrink-0 rounded-full bg-white" />
        <span className="min-w-0 truncate text-[14px] font-semibold uppercase leading-normal">{section.label}</span>
        <span className="flex-1 shrink-0 text-right text-[13px] font-semibold uppercase leading-normal tracking-[1.3px]">{section.items.length}</span>
        <Chevron size={16} aria-hidden className="shrink-0" />
      </button>
      {open && (empty ? (
        <p className="-mt-4 mb-0 truncate rounded-[8px] p-3 text-[12px] leading-normal" style={{ background: section.bg, color: section.accent }}>
          {section.emptyLabel}
        </p>
      ) : (
        section.items.map(item => <Card key={item.id} item={item} section={section} onOpen={onOpen} />)
      ))}
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
function PageHead({ from, to, preset, canCreateTask, onFrom, onTo, onPreset, heading = 'Dashboard', subheading = 'Keep handoffs moving. Clear the blockers before they affect delivery.' }: {
  from: string; to: string; preset: Preset; canCreateTask: boolean; heading?: string; subheading?: string;
  onFrom: (v: string) => void; onTo: (v: string) => void; onPreset: (p: Preset) => void;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'General', href: '/dashboard' }, { label: 'Dashboard', href: '/dashboard' }]} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{heading}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subheading}</p>
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

function Column({ column, isOpen, onToggle, onOpen }: {
  column: BoardColumn; isOpen: (key: string, index: number) => boolean; onToggle: (key: string, index: number) => void; onOpen: OpenCard;
}) {
  // A column never reaches below the bottom of the screen: its max height is the space from its
  // own top to the screen's bottom (re-measured on scroll / resize). So whatever doesn't fit
  // scrolls inside the hovered column, while the page and the other columns stay where they are.
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const topBar = document.querySelector('[data-shell="topbar"]')?.getBoundingClientRect().bottom ?? 0;
      const full = window.innerHeight - topBar - 16;
      const room = window.innerHeight - Math.max(el.getBoundingClientRect().top, topBar) - 16;
      el.style.maxHeight = `${Math.round(Math.min(full, Math.max(320, room)))}px`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
    fit();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    // The whole column card (logo header + every stage) is the scroll box: the wheel over one
    // branch scrolls only that card, and overscroll-contain keeps the page and the other
    // columns still.
    <div ref={ref} className="pointer-events-auto flex min-h-0 flex-col rounded-[16px] bg-ui-surface px-2.5 pb-2.5 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]">
      {/* Logo header stays pinned at the top of its column; only the stages scroll under it.
          The wrapper's own padding + background cover the cards as they pass beneath. */}
      <div className="sticky top-0 z-10 shrink-0 bg-ui-surface pb-2.5 pt-2.5">
        <div className="flex h-[105px] items-center justify-center rounded-[11px] py-[13px]" style={{ background: column.headerColor }}>
          {column.title
            ? <span className="px-3 text-center text-[20px] font-semibold leading-tight text-white">{column.title}</span>
            : <CroppedLogo src={column.logoSrc} code={column.logoCode} className="h-[62px]" />}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-4 rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
        {column.sections.map((section, i) => (
          <Section key={section.key} section={section} open={isOpen(`${column.regionCode}:${section.key}`, i)} onToggle={() => onToggle(`${column.regionCode}:${section.key}`, i)} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

// Figma "View tabs" (node 572:29189) controls: same look as the Leads page filters.
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading [&_svg]:size-3.5';
const HIDDEN_COLS_KEY = 'dashboard.hiddenColumns.v1';

function ColumnsMenu({ columns, hidden, onToggle }: {
  columns: BoardColumn[]; hidden: Set<string>; onToggle: (code: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} className={`${FILTER_CLS} gap-2 px-3`} onClick={() => setOpen(o => !o)}>
        <Columns2 aria-hidden />
        Columns
        <ChevronDown aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1.5 max-h-80 w-56 overflow-auto rounded-xl border border-ui-divider bg-ui-surface-elevated p-1.5 shadow-lg">
            {columns.map(c => {
              const shown = !hidden.has(c.regionCode);
              // At least one column always stays on the board.
              const last = shown && columns.filter(x => !hidden.has(x.regionCode)).length === 1;
              return (
                <label key={c.regionCode} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ui-body ${last ? 'opacity-60' : 'cursor-pointer hover:bg-ui-hover-bg'}`}>
                  <Checkbox checked={shown} disabled={last} onCheckedChange={() => onToggle(c.regionCode)} />
                  {c.name ?? c.title ?? c.regionCode}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Board({ columns, dateFrom, dateTo, onOpen }: {
  columns: BoardColumn[]; dateFrom: string; dateTo: string; onOpen: OpenCard;
}) {
  const { options } = React.useContext(AssignContext);
  const accountOf = useCardAccount();
  const [account, setAccount] = React.useState('');
  const [company, setCompany] = React.useState('');

  // Columns menu — remembered per browser.
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_COLS_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable — show every column */ }
  }, []);
  const toggleColumn = (code: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    try { localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });

  // Stage bars: the first stage starts open, the rest closed (Figma). Each bar opens and closes
  // only its own stage in its own column — keyed by column + stage.
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});
  const isOpen = (key: string, index: number) => toggled[key] ?? index === 0;
  const onToggle = (key: string, index: number) => setToggled(t => ({ ...t, [key]: !(t[key] ?? index === 0) }));

  const companyOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const c of columns) for (const s of c.sections) for (const i of s.items) if (i.title) names.add(i.title);
    return [{ value: '', label: 'All Companies' }, ...[...names].sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n }))];
  }, [columns]);
  const accountOptions = React.useMemo(() => [{ value: '', label: 'Accounts' }, ...options], [options]);

  const visible = React.useMemo(() => {
    const inRange = (d: string | null) => {
      if (!dateFrom && !dateTo) return true;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const keep = (i: BoardCardItem) =>
      inRange(i.dateISO) && (!company || i.title === company) && (!account || accountOf(i) === account);
    const shown = columns.filter(c => !hidden.has(c.regionCode));
    return (shown.length ? shown : columns).map(column => ({
      ...column,
      sections: column.sections.map(s => ({ ...s, items: s.items.filter(keep) })),
    }));
  }, [columns, hidden, dateFrom, dateTo, company, account, accountOf]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2.5 rounded-[8px] bg-ui-surface px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect aria-label="Accounts" value={account} options={accountOptions} onValueChange={v => setAccount(v ?? '')} className={FILTER_CLS} />
          <FilterSelect aria-label="Companies" value={company} options={companyOptions} onValueChange={v => setCompany(v ?? '')} className={FILTER_CLS} />
        </div>
        <ColumnsMenu columns={columns} hidden={hidden} onToggle={toggleColumn} />
      </div>
      {/* items-start: columns must NOT stretch to match the tallest one (grid's default). */}
      <div
        className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--board-cols),minmax(0,1fr))]"
        style={{ '--board-cols': visible.length } as React.CSSProperties}
      >
        {visible.map(column => (
          <Column key={column.regionCode} column={column} isOpen={isOpen} onToggle={onToggle} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function BranchBoard({ columns, assignees, canEdit, canCreateTask, top, trustError, users = [], canAssign = false, heading, subheading }: {
  /** Page title / sub-line (the Trust Lines dashboard has its own). */
  heading?: string;
  subheading?: string;
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
  const [open, setOpen] = React.useState<{ item: BoardCardItem; section: BoardSection } | null>(null);
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
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('');

  const handleOpen: OpenCard = (item, section) => setOpen({ item, section });

  const applyPreset = (p: Preset) => {
    const [from, to] = presetRange(p);
    setPreset(p); setDateFrom(from); setDateTo(to);
  };

  return (
    <AssignContext.Provider value={assignCtx}>
      <PageHead
        heading={heading} subheading={subheading}
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
        <Board columns={columns} dateFrom={dateFrom} dateTo={dateTo} onOpen={handleOpen} />
      )}
      {open && <BoardItemView item={open.item} section={open.section} assignees={assignees} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </AssignContext.Provider>
  );
}
