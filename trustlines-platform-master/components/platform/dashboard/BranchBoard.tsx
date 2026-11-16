'use client';

import { MultiFilter } from '@/components/platform/production/MultiFilter';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardGantt, type DashboardGanttData } from './DashboardGantt';
import { BriefcaseBusiness, CalendarDays, ChartGantt, Columns3, ChevronDown, ChevronRight, CircleCheck, Factory, MapPinOff, Pause, Plus, UserRound, Wrench } from 'lucide-react';
import { StatTile } from './StatTile';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { Select as FilterSelect } from '@/components/ui/select';
import { toast } from 'sonner';
import { BoardItemView } from './BoardItemView';
import { BranchLogo } from './BranchLogo';
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
  /** Installation team shown on the card (set by the board when known). */
  teamName?: string | null;
  /** T-Lines PM of a card without "Assign to" (installation, delivered project). */
  tlinesPmId?: string | null;
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
  /** Every user, to name whoever is already assigned. */
  options: { value: string; label: string }[];
  /** Who can be picked / filtered by: T-Lines PMs only. */
  pmOptions: { value: string; label: string }[];
  canAssign: boolean;
  assigned: Record<string, string | null>;
  assign: (item: BoardCardItem, role: AssignRole, userId: string | null) => void;
}>({ options: [], pmOptions: [], canAssign: false, assigned: {}, assign: () => {} });

const UNASSIGNED = '';

function AssignBox({ item, section, role }: { item: BoardCardItem; section: BoardSection; role: AssignRole }) {
  const { options, pmOptions, canAssign, assigned, assign } = React.useContext(AssignContext);
  const key = assignKey(item, role);
  const saved = role === 'tlines_pm' ? item.assign?.tlinesUserId ?? null : item.assign?.userId ?? null;
  const current = key in assigned ? assigned[key] : saved;
  const name = options.find(o => o.value === current)?.label ?? null;
  // Figma "id-badge" (node 818:12783 / 818:31931): hairline border in the stage tone, text in the
  // stage tone, 6px label over a 9px name.
  return (
    <span
      className="flex min-w-0 max-w-[220px] flex-1 flex-col justify-center gap-0.5 rounded-[6px] border border-solid px-2.5 py-1.5 leading-normal"
      style={{ borderColor: section.accent, color: section.accent }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <span className="text-[10px] font-medium opacity-80">{ROLE_LABEL[role]}</span>
      {canAssign ? (
        <FilterSelect
          aria-label={`${ROLE_LABEL[role]} for ${item.assign?.label ?? ''}`}
          options={[{ value: UNASSIGNED, label: 'Unassigned' }, ...pmOptions,
            // Someone assigned before who isn't a T-Lines PM: still shown, so the pick isn't lost.
            ...(current && !pmOptions.some(o => o.value === current) ? options.filter(o => o.value === current) : [])]}
          value={current ?? UNASSIGNED}
          onValueChange={v => assign(item, role, v || null)}
          className="h-auto min-h-0 gap-0.5 border-0 bg-transparent p-0 text-[13px] font-semibold leading-normal text-[inherit] hover:border-0 dark:border-0 dark:bg-transparent dark:p-0 dark:text-[inherit] [&_svg]:size-3.5"
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
  /** A person's column (PM columns): photo, name, role and card count in the header. */
  person?: { userId: string | null; subtitle: string };
  /** Shown in the Columns menu (e.g. "T-Lines North East"). */
  name?: string;
  logoSrc: string;
  logoCode: string;
  headerColor: string;
  /** Secondary account-strip colour from the Figma branch palette. */
  accountAltColor?: string;
  sections: BoardSection[];
  /** A text header instead of the branch logo (the Trust Lines dashboard's stage columns). */
  title?: string;
}

/** "2026-05-26" → ["MAY", "26", "2026"] for the card's date tile (no time-zone shift). */
function dateParts(iso: string | null): [string, string, string] | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  return [month, m[3], m[1]];
}

function PeopleBox({ label, name, color }: { label: string; name: string; color: string }) {
  return (
    <span className="flex min-w-0 max-w-[150px] flex-col rounded-[4px] border-[0.5px] border-solid px-1.5 py-0.5 leading-normal" style={{ borderColor: color }} title={name}>
      <span className="text-[6px]">{label}:</span>
      <span className="truncate text-[9px] font-semibold">{name}</span>
    </span>
  );
}

function Card({ item, section, onOpen }: {
  item: BoardCardItem; section: BoardSection; onOpen: OpenCard;
}) {
  // Cards hold the Assign to dropdown, so no card is a <button> (a control can't sit inside one).
  // Figma card (node 818:12773 / 818:12797): stage tint (grey when On Hold), number badge in the
  // stage tone beside a 16px title, people boxes, 10px address, and a white tile on the right
  // with the date (MAY / 26 / 2026) or "On Hold".
  const fg = section.accent;
  const tint = section.bg;
  const date = dateParts(item.dateISO);
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-full cursor-pointer items-stretch justify-between gap-2 rounded-[4px] px-1.5 py-2.5 text-left transition-[filter,box-shadow] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
      style={{ background: item.onHold ? 'var(--board-hold-bg)' : tint, color: fg }}
      onClick={() => onOpen(item, section)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item, section); } }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[14px] font-medium leading-normal"
            style={{ background: fg, color: tint }}
          >
            {[item.badgeTop, item.badgeBottom].filter(Boolean).join(' ')}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[16px] font-bold leading-[1.1]">{item.title}</span>
            {item.category && <span className="truncate text-[10px] font-medium leading-normal">{item.category}</span>}
          </span>
        </span>
        {item.statuses && item.statuses.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.statuses.map(s => (
              <span key={s} className="inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold leading-none"
                style={{ background: fg, color: tint }}>
                {s}
              </span>
            ))}
          </span>
        )}
        {item.assign ? (
          <span className="mt-1 flex w-full min-w-0 items-stretch gap-2">
            <AssignBox item={item} section={section} role="trust_pm" />
            <AssignBox item={item} section={section} role="tlines_pm" />
          </span>
        ) : (item.pmName || item.teamName) && (
          // Figma card people boxes (818:30410): side by side, 6px label over a 9px name.
          <span className="flex min-w-0 items-center gap-1.5">
            {item.pmName && <PeopleBox label={item.pmLabel} name={item.pmName} color={fg} />}
            {item.teamName && <PeopleBox label="Team" name={item.teamName} color={fg} />}
          </span>
        )}
        {(item.subtitle || item.note) && (
          <span className="min-w-0">
            {item.subtitle && <span className="block truncate text-[10px] leading-normal">{item.subtitle}</span>}
            {item.note && <span className="block text-[10px] font-bold leading-normal">{item.note}</span>}
          </span>
        )}
      </span>
      {(item.onHold || date) && (
        <span className="flex w-16 shrink-0 items-center justify-center rounded-[4px] bg-ui-surface-elevated px-1.5 py-px">
          {item.onHold ? (
            <span className="flex items-center gap-0.5 text-[10px] font-medium leading-normal" style={{ color: 'var(--board-hold-fg)' }}>
              <Pause size={10} aria-hidden /> On Hold
            </span>
          ) : date && (
            <span className="flex flex-col items-center gap-1 whitespace-nowrap text-center" aria-label={item.dateLabel ?? undefined}>
              <span className="text-[14px] leading-[10px] tracking-[-0.308px]">{date[0]}</span>
              <span className="text-[24px] font-semibold leading-[18px]">{date[1]}</span>
              <span className="text-[12px] leading-[10px]">{date[2]}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

type OpenCard = (item: BoardCardItem, section: BoardSection) => void;

// Figma stage block (node 818:12765): a dashed outline in the stage tone around a tinted stage
// bar (dot, uppercase label, count, chevron that opens / closes the stage) and its cards.
function Section({ section, open, onToggle, onOpen, variant = 'stages' }: {
  section: BoardSection; open: boolean; onToggle: () => void; onOpen: OpenCard;
  /** 'account' = a stage inside an account (Figma 818:35938): no dot, 8 px padding, and the
   *  dashed outline only while the stage is open. */
  variant?: 'stages' | 'account';
}) {
  const empty = section.items.length === 0;
  const Chevron = open ? ChevronDown : ChevronRight;
  const fg = section.labelColor ?? section.accent;
  const inAccount = variant === 'account';
  const outlined = !inAccount || open;
  return (
    <div
      className={`flex shrink-0 flex-col gap-2 rounded-[5px] ${outlined ? 'border border-dashed' : ''}`}
      style={outlined ? { borderColor: section.accent } : undefined}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-center gap-1 rounded-[4px] border-0 ${inAccount ? 'p-2' : 'px-1 py-2'} text-left transition-[filter] hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring`}
        style={{ background: section.bg, color: fg }}
      >
        {!inAccount && <span aria-hidden className="size-1 shrink-0 rounded-full" style={{ background: fg }} />}
        <span className="min-w-0 truncate text-[14px] font-semibold uppercase leading-normal">{section.label}</span>
        <span className="flex-1 shrink-0 text-right text-[13px] font-semibold uppercase leading-normal tracking-[1.3px]">{section.items.length}</span>
        <Chevron size={16} aria-hidden className="shrink-0" />
      </button>
      {open && (empty ? (
        <p className="m-0 truncate px-2 pb-2 text-[12px] leading-normal" style={{ color: section.accent }}>
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
const DATE_INPUT = 'h-9 w-[124px] rounded-[6px] border border-ui-divider bg-ui-input-bg py-0 pl-9 pr-2 text-[13px] font-medium text-ui-body outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring [&::-webkit-calendar-picker-indicator]:opacity-0';
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
    <div role="group" aria-label="Group cards by" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-[2px]">
      {opt('stages', 'Stages')}
      {opt('accounts', 'Accounts')}
    </div>
  );
}

/** /dashboard Gantt view: on for people who may open the installation plan (page.installation). */
export interface BoardGantt {
  /** The Gantt is showing (URL ?gantt=1). */
  active: boolean;
  /** Where the toggle goes: the Gantt view when off, the board when on. */
  href: string;
  /** Loaded by the server only while the Gantt is showing. */
  data: DashboardGanttData | null;
}

// "View as Gantt chart" — swaps the branch board for the lifecycle Gantt in place. The data is
// read on the server only while the Gantt shows, so the toggle is a navigation (?gantt=1); the
// button shows it is working and the chart area its loading rows until the server answers.
function GanttToggle({ gantt, pending, onGo }: { gantt: BoardGantt; pending: boolean; onGo: () => void }) {
  const Icon = gantt.active ? Columns3 : ChartGantt;
  return (
    <button
      type="button" onClick={onGo} aria-pressed={gantt.active} aria-busy={pending} disabled={pending}
      className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border px-3 text-[13px] font-semibold leading-[1.4] transition-colors disabled:cursor-wait disabled:opacity-70 ${gantt.active
        ? 'border-transparent bg-[var(--ui-btn-solid)] text-[var(--ui-btn-solid-fg)]'
        : 'border-[var(--ui-input-border)] bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading'}`}
    >
      <Icon size={16} aria-hidden />
      {gantt.active ? 'View as board' : 'View as Gantt chart'}
    </button>
  );
}

// Columns by region (the branch logos) or by T-Lines PM: one column per PM with the cards they
// look after in every region, the PM's name in the header. Remembered per browser.
// 'pms' = by T-Lines PM, 'trust_pms' = by Trust Lines PM (the card's Trust PM).
type ColumnsBy = 'regions' | 'pms' | 'trust_pms';
const COLUMNS_BY_KEY = 'tl_board_columns_by';
const PM_COLORS = ['#465B6D', '#3B472B', '#2E5BA3', '#7A655E', '#5B4B8A', '#8A5A2B', '#2F6F6A', '#7A3E55'];
const UNASSIGNED_COLOR = '#6B7280';

function ColumnsByToggle({ by, onBy }: { by: ColumnsBy; onBy: (v: ColumnsBy) => void }) {
  const opt = (v: ColumnsBy, label: string) => (
    <button
      type="button" aria-pressed={by === v} onClick={() => onBy(v)}
      className={`h-[30px] cursor-pointer rounded-[5px] border-0 px-3 text-[13px] transition-colors ${by === v ? 'bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent font-medium text-ui-body hover:bg-ui-hover-bg hover:text-ui-heading'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Columns by" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-[2px]">
      {opt('regions', 'Regions')}
      {opt('pms', 'T-Lines PMs')}
      {opt('trust_pms', 'Trust Lines PMs')}
    </div>
  );
}

/** Regroup the region columns into one column per PM (T-Lines or Trust Lines; Unassigned last), keeping the stages. */
function pmColumns(columns: BoardColumn[], pmOf: (i: BoardCardItem) => string | null, nameOf: (id: string) => string, subtitle: string): BoardColumn[] {
  const order: BoardSection[] = [];
  for (const c of columns) for (const s of c.sections) if (!order.some(o => o.key === s.key)) order.push(s);
  const byPm = new Map<string, Map<string, BoardCardItem[]>>();
  for (const c of columns) for (const s of c.sections) for (const item of s.items) {
    const pm = pmOf(item) ?? NOBODY;
    const sections = byPm.get(pm) ?? new Map<string, BoardCardItem[]>();
    sections.set(s.key, [...(sections.get(s.key) ?? []), item]);
    byPm.set(pm, sections);
  }
  const ids = [...byPm.keys()].filter(id => id !== NOBODY).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (byPm.has(NOBODY)) ids.push(NOBODY);
  return ids.map((id, i) => ({
    regionCode: `pm:${id}`,
    title: id === NOBODY ? 'Unassigned' : nameOf(id),
    name: id === NOBODY ? 'No PM' : nameOf(id),
    person: { userId: id === NOBODY ? null : id, subtitle: id === NOBODY ? 'No PM assigned' : subtitle },
    logoSrc: '', logoCode: '',
    headerColor: id === NOBODY ? UNASSIGNED_COLOR : PM_COLORS[i % PM_COLORS.length],
    sections: order.map(s => ({ ...s, items: byPm.get(id)!.get(s.key) ?? [] })),
  }));
}

/** The board's date filter (From / To / preset), shown in the filter bar above the columns. */
function DateFilters({ from, to, preset, onFrom, onTo, onPreset, stacked = false }: {
  from: string; to: string; preset: Preset;
  onFrom: (v: string) => void; onTo: (v: string) => void; onPreset: (p: Preset) => void;
  /** Figma "Date range" (767:13865): the From / To labels sit above their fields. */
  stacked?: boolean;
}) {
  const labelCls = stacked
    ? 'flex flex-col gap-[5px] text-[11px] leading-[1.35] text-ui-body'
    : 'flex items-center gap-1.5 text-[11px] leading-[1.35] text-ui-body';
  return (
    <div
      className={stacked ? 'flex flex-wrap items-end gap-3' : 'flex flex-wrap items-center gap-2.5'}
      title="Project cards: delivery date. Opportunity cards: date it became an opportunity (ClickUp creation date). Cards with no date are hidden while a filter is set."
    >
      <label className={labelCls}>
        From
        <span className="relative">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-ui-body" />
          <input type="date" value={from} onChange={e => onFrom(e.target.value)} className={DATE_INPUT} />
        </span>
      </label>
      <label className={labelCls}>
        To
        <span className="relative">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-ui-body" />
          <input type="date" value={to} onChange={e => onTo(e.target.value)} className={DATE_INPUT} />
        </span>
      </label>
      <FilterSelect
        aria-label="Date range" value={preset} options={PRESETS} onValueChange={v => onPreset((v ?? '') as Preset)}
        className={`h-9 w-auto rounded-[6px] bg-ui-input-bg text-[13px] font-medium text-ui-body dark:rounded-[6px] dark:bg-ui-input-bg ${stacked ? 'border-ui-divider dark:border-ui-divider' : 'border-[var(--ui-input-border)] dark:border-[var(--ui-input-border)]'}`}
      />
    </div>
  );
}

type Crumb = { label: string; href: string };
const BOARD_CRUMBS: Crumb[] = [{ label: 'T-Lines PM', href: '/tlines-pm' }, { label: 'Board', href: '/tlines-pm' }];
// Figma "General Manager" page heading (node 767:13860).
const DASHBOARD_CRUMBS: Crumb[] = [{ label: 'General', href: '/dashboard' }, { label: 'Dashboard', href: '/dashboard' }];

function PageHead({ canCreateTask, heading = 'T-Lines PM Board', subheading = 'Keep handoffs moving. Clear the blockers before they affect delivery.', crumbs = BOARD_CRUMBS, dates }: {
  canCreateTask: boolean; heading?: string; subheading?: string; crumbs?: Crumb[];
  /** Dashboard layout: the date range sits in the heading, left of Create task (Figma 767:13865). */
  dates?: React.ReactNode;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={crumbs} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{heading}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subheading}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {dates}
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

/** The account bar's badge: the project number when every card of the client shares one, else
 *  the card count (Figma shows a number like "#SM507" there). */
function accountBadge(group: AccountGroup): string {
  const nos = new Set(group.sections.flatMap(s => s.items.map(i => [i.badgeTop, i.badgeBottom].filter(Boolean).join(' '))));
  return nos.size === 1 ? [...nos][0] : String(group.count);
}

function Account({ group, color, altColor, shade, collapsed, onToggle, onOpen }: {
  group: AccountGroup; color: string; altColor?: string;
  /** Every other bar uses the branch's second Figma colour (818:30797 / 30967 / 31137 / 31309). */
  shade: boolean;
  collapsed: boolean; onToggle: () => void; onOpen: OpenCard;
}) {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  // Figma Accounts view (818:35912): inside an account every stage starts folded; a stage bar
  // opens only its own stage.
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const toggleStage = (key: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const bg = shade ? (altColor ?? color) : color;
  const badge = accountBadge(group);
  return (
    <div className="-mx-3 flex shrink-0 flex-col gap-2">
      {/* Figma account bar: full-width flat strip, white number badge in the bar colour, name, chevron. */}
      <button
        type="button" aria-expanded={!collapsed} onClick={onToggle}
        aria-label={`${group.name}, ${group.count} ${group.count === 1 ? 'card' : 'cards'}`}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 p-2 text-left text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring"
        style={{ background: bg }}
      >
        <span className="flex min-w-0 items-center gap-1">
          <span className="flex h-[18px] shrink-0 items-center justify-center whitespace-nowrap rounded-[4px] bg-white px-1.5 py-0.5 text-[14px] font-medium leading-normal" style={{ color: bg }}>
            {badge}
          </span>
          <span className="min-w-0 truncate text-[12px] font-semibold uppercase leading-normal">{group.name}</span>
        </span>
        <Icon size={16} aria-hidden className="shrink-0" />
      </button>
      {!collapsed && (
        // Its stages, indented behind a thin rail (Figma "Line 156").
        <div className="mx-3 flex gap-2">
          <span aria-hidden className="w-px shrink-0 self-stretch bg-ui-divider" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {group.sections.map(section => (
              <Section key={section.key} variant="account" section={section} open={open.has(section.key)} onToggle={() => toggleStage(section.key)} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Figma PM column header (845:43825): photo, name over role, card count in a pale chip — on the
 *  column's own colour. The count follows the board filters (the column is already filtered). */
function PersonHeader({ column }: { column: BoardColumn }) {
  const count = column.sections.reduce((n, s) => n + s.items.length, 0);
  const name = column.title ?? column.name ?? '';
  return (
    <span className="flex w-full min-w-0 items-center gap-2 px-5">
      <Avatar userId={column.person?.userId ?? undefined} name={column.person?.userId ? name : undefined}
        className="h-[51px] w-[52px] rounded-[4px] bg-[var(--ui-page-bg)] text-[18px] text-ui-heading" />
      <span className="flex min-w-0 flex-1 flex-col justify-center p-1 text-[var(--color-secondary-50)]">
        <span className="truncate text-[24px] font-semibold leading-normal">{name}</span>
        <span className="truncate text-[12px] font-medium leading-[1.35]">{column.person?.subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-secondary-50)] px-2 py-1 text-[20px] font-medium leading-normal tabular-nums"
        style={{ color: column.headerColor }} aria-label={`${count} cards`}>
        {count}
      </span>
    </span>
  );
}

/** A branch column card. The compact board uses an inner scroll box; the General Manager frame
 * expands every stage down the document and relies on normal page scrolling. */
function ColumnShell({ column, children, pageScroll = false }: { column: BoardColumn; children: React.ReactNode; pageScroll?: boolean }) {
  // A column is at most one screen tall (screen minus the 80px top bar and a small gap) — a fixed
  // CSS height, never re-measured while the page scrolls, so the page's own length never changes
  // under the wheel. What doesn't fit scrolls inside the column; at its end the wheel carries on
  // to the page (no overscroll-contain), so the page never feels stuck.
  // overflow-y-scroll: the scrollbar track is always there, so a column looks the same whether
  // its stages overflow or not (no width jump when a stage opens).
  return (
    <div className={`flex min-h-0 flex-col rounded-[16px] border border-ui-divider bg-ui-surface px-2.5 pb-2.5 ${pageScroll ? 'overflow-hidden' : 'max-h-[calc(100dvh-96px)] overflow-y-scroll overflow-x-hidden [scrollbar-width:thin]'}`}>
      {/* Logo header stays pinned at the top of its column; only the stages scroll under it.
          The wrapper's own padding + background cover the cards as they pass beneath. */}
      <div className="sticky top-0 z-10 shrink-0 bg-ui-surface pb-2.5 pt-2.5">
        <div className="flex h-[105px] items-center justify-center rounded-[11px] py-[13px]" style={{ background: column.headerColor }}>
          {column.person
            ? <PersonHeader column={column} />
            : column.title
            ? <span className="px-3 text-center text-[20px] font-semibold leading-tight text-white">{column.title}</span>
            // Figma branch header (818:31889): logo block ~116 × 67 px inside the 105 px bar.
            : <BranchLogo code={column.logoCode} />}
        </div>
      </div>
      {children}
    </div>
  );
}

function Column({ column, isOpen, onToggle, onOpen, accounts, pageScroll = false }: {
  column: BoardColumn; isOpen: (key: string, index: number) => boolean; onToggle: (key: string, index: number) => void; onOpen: OpenCard;
  pageScroll?: boolean;
  /** Accounts view: this column's client groups and which ones are folded. */
  accounts?: { groups: AccountGroup[]; expanded: Set<string>; toggle: (key: string) => void } | null;
}) {
  if (accounts) {
    return (
      <ColumnShell column={column} pageScroll={pageScroll}>
        {/* One panel, like the Stages view; Figma 818:35912: 8 px between account bars, which run
            edge to edge of the panel (-mx-3 cancels its side padding). */}
        <div className="flex shrink-0 flex-col gap-2 overflow-hidden rounded-[11px] bg-ui-surface-elevated px-3 pb-3.5 pt-2">
          {accounts.groups.length === 0 ? (
            <p className="m-0 p-1 text-[12px] text-ui-body">No Active Projects</p>
          ) : accounts.groups.map((g, i) => {
            const key = `${column.regionCode}|${g.key}`;
            return (
              <Account key={g.key} group={g} color={column.headerColor} altColor={column.accountAltColor} shade={i % 2 === 0} collapsed={!accounts.expanded.has(key)}
                onToggle={() => accounts.toggle(key)} onOpen={onOpen} />
            );
          })}
        </div>
      </ColumnShell>
    );
  }
  return (
    <ColumnShell column={column} pageScroll={pageScroll}>
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
// Columns picked in the Branches dropdown (none = every column), remembered per browser.
const SHOWN_COLS_KEY = 'dashboard.shownColumns.v1';

/** The board's date filter state — owned by BranchBoard so the dashboard layout can show it in
 *  the page heading while the board still filters by it. */
function useDateRange() {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('');
  return {
    from, to, preset,
    onPreset: (p: Preset) => { const [f, t] = presetRange(p); setPreset(p); setFrom(f); setTo(t); },
    onFrom: (v: string) => { setFrom(v); setPreset(''); },
    onTo: (v: string) => { setTo(v); setPreset(''); },
  };
}
type DateRange = ReturnType<typeof useDateRange>;

// KPI row of the dashboard: counted from the cards the filters leave on the board.
const COUNT_TILES: { label: string; keys: string[]; icon: React.ReactNode; color: string; onColor: string }[] = [
  { label: 'Active Projects', keys: ['finalization', 'technical', 'to_production', 'in_production', 'shipped', 'ready'], icon: <BriefcaseBusiness strokeWidth={1.5} />, color: 'var(--ui-btn-solid)', onColor: 'var(--ui-surface-elevated)' },
  { label: 'Clients Opportunity', keys: ['opportunity'], icon: <UserRound strokeWidth={1.5} />, color: 'var(--status-t4-fg)', onColor: 'var(--status-t4-bg)' },
  { label: 'In Production', keys: ['to_production', 'in_production', 'shipped'], icon: <Factory strokeWidth={1.5} />, color: 'var(--status-t9-fg)', onColor: 'var(--status-t9-bg)' },
  { label: 'Installation', keys: ['installation'], icon: <Wrench strokeWidth={1.5} />, color: 'var(--status-t6-fg)', onColor: 'var(--status-t6-bg)' },
  { label: 'Completed', keys: ['completed'], icon: <CircleCheck strokeWidth={1.5} />, color: 'var(--color-success-normal)', onColor: 'var(--color-success-light)' },
];

function Board({ columns: regionColumns, onOpen, accounts, byPm: offerPm, dates, datesInBar, kpis, counts = false, pageScroll = false, gantt }: {
  columns: BoardColumn[]; onOpen: OpenCard;
  /** Dashboard: the "View as Gantt chart" toggle (absent = not offered). */
  gantt?: BoardGantt;
  /** Offer the "Accounts" view. */
  accounts: boolean;
  /** Offer columns by T-Lines PM instead of region. */
  byPm: boolean;
  dates: DateRange;
  /** Board layout: the date filter sits in this bar (dashboard layout: in the page heading). */
  datesInBar: boolean;
  /** Dashboard layout: KPI tiles between the filter bar and the columns (Figma 767:14785). */
  kpis?: React.ReactNode;
  /** Show the KPI row counted from the filtered cards (dashboard layout). */
  counts?: boolean;
  /** General Manager frame: columns expand in the page and use the Figma 16px gutter. */
  pageScroll?: boolean;
}) {
  const { from: dateFrom, to: dateTo } = dates;

  // Which of our companies to show ('' = All Companies, the default).
  const [company, setCompany] = React.useState('');
  // Leads (everyone else's open deals): their section stays hidden until this is on.
  const [showLeads, setShowLeads] = React.useState(false);
  const leadCount = React.useMemo(() => regionColumns.reduce((n, c) => n + (c.sections.find(s => s.key === 'leads')?.items.length ?? 0), 0), [regionColumns]);

  // People filters: by the card's Trust PM and by its T-Lines PM ('' = everyone, NOBODY = unassigned).
  const { options: people, pmOptions, assigned } = React.useContext(AssignContext);
  const [trustPm, setTrustPm] = React.useState('');
  const [tlinesPm, setTlinesPm] = React.useState('');
  const trustPmOptions = React.useMemo(() => [{ value: '', label: 'All Trust PMs' }, { value: NOBODY, label: 'Unassigned' }, ...pmOptions], [pmOptions]);
  const tlinesPmOptions = React.useMemo(() => [{ value: '', label: 'All T-Lines PMs' }, { value: NOBODY, label: 'Unassigned' }, ...pmOptions], [pmOptions]);
  /** A card's person for a role, as shown on it now (including picks made on this page). A
   *  project card has no Trust PM; its T-Lines PM is the project's own PM. */
  const personOf = React.useCallback((i: BoardCardItem, role: AssignRole): string | null => {
    if (i.assign) {
      const key = assignKey(i, role);
      if (key in assigned) return assigned[key];
      return role === 'tlines_pm' ? i.assign.tlinesUserId ?? null : i.assign.userId;
    }
    if (role === 'tlines_pm' && i.tlinesPmId) return i.tlinesPmId;
    if (role === 'tlines_pm' && i.pmName) return people.find(p => p.label === i.pmName)?.value ?? null;
    return null;
  }, [assigned, people]);

  const [columnsBy, setColumnsBy] = React.useState<ColumnsBy>('regions');
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(COLUMNS_BY_KEY);
      if (offerPm && (v === 'pms' || v === 'trust_pms')) setColumnsBy(v);
    } catch { /* storage blocked */ }
  }, [offerPm]);
  const changeColumnsBy = (v: ColumnsBy) => {
    setColumnsBy(v);
    try { localStorage.setItem(COLUMNS_BY_KEY, v); } catch { /* storage blocked */ }
  };
  // Gantt view: rows are installation-plan projects, so only the Branches pick and the date range
  // apply; the card filters (company, clients/leads, PMs, columns by PM) are hidden meanwhile.
  const router = useRouter();
  const [ganttPending, startGantt] = React.useTransition();
  const showGantt = !!gantt?.active;
  // Optimistic: the chart area shows its loading rows while the server reads the Gantt data.
  const openingGantt = ganttPending && !showGantt;
  const goGantt = () => { if (gantt) startGantt(() => router.push(gantt.href, { scroll: false })); };
  const byPmNow = offerPm && columnsBy !== 'regions' && !showGantt;
  const columns = React.useMemo(() => {
    if (!byPmNow) return regionColumns;
    const names = new Map(people.map(p => [p.value, p.label]));
    const role: AssignRole = columnsBy === 'trust_pms' ? 'trust_pm' : 'tlines_pm';
    return pmColumns(regionColumns, i => personOf(i, role), id => names.get(id) ?? 'Unknown', role === 'trust_pm' ? 'Trust Lines PM' : 'T-Lines PM');
  }, [byPmNow, columnsBy, regionColumns, people, personOf]);

  // Branches dropdown: the columns picked (none = all) — remembered per browser.
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOWN_COLS_KEY);
      if (raw) setPicked(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable — show every column */ }
  }, []);
  const changePicked = (next: Set<string>) => {
    setPicked(next);
    try { localStorage.setItem(SHOWN_COLS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };
  const columnOptions = React.useMemo(
    () => columns.map(c => ({ value: c.regionCode, label: c.name ?? c.title ?? c.regionCode })),
    [columns],
  );

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
    const shown = columns.filter(c => picked.has(c.regionCode));
    return (shown.length ? shown : columns).map(column => ({
      ...column,
      sections: column.sections.filter(s => showLeads || s.key !== 'leads').map(s => ({ ...s, items: s.items.filter(keep) })),
    }));
  }, [columns, picked, dateFrom, dateTo, company, showLeads, trustPm, tlinesPm, personOf]);

  // Stages / Accounts, remembered per browser. Every account starts open; a click folds it.
  const [view, setView] = React.useState<BoardView>('stages');
  React.useEffect(() => {
    try { if (accounts && localStorage.getItem(VIEW_KEY) === 'accounts') setView('accounts'); } catch { /* storage blocked */ }
  }, [accounts]);
  const changeView = (v: BoardView) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  };
  // Figma Accounts view (818:35501): every account starts folded; a click opens it.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggleAccount = React.useCallback((key: string) => setExpanded(c => {
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
  const allOpen = allKeys.length > 0 && allKeys.every(k => expanded.has(k));
  const collapseAll = groupsByColumn && allKeys.length > 0
    ? { label: allOpen ? 'Collapse all' : 'Expand all', run: () => setExpanded(allOpen ? new Set() : new Set(allKeys)) }
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Every board filter sits here, right above the columns. Dashboard: Figma "View tabs" (818:31781). */}
      <div className={`flex min-h-12 flex-wrap items-center justify-between gap-2.5 rounded-[8px] bg-ui-surface px-2 py-1.5${datesInBar ? '' : ' border border-ui-divider'}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {offerPm && <ColumnsByToggle by={columnsBy} onBy={changeColumnsBy} />}
          {accounts && <ViewToggle view={view} onView={changeView} />}
          <FilterSelect aria-label="Companies" value={company} options={COMPANY_OPTIONS} onValueChange={v => setCompany(v ?? '')} className={FILTER_CLS} />
          {leadCount > 0 && (
            <button type="button" aria-pressed={showLeads} onClick={() => setShowLeads(v => !v)}
              className={`${FILTER_CLS} pr-3 ${showLeads ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg dark:border-ui-heading' : ''}`}>
              {showLeads ? 'Hide leads' : 'Show leads'} ({leadCount})
            </button>
          )}
          <FilterSelect aria-label="Trust PM" value={trustPm} options={trustPmOptions} onValueChange={v => setTrustPm(v ?? '')} className={FILTER_CLS} />
          <FilterSelect aria-label="T-Lines PM" value={tlinesPm} options={tlinesPmOptions} onValueChange={v => setTlinesPm(v ?? '')} className={FILTER_CLS} />
          <MultiFilter label={!byPmNow ? 'Branches' : columnsBy === 'trust_pms' ? 'Trust Lines PM columns' : 'T-Lines PM columns'} options={columnOptions} selected={picked} onChange={changePicked} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {datesInBar && <DateFilters {...dates} />}
          {collapseAll && !showGantt && (
            <button type="button" onClick={collapseAll.run}
              className="h-9 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-ui-body hover:text-ui-heading">
              {collapseAll.label}
            </button>
          )}
        </div>
      </div>
      {/* Figma 818:31780: 16 px between filter bar, KPI row and columns (gap-2 + my-2). */}
      {(showGantt || openingGantt) ? (
        <div className="mt-2">
          <DashboardGantt
            data={openingGantt ? null : gantt?.data ?? null}
            branches={regionColumns.filter(c => picked.has(c.regionCode)).map(c => c.logoCode).filter(Boolean)}
            from={dateFrom} to={dateTo}
          />
        </div>
      ) : (<>
      {(counts || kpis) && (
        <div className="my-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {counts && COUNT_TILES.map(t => {
            const n = visible.reduce((sum, c) => sum + c.sections.filter(s => t.keys.includes(s.key)).reduce((a, s) => a + s.items.length, 0), 0);
            return <StatTile key={t.label} compact label={t.label} value={n} icon={t.icon} sub="Cards shown with the filters above" color={t.color} onColor={t.onColor} />;
          })}
          {kpis}
        </div>
      )}
      {/* items-start: columns must NOT stretch to match the tallest one (grid's default). */}
      <div
        className={byPmNow
          ? `grid items-start overflow-x-auto pb-2 [grid-template-columns:repeat(var(--board-cols),minmax(320px,1fr))] ${pageScroll ? 'gap-4' : 'gap-2.5'}`
          : `grid grid-cols-1 items-start sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--board-cols),minmax(0,1fr))] ${pageScroll ? 'gap-4' : 'gap-2.5'}`}
        style={{ '--board-cols': visible.length } as React.CSSProperties}
      >
        {visible.map(column => (
          <Column
            key={column.regionCode} column={column} isOpen={isOpen} onToggle={onToggle} onOpen={onOpen}
            pageScroll={pageScroll}
            accounts={groupsByColumn ? { groups: groupsByColumn.get(column.regionCode) ?? [], expanded, toggle: toggleAccount } : null}
          />
        ))}
      </div>
      </>)}
    </div>
  );
}

export function BranchBoard({ columns, assignees, canEdit, canCreateTask, top, trustError, users = [], canAssign = false, heading, subheading, accounts = false, byPm = false, layout = 'board', kpis, companyEdit = 'none' }: {
  /** 'dashboard' = Figma "General Manager" (767:13745) on /dashboard: General / Dashboard crumbs,
   *  date range in the heading, KPI tiles under the filter bar. 'board' = /tlines-pm as before. */
  layout?: 'board' | 'dashboard';
  /** Dashboard layout only: the KPI row. */
  kpis?: React.ReactNode;
  /** Offer the "Accounts" view: each column's cards grouped by client, biggest client first. */
  accounts?: boolean;
  /** Offer "T-Lines PMs" columns: one column per T-Lines PM instead of per region. */
  byPm?: boolean;
  /** Page title / sub-line (the Trust Lines dashboard has its own). */
  heading?: string;
  subheading?: string;
  columns: BoardColumn[];
  /** Everyone who can be picked in a Trust card's "Assign to", and whether this viewer may. */
  users?: { id: string; full_name: string; role?: string | null }[];
  canAssign?: boolean;
  /** Who may set a card's company in its popup: 'any' always, 'empty' only when it has none. */
  companyEdit?: 'any' | 'empty' | 'none';
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
  const pmOptions = React.useMemo(() => users.filter(u => u.role === 'tlines_pm').map(u => ({ value: u.id, label: u.full_name })), [users]);
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
  const assignCtx = React.useMemo(() => ({ options: assignOptions, pmOptions, canAssign, assigned, assign }), [assignOptions, pmOptions, canAssign, assigned, assign]);
  const handleOpen: OpenCard = (item, section) => setOpen({ item, section });
  const dates = useDateRange();
  const isDashboard = layout === 'dashboard';

  return (
    <AssignContext.Provider value={assignCtx}>
      <PageHead
        heading={heading ?? (isDashboard ? 'Dashboard' : undefined)} subheading={subheading} canCreateTask={canCreateTask}
        crumbs={isDashboard ? DASHBOARD_CRUMBS : BOARD_CRUMBS}
        dates={isDashboard && columns.length > 0 ? <DateFilters {...dates} stacked /> : undefined}
      />
      {top}
      {trustError && (
        <p role="status" className="m-0 rounded-[8px] px-3 py-2 text-[13px] font-medium" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
          Trust System couldn’t be read — Finalization to Shipped are empty: {trustError}
        </p>
      )}
      {columns.length === 0 ? (
        <>
        {kpis && <div className="mb-3">{kpis}</div>}
        <EmptyState
          boxed
          icon={<MapPinOff />}
          title="No branch is assigned to your account yet"
          description="Ask an admin to set your region on the Team page."
        />
        </>
      ) : (
        <Board columns={columns} onOpen={handleOpen} accounts={accounts} byPm={byPm} dates={dates} datesInBar={!isDashboard} kpis={kpis} counts={isDashboard} pageScroll={isDashboard} gantt={gantt} />
      )}
      {open && <BoardItemView item={open.item} section={open.section} assignees={assignees} canEdit={canEdit} companyEdit={companyEdit} onClose={() => setOpen(null)} />}
    </AssignContext.Provider>
  );
}
