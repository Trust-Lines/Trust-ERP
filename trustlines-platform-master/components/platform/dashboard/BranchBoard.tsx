'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, MapPinOff, Pause, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import { toast } from 'sonner';
import { BoardItemView } from './BoardItemView';
import type { TrustItem } from '@/lib/trust/board';
import { SERVICE_LINES } from '@/lib/regions';

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
  /** The card's two people for the stage it's in (board_assignees, per stage): the Trust PM
   *  (userId) and the T-Lines PM (tlinesUserId). */
  assign?: { kind: string; stage: string; label: string; userId: string | null; tlinesUserId?: string | null };
  /** The project number ("490") — the popup gathers everything we hold for it. */
  projectNo?: string | null;
  /** The Trust System's types for that number (PO + PF, Production, Shipping tabs). */
  trustItems?: TrustItem[] | null;
  /** The client this card belongs to, for the "Accounts" view (key client, else its own name). */
  account?: { key: string; name: string };
  /** Which of our companies it is (SERVICE_LINES value: store_maker / premium_store_fitout / design_build). */
  company?: string | null;
}

/** Who a card is assigned to: its Trust PM, or its T-Lines PM. */
type AssignRole = 'trust_pm' | 'tlines_pm';
const ROLE_LABEL: Record<AssignRole, string> = { trust_pm: 'Trust PM', tlines_pm: 'T-Lines PM' };
/** The stage key a role is stored under (board_assignees.stage): the Trust PM keeps the plain
 *  stage (every assignment made before there were two), the T-Lines PM gets ":tlines_pm". */
const roleStage = (stage: string, role: AssignRole) => (role === 'tlines_pm' ? `${stage}:tlines_pm` : stage);
const assignKey = (item: BoardCardItem, role: AssignRole) =>
  `${item.assign?.kind}:${item.id}:${roleStage(item.assign?.stage ?? '', role)}`;

/** "Assign to" on the cards — every active user, chosen from the design-system Select. */
const AssignContext = React.createContext<{
  options: { value: string; label: string }[];
  canAssign: boolean;
  assigned: Record<string, string | null>;
  assign: (item: BoardCardItem, role: AssignRole, userId: string | null) => void;
}>({ options: [], canAssign: false, assigned: {}, assign: () => {} });

const UNASSIGNED = '';

function AssignBox({ item, section, role }: { item: BoardCardItem; section: BoardSection; role: AssignRole }) {
  const { options, canAssign, assigned, assign } = React.useContext(AssignContext);
  const key = assignKey(item, role);
  const saved = role === 'tlines_pm' ? item.assign?.tlinesUserId ?? null : item.assign?.userId ?? null;
  const current = key in assigned ? assigned[key] : saved;
  const name = options.find(o => o.value === current)?.label ?? null;
  // Figma "id-badge" (node 572:29260): solid stage tone, white text.
  return (
    <span
      className="flex min-w-0 max-w-[170px] shrink flex-col justify-center rounded-[6px] px-2.5 py-1 leading-normal text-white"
      style={{ background: section.solid ?? section.accent }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <span className="text-[10px] opacity-90">{ROLE_LABEL[role]}:</span>
      {canAssign ? (
        <FilterSelect
          aria-label={`${ROLE_LABEL[role]} for ${item.assign?.label ?? ''}`}
          options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...options]}
          value={current ?? UNASSIGNED}
          onValueChange={v => assign(item, role, v || null)}
          className="h-auto min-h-0 gap-0.5 border-0 bg-transparent p-0 text-[13px] font-semibold leading-normal text-white hover:border-0 dark:border-0 dark:bg-transparent dark:p-0 dark:text-white [&_svg]:size-3.5"
        />
      ) : (
        <span className="truncate text-[13px] font-semibold">{name ?? 'Unassigned'}</span>
      )}
    </span>
  );
}

/** Companies filter: our own companies (lib/regions SERVICE_LINES), All Companies first, and
 *  "No company" for cards nothing tells us the company of (blank ClickUp Industry, Trust-only). */
const NO_COMPANY = '__none';
/** People filters: "Unassigned". */
const NOBODY = '__nobody';
const COMPANY_OPTIONS = [
  { value: '', label: 'All Companies' },
  ...SERVICE_LINES.map(s => ({ value: s.value, label: s.label })),
  { value: NO_COMPANY, label: 'No company' },
];

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
        {item.assign ? (
          <span className="flex min-w-0 shrink-0 items-end gap-1.5">
            <AssignBox item={item} section={section} role="trust_pm" />
            <AssignBox item={item} section={section} role="tlines_pm" />
          </span>
        ) : item.pmName && (
          <span className="flex max-w-[170px] shrink-0 flex-col rounded-[6px] px-2.5 py-1 leading-normal text-white" style={{ background: solid }}>
            <span className="text-[10px] opacity-90">{item.pmLabel}:</span>
            <span className="truncate text-[13px] font-semibold">{item.pmName}</span>
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
type BoardView = 'stages' | 'accounts';
const VIEW_KEY = 'tl_board_view';

function ViewToggle({ view, onView }: { view: BoardView; onView: (v: BoardView) => void }) {
  const opt = (v: BoardView, label: string) => (
    <button
      type="button" aria-pressed={view === v} onClick={() => onView(v)}
      // Selected = solid navy with white text (dark mode: the light solid), so it reads at a glance.
      className={`h-[30px] cursor-pointer rounded-[5px] border-0 px-3 text-[13px] transition-colors ${view === v ? 'bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent font-medium text-ui-body hover:bg-ui-hover-bg hover:text-ui-heading'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Group cards by" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-ui-divider bg-ui-input-bg p-[2px]">
      {opt('stages', 'Stages')}
      {opt('accounts', 'Accounts')}
    </div>
  );
}

/** The board's date filter (From / To / preset), shown in the filter bar above the columns. */
function DateFilters({ from, to, preset, onFrom, onTo, onPreset }: {
  from: string; to: string; preset: Preset;
  onFrom: (v: string) => void; onTo: (v: string) => void; onPreset: (p: Preset) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2.5"
      title="Project cards: delivery date. Opportunity cards: date it became an opportunity (ClickUp creation date). Cards with no date are hidden while a filter is set."
    >
      <label className="flex items-center gap-1.5 text-[11px] leading-[1.35] text-ui-body">
        From
        <input type="date" value={from} onChange={e => onFrom(e.target.value)} className={DATE_INPUT} />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] leading-[1.35] text-ui-body">
        To
        <input type="date" value={to} onChange={e => onTo(e.target.value)} className={DATE_INPUT} />
      </label>
      <FilterSelect
        aria-label="Date range" value={preset} options={PRESETS} onValueChange={v => onPreset((v ?? '') as Preset)}
        className="h-9 w-auto rounded-[6px] border-ui-divider bg-ui-input-bg text-[13px] font-medium text-ui-body dark:rounded-[6px] dark:border-ui-divider dark:bg-ui-input-bg"
      />
    </div>
  );
}

function PageHead({ canCreateTask, heading = 'T-Lines PM Board', subheading = 'Keep handoffs moving. Clear the blockers before they affect delivery.' }: {
  canCreateTask: boolean; heading?: string; subheading?: string;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'T-Lines PM', href: '/tlines-pm' }, { label: 'Board', href: '/tlines-pm' }]} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{heading}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subheading}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canCreateTask && (
          <Link href="/sales-tasks" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-ui-btn-accent px-3 text-[13px] font-medium text-ui-btn-accent-fg no-underline hover:brightness-95">
            <Plus size={16} aria-hidden /> Create task
          </Link>
        )}
      </div>
    </div>
  );
}

interface AccountGroup { key: string; name: string; count: number; sections: BoardSection[] }

/** One column's cards regrouped by client: most cards first, each keeping the stage order inside. */
function accountGroups(column: BoardColumn): AccountGroup[] {
  const groups = new Map<string, { name: string; count: number; bySection: Map<string, BoardCardItem[]> }>();
  for (const section of column.sections) {
    for (const item of section.items) {
      const key = item.account?.key ?? `n:${item.title.trim().toLowerCase()}`;
      const name = item.account?.name ?? item.title;
      let g = groups.get(key);
      if (!g) { g = { name, count: 0, bySection: new Map() }; groups.set(key, g); }
      g.count += 1;
      const list = g.bySection.get(section.key);
      if (list) list.push(item); else g.bySection.set(section.key, [item]);
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key, name: g.name, count: g.count,
      sections: column.sections.filter(s => g.bySection.has(s.key)).map(s => ({ ...s, items: g.bySection.get(s.key)! })),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function Account({ group, color, collapsed, onToggle, onOpen }: {
  group: AccountGroup; color: string; collapsed: boolean; onToggle: () => void; onOpen: OpenCard;
}) {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  // Inside an account every stage starts open; each stage bar folds only its own stage.
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set());
  const toggleStage = (key: string) => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Same build as a stage bar (Section), in the branch colour: the client's bar, then its stages
  // full width underneath — so the Accounts view reads exactly like the Stages view.
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <button
        type="button" aria-expanded={!collapsed} onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-1 rounded-[6px] border-0 px-2 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.18)] text-left text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
        style={{ background: color }}
      >
        <span aria-hidden className="size-1 shrink-0 rounded-full bg-white" />
        <span className="min-w-0 truncate text-[15px] font-bold uppercase leading-normal">{group.name}</span>
        <span className="flex-1 shrink-0 text-right text-[13px] font-semibold uppercase leading-normal tracking-[1.3px]">{group.count}</span>
        <Icon size={16} aria-hidden className="shrink-0" />
      </button>
      {!collapsed && group.sections.map(section => (
        <Section key={section.key} section={section} open={!closed.has(section.key)} onToggle={() => toggleStage(section.key)} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** A branch column card: logo header pinned on top, and the card itself is the scroll box. */
function ColumnShell({ column, children }: { column: BoardColumn; children: React.ReactNode }) {
  // A column is at most one screen tall (screen minus the 80px top bar and a small gap) — a fixed
  // CSS height, never re-measured while the page scrolls, so the page's own length never changes
  // under the wheel. What doesn't fit scrolls inside the column; at its end the wheel carries on
  // to the page (no overscroll-contain), so the page never feels stuck.
  // overflow-y-scroll: the scrollbar track is always there, so a column looks the same whether
  // its stages overflow or not (no width jump when a stage opens).
  return (
    <div className="flex min-h-0 flex-col rounded-[16px] bg-ui-surface px-2.5 pb-2.5 max-h-[calc(100dvh-96px)] overflow-y-scroll overflow-x-hidden [scrollbar-width:thin]">
      {/* Logo header stays pinned at the top of its column; only the stages scroll under it.
          The wrapper's own padding + background cover the cards as they pass beneath. */}
      <div className="sticky top-0 z-10 shrink-0 bg-ui-surface pb-2.5 pt-2.5">
        <div className="flex h-[105px] items-center justify-center rounded-[11px] py-[13px]" style={{ background: column.headerColor }}>
          {column.title
            ? <span className="px-3 text-center text-[20px] font-semibold leading-tight text-white">{column.title}</span>
            : <CroppedLogo src={column.logoSrc} code={column.logoCode} className="h-[62px]" />}
        </div>
      </div>
      {children}
    </div>
  );
}

function Column({ column, isOpen, onToggle, onOpen, accounts }: {
  column: BoardColumn; isOpen: (key: string, index: number) => boolean; onToggle: (key: string, index: number) => void; onOpen: OpenCard;
  /** Accounts view: this column's client groups and which ones are folded. */
  accounts?: { groups: AccountGroup[]; collapsed: Set<string>; toggle: (key: string) => void } | null;
}) {
  if (accounts) {
    return (
      <ColumnShell column={column}>
        {/* One white panel, like the Stages view. */}
        <div className="flex shrink-0 flex-col gap-4 rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
          {accounts.groups.length === 0 ? (
            <p className="m-0 p-1 text-[12px] text-ui-body">No Active Projects</p>
          ) : accounts.groups.map(g => {
            const key = `${column.regionCode}|${g.key}`;
            return (
              <Account key={g.key} group={g} color={column.headerColor} collapsed={accounts.collapsed.has(key)}
                onToggle={() => accounts.toggle(key)} onOpen={onOpen} />
            );
          })}
        </div>
      </ColumnShell>
    );
  }
  return (
    <ColumnShell column={column}>
      <div className="flex shrink-0 flex-col gap-4 rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
        {column.sections.map((section, i) => (
          <Section key={section.key} section={section} open={isOpen(`${column.regionCode}:${section.key}`, i)} onToggle={() => onToggle(`${column.regionCode}:${section.key}`, i)} onOpen={onOpen} />
        ))}
      </div>
    </ColumnShell>
  );
}

// Figma "View tabs" (node 572:29189) controls: same look as the Leads page filters.
const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading [&_svg]:size-3.5';
const HIDDEN_COLS_KEY = 'dashboard.hiddenColumns.v1';

/** Branch buttons: one per column, in the branch's own colour with its logo. Each click shows /
 *  hides that column; any number can be on. Off = faded. The last one on can't be turned off. */
function ColumnButtons({ columns, hidden, onToggle }: {
  columns: BoardColumn[]; hidden: Set<string>; onToggle: (code: string) => void;
}) {
  return (
    <div role="group" aria-label="Branches shown" className="flex flex-wrap items-center gap-2">
      {columns.map(c => {
        const shown = !hidden.has(c.regionCode);
        const last = shown && columns.filter(x => !hidden.has(x.regionCode)).length === 1;
        const label = c.name ?? c.title ?? c.regionCode;
        return (
          <button
            key={c.regionCode} type="button" aria-pressed={shown} aria-label={label} title={label}
            disabled={last} onClick={() => onToggle(c.regionCode)}
            className={`flex h-11 min-w-[120px] items-center justify-center rounded-[8px] border-2 border-solid px-4 transition-[opacity,filter,box-shadow] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring ${shown ? 'border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.18)]' : 'border-transparent opacity-35 grayscale-[40%] hover:opacity-60'} ${last ? 'cursor-default' : 'cursor-pointer hover:brightness-110'}`}
            style={{ background: c.headerColor }}
          >
            {c.title
              ? <span className="text-[13px] font-semibold text-white">{c.title}</span>
              : <CroppedLogo src={c.logoSrc} code={c.logoCode} className="h-[26px]" />}
          </button>
        );
      })}
    </div>
  );
}

function Board({ columns, onOpen, accounts }: {
  columns: BoardColumn[]; onOpen: OpenCard;
  /** Offer the "Accounts" view. */
  accounts: boolean;
}) {
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('');
  const applyPreset = (p: Preset) => {
    const [from, to] = presetRange(p);
    setPreset(p); setDateFrom(from); setDateTo(to);
  };

  // Which of our companies to show ('' = All Companies, the default).
  const [company, setCompany] = React.useState('');

  // People filters: by the card's Trust PM and by its T-Lines PM ('' = everyone, NOBODY = unassigned).
  const { options: people, assigned } = React.useContext(AssignContext);
  const [trustPm, setTrustPm] = React.useState('');
  const [tlinesPm, setTlinesPm] = React.useState('');
  const trustPmOptions = React.useMemo(() => [{ value: '', label: 'All Trust PMs' }, { value: NOBODY, label: 'Unassigned' }, ...people], [people]);
  const tlinesPmOptions = React.useMemo(() => [{ value: '', label: 'All T-Lines PMs' }, { value: NOBODY, label: 'Unassigned' }, ...people], [people]);
  /** A card's person for a role, as shown on it now (including picks made on this page). A
   *  project card has no Trust PM; its T-Lines PM is the project's own PM. */
  const personOf = React.useCallback((i: BoardCardItem, role: AssignRole): string | null => {
    if (i.assign) {
      const key = assignKey(i, role);
      if (key in assigned) return assigned[key];
      return role === 'tlines_pm' ? i.assign.tlinesUserId ?? null : i.assign.userId;
    }
    if (role === 'tlines_pm' && i.pmName) return people.find(p => p.label === i.pmName)?.value ?? null;
    return null;
  }, [assigned, people]);

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

  // Stage bars: every stage starts open. Each bar folds / opens only its own stage in its own
  // column — keyed by column + stage.
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});
  const isOpen = (key: string, _index: number) => toggled[key] ?? true;
  const onToggle = (key: string, _index: number) => setToggled(t => ({ ...t, [key]: !(t[key] ?? true) }));


  const visible = React.useMemo(() => {
    const inRange = (d: string | null) => {
      if (!dateFrom && !dateTo) return true;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const byPerson = (i: BoardCardItem, role: AssignRole, want: string) =>
      !want || (want === NOBODY ? !personOf(i, role) : personOf(i, role) === want);
    const keep = (i: BoardCardItem) =>
      inRange(i.dateISO) && (!company || (company === NO_COMPANY ? !i.company : i.company === company))
      && byPerson(i, 'trust_pm', trustPm) && byPerson(i, 'tlines_pm', tlinesPm);
    const shown = columns.filter(c => !hidden.has(c.regionCode));
    return (shown.length ? shown : columns).map(column => ({
      ...column,
      sections: column.sections.map(s => ({ ...s, items: s.items.filter(keep) })),
    }));
  }, [columns, hidden, dateFrom, dateTo, company, trustPm, tlinesPm, personOf]);

  // Stages / Accounts, remembered per browser. Every account starts open; a click folds it.
  const [view, setView] = React.useState<BoardView>('stages');
  React.useEffect(() => {
    try { if (accounts && localStorage.getItem(VIEW_KEY) === 'accounts') setView('accounts'); } catch { /* storage blocked */ }
  }, [accounts]);
  const changeView = (v: BoardView) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  };
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const toggleAccount = React.useCallback((key: string) => setCollapsed(c => {
    const next = new Set(c);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), []);
  const showAccounts = accounts && view === 'accounts';
  const groupsByColumn = React.useMemo(
    () => (showAccounts ? new Map(visible.map(c => [c.regionCode, accountGroups(c)])) : null),
    [showAccounts, visible],
  );
  const allKeys = React.useMemo(
    () => (groupsByColumn ? [...groupsByColumn.entries()].flatMap(([region, gs]) => gs.map(g => `${region}|${g.key}`)) : []),
    [groupsByColumn],
  );
  const allFolded = allKeys.length > 0 && allKeys.every(k => collapsed.has(k));
  const collapseAll = groupsByColumn && allKeys.length > 0
    ? { label: allFolded ? 'Expand all' : 'Collapse all', run: () => setCollapsed(allFolded ? new Set() : new Set(allKeys)) }
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Every board filter sits here, right above the columns. */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2.5 rounded-[8px] bg-ui-surface px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {accounts && <ViewToggle view={view} onView={changeView} />}
          <FilterSelect aria-label="Companies" value={company} options={COMPANY_OPTIONS} onValueChange={v => setCompany(v ?? '')} className={FILTER_CLS} />
          <FilterSelect aria-label="Trust PM" value={trustPm} options={trustPmOptions} onValueChange={v => setTrustPm(v ?? '')} className={FILTER_CLS} />
          <FilterSelect aria-label="T-Lines PM" value={tlinesPm} options={tlinesPmOptions} onValueChange={v => setTlinesPm(v ?? '')} className={FILTER_CLS} />
          <ColumnButtons columns={columns} hidden={hidden} onToggle={toggleColumn} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DateFilters
            from={dateFrom} to={dateTo} preset={preset} onPreset={applyPreset}
            onFrom={v => { setDateFrom(v); setPreset(''); }} onTo={v => { setDateTo(v); setPreset(''); }}
          />
          {collapseAll && (
            <button type="button" onClick={collapseAll.run}
              className="h-9 rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 text-[13px] font-medium text-ui-body hover:text-ui-heading">
              {collapseAll.label}
            </button>
          )}
        </div>
      </div>
      {/* items-start: columns must NOT stretch to match the tallest one (grid's default). */}
      <div
        className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--board-cols),minmax(0,1fr))]"
        style={{ '--board-cols': visible.length } as React.CSSProperties}
      >
        {visible.map(column => (
          <Column
            key={column.regionCode} column={column} isOpen={isOpen} onToggle={onToggle} onOpen={onOpen}
            accounts={groupsByColumn ? { groups: groupsByColumn.get(column.regionCode) ?? [], collapsed, toggle: toggleAccount } : null}
          />
        ))}
      </div>
    </div>
  );
}

export function BranchBoard({ columns, assignees, canEdit, canCreateTask, top, trustError, users = [], canAssign = false, heading, subheading, accounts = false }: {
  /** Offer the "Accounts" view: each column's cards grouped by client, biggest client first. */
  accounts?: boolean;
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
  const assign = React.useCallback(async (item: BoardCardItem, role: AssignRole, userId: string | null) => {
    if (!item.assign) return;
    const key = assignKey(item, role);
    const saved = role === 'tlines_pm' ? item.assign.tlinesUserId ?? null : item.assign.userId;
    const before = key in assigned ? assigned[key] : saved;
    if (before === userId) return;
    setAssigned(a => ({ ...a, [key]: userId }));
    try {
      const res = await fetch('/api/tlines-dashboard/assignee', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKind: item.assign.kind, itemId: item.id, stage: item.assign.stage, role, label: item.assign.label, userId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not save');
    } catch (e) {
      setAssigned(a => ({ ...a, [key]: before }));
      toast.error(e instanceof Error ? e.message : 'Could not save the assignment');
    }
  }, [assigned]);
  const assignCtx = React.useMemo(() => ({ options: assignOptions, canAssign, assigned, assign }), [assignOptions, canAssign, assigned, assign]);
  const handleOpen: OpenCard = (item, section) => setOpen({ item, section });

  return (
    <AssignContext.Provider value={assignCtx}>
      <PageHead heading={heading} subheading={subheading} canCreateTask={canCreateTask} />
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
        <Board columns={columns} onOpen={handleOpen} accounts={accounts} />
      )}
      {open && <BoardItemView item={open.item} section={open.section} assignees={assignees} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </AssignContext.Provider>
  );
}
