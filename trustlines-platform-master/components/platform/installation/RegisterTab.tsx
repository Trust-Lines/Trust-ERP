'use client';

import * as React from 'react';
import { ChevronDown, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  BRANCHES, CONFIDENCES, SCOPES, STATUSES, alertOf, type InstallStatus, durationDays, fmtDate, headcount, statusNeedsUpdate,
  suggestedStatus, teamLabel, type AlertTone, type Clash, type EditableField, type InstallTeam, type Installation, type RowPatch,
} from '@/lib/installations/compute';
import { BRANCH_COLOR, HEADING, ProjectNo, SCOPE_COLOR } from './shared';

// ── columns (Figma 629:5596) ──────────────────────────────────────────────────────────────────
export const REGISTER_COLUMNS = [
  { key: 'no', label: 'Project #', w: 120, locked: true },
  { key: 'name', label: 'Project/Store', w: 170, locked: true },
  { key: 'branch', label: 'Branch', w: 110 },
  { key: 'city', label: 'City/State', w: 110 },
  { key: 'start', label: 'Planned Start', w: 158 },
  { key: 'finish', label: 'Planned Finish', w: 158 },
  { key: 'duration', label: 'Duration (Days)', w: 110 },
  { key: 'team', label: 'Assigned Team', w: 270 },
  { key: 'members', label: 'Team Members', w: 110, title: 'Counted from the names in brackets; otherwise the number typed here' },
  { key: 'scope', label: 'Installation Scope/ Company', w: 190 },
  { key: 'pm', label: 'Assigned PM', w: 150 },
  { key: 'confidence', label: 'Confidence', w: 150 },
  { key: 'status', label: 'Project Status', w: 170 },
  { key: 'blockers', label: 'Dependencies/ Blockers', w: 250 },
  { key: 'notes', label: 'Notes', w: 250 },
  { key: 'updated', label: 'Last Updated', w: 134 },
  { key: 'alert', label: 'Alert (Auto)', w: 210 },
  { key: 'suggested', label: 'Suggested Status (Auto)', w: 160 },
  { key: 'clash', label: 'Installer Double-Booking (Auto)', w: 220 },
] as const;
export type RegisterColumn = (typeof REGISTER_COLUMNS)[number]['key'];

export const REGISTER_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'start', label: 'Start date' },
  { value: 'finish', label: 'Finish date' },
] as const;
export type RegisterSort = (typeof REGISTER_SORTS)[number]['value'];

type Props = {
  rows: Installation[];
  today: string;
  clashes: Map<string, Clash[]>;
  canEdit: boolean;
  projectByNo: Record<string, string>;
  onSave: (id: string, patch: RowPatch) => void;
  onAdd: () => void;
  onEdit: (row: Installation) => void;
  teams: InstallTeam[];
  onDelete: (row: Installation) => void;
  /** The workbook kept names typed the same way; these feed the autocomplete. */
  pmNames: string[];
  sort: RegisterSort;
  hidden: Set<RegisterColumn>;
};

const sorters: Record<RegisterSort, (a: Installation, b: Installation) => number> = {
  newest: (a, b) => b.sort_order - a.sort_order,
  oldest: (a, b) => a.sort_order - b.sort_order,
  start: (a, b) => (a.planned_start ?? '9999').localeCompare(b.planned_start ?? '9999') || a.sort_order - b.sort_order,
  finish: (a, b) => (a.planned_finish ?? '9999').localeCompare(b.planned_finish ?? '9999') || a.sort_order - b.sort_order,
};

// Figma 629:5409 — the Project Register: one row per installation, edited in place. The auto
// columns (Duration, Last Updated, Alert, Suggested Status, Double-Booking) fill in by themselves.
export function RegisterTab({ rows, today, clashes, canEdit, projectByNo, onSave, onAdd, onEdit, onDelete, pmNames, teams, sort, hidden }: Props) {
  const cols = REGISTER_COLUMNS.filter(c => !hidden.has(c.key));
  const sorted = React.useMemo(() => [...rows].sort(sorters[sort]), [rows, sort]);
  const width = cols.reduce((n, c) => n + c.w, canEdit ? 80 : 0);

  return (
    <div className="flex flex-col gap-3">
      <datalist id="inst-pm-names">{pmNames.map(n => <option key={n} value={n} />)}</datalist>

      <div className="max-h-[calc(100dvh-280px)] overflow-auto rounded-[8px] border border-ui-divider bg-ui-page-bg">
        <table className="border-separate border-spacing-0" style={{ width }}>
          <colgroup>{cols.map(c => <col key={c.key} style={{ width: c.w }} />)}{canEdit && <col style={{ width: 80 }} />}</colgroup>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.key} scope="col" title={'title' in c ? c.title : undefined}
                  className={cn(HEAD, i === 0 && 'left-0 z-[3] pl-4', c.key === 'members' && 'text-center')}>
                  {c.label}
                </th>
              ))}
              {canEdit && <th className={HEAD}><span className="sr-only">Edit or delete</span></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const save = (field: EditableField) => (v: string | number | null) => onSave(r.id, { [field]: v });
              const alert = alertOf(r, today);
              const suggested = suggestedStatus(r, today);
              const clash = clashes.get(r.id);
              const badDates = !!(r.planned_start && r.planned_finish && r.planned_finish < r.planned_start);
              const missingFinish = !!(r.planned_start && !r.planned_finish);
              const cell: Record<RegisterColumn, React.ReactNode> = {
                no: canEdit
                  ? <TextCell value={r.project_no} onCommit={save('project_no')} placeholder="#" className={STRONG} />
                  : <ProjectNo row={r} projectByNo={projectByNo} />,
                name: <TextCell value={r.project_name} onCommit={save('project_name')} readOnly={!canEdit} className={STRONG} />,
                branch: <ChoiceCell value={r.branch} options={BRANCHES} onCommit={save('branch')} readOnly={!canEdit}
                  fill={r.branch ? BRANCH_COLOR[r.branch] : undefined} label="Branch" small />,
                city: <TextCell value={r.city_state} onCommit={save('city_state')} readOnly={!canEdit} className={MUTED} />,
                start: <DateCell value={r.planned_start} onCommit={save('planned_start')} readOnly={!canEdit} label="Planned start" />,
                finish: <DateCell value={r.planned_finish} onCommit={save('planned_finish')} readOnly={!canEdit} label="Planned finish"
                  invalid={badDates || missingFinish} title={badDates ? 'Finish is before start' : missingFinish ? 'Add the finish date — the duration and the Gantt need both' : undefined} />,
                duration: <span className={cn(STRONG, 'text-[14px]')}>{durationDays(r) ?? '—'}</span>,
                team: <TeamCell row={r} teams={teams} readOnly={!canEdit}
                  onPick={t => onSave(r.id, t ? { team_id: t.id, team: teamLabel(t), team_size: t.members.length || Math.max(0, t.size ?? 0) } : { team_id: null, team: null })} />,
                members: <NumberCell value={r.team_size} shown={headcount(r)} onCommit={save('team_size')} readOnly={!canEdit || !!r.team_id} />,
                scope: <ChoiceCell value={r.scope} options={SCOPES} onCommit={save('scope')} readOnly={!canEdit}
                  fill={r.scope ? SCOPE_COLOR[r.scope.toUpperCase()] : undefined} label="Installation scope" titleCase />,
                pm: <TextCell value={r.pm_name} onCommit={save('pm_name')} readOnly={!canEdit} list="inst-pm-names" placeholder="TBD" className={STRONG} />,
                confidence: <ChoiceCell value={r.confidence} options={CONFIDENCES} onCommit={save('confidence')} readOnly={!canEdit} label="Confidence" />,
                status: <ChoiceCell value={r.status} options={STATUSES} onCommit={save('status')} readOnly={!canEdit} label="Project status"
                  tone={r.status ? STATUS_VARS[r.status] : undefined} />,
                blockers: <NoteCell value={r.blockers} onCommit={save('blockers')} readOnly={!canEdit} label="Dependencies / blockers" />,
                notes: <NoteCell value={r.notes} onCommit={save('notes')} readOnly={!canEdit} label="Notes" />,
                updated: <span className="text-[14px] font-medium uppercase text-ui-text-secondary">{fmtDate(r.updated_at?.slice(0, 10) ?? null)}</span>,
                alert: alert ? <Chip className={ALERT_CHIP[alert.tone]}>{alert.text}</Chip> : null,
                suggested: suggested
                  ? <Chip className={statusNeedsUpdate(r, today) ? 'bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)]' : 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]'}
                      title={statusNeedsUpdate(r, today) ? 'Differs from the status entered' : 'Matches the status entered'}>{suggested}</Chip>
                  : null,
                clash: clash
                  ? <span className="block truncate text-[12px] font-semibold text-[var(--color-error-normal)] dark:text-[#FF8A8A]" title={clash.map(c => `${c.projectNo}: ${c.people.join(', ')}`).join('\n')}>
                      Clashes with {clash.map(c => c.projectNo).join(', ')}
                    </span>
                  : null,
              };
              return (
                <tr key={r.id} className="group">
                  {cols.map((c, i) => (
                    <td key={c.key} className={cn(TD, i === 0 && 'sticky left-0 z-[1] pl-4', c.key === 'members' && 'text-center')}>{cell[c.key]}</td>
                  ))}
                  {canEdit && (
                    <td className={cn(TD, 'whitespace-nowrap text-center')}>
                      <button type="button" onClick={() => onEdit(r)} aria-label={`Edit ${r.project_no ?? 'row'}`}
                        className="inline-grid size-7 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg hover:text-ui-heading">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => onDelete(r)} aria-label={`Delete ${r.project_no ?? 'row'}`}
                        className="inline-grid size-7 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-ui-text-secondary opacity-0 hover:bg-[var(--status-t10-bg)] hover:text-[var(--status-t10-fg)] focus-visible:opacity-100 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={cols.length + (canEdit ? 1 : 0)} className="p-8 text-center text-[13px] text-ui-text-secondary">No projects match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <button type="button" onClick={onAdd}
          className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-[6px] border border-dashed border-ui-divider bg-transparent px-3 text-[13px] font-medium text-ui-body hover:border-[var(--color-secondary-700)] hover:text-ui-heading">
          <Plus size={15} /> Add project
        </button>
      )}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────────────────────
const HEAD = 'sticky top-0 z-[2] h-[46px] border-b border-ui-divider bg-ui-surface px-2 text-left align-middle text-[12px] font-semibold leading-[1.1] text-ui-body';
const TD = 'h-[49px] border-b border-ui-divider bg-ui-page-bg px-2 py-1 align-middle text-[13px]';
const STRONG = cn('text-[13px] font-semibold', HEADING);
const MUTED = 'text-[14px] font-medium text-ui-text-secondary';
/** The outlined 30px control in the Figma rows (dates, team, confidence). */
const BOX = 'h-[30px] w-auto max-w-full gap-2.5 rounded-[4px] border border-ui-text-secondary bg-ui-input-bg text-[14px] font-medium leading-4 text-[var(--color-secondary-700)] hover:border-[var(--color-secondary-700)] dark:rounded-[4px] dark:border-ui-text-secondary dark:bg-transparent dark:text-ui-heading dark:hover:border-ui-heading [&_svg]:size-3.5';
const ALERT_CHIP: Record<AlertTone, string> = {
  red: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  amber: 'bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)]',
  blue: 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]',
};

/** Status chip colours as theme tokens (they switch for dark mode by themselves). */
const STATUS_VARS: Record<InstallStatus, string> = {
  'Not Started': 't0', 'In Progress': 't2', Completed: 't9', Delayed: 't10', 'On Hold': 't7',
};
const toneStyle = (t: string) => ({ '--chip-bg': `var(--status-${t}-bg)`, '--chip-fg': `var(--status-${t}-fg)` } as React.CSSProperties);
const TONED = 'border-transparent bg-[var(--chip-bg)] font-semibold text-[var(--chip-fg)] hover:border-transparent dark:border-transparent dark:bg-[var(--chip-bg)] dark:text-[var(--chip-fg)]';

function Chip({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) {
  return <span title={title} className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-[4px] px-4 py-2 text-[14px] font-semibold leading-4', className)}>{children}</span>;
}

// ── cells ─────────────────────────────────────────────────────────────────────────────────────
// Each typed cell keeps its own draft and saves on Enter / leaving the cell (Esc puts it back).

const INPUT = 'h-[30px] w-full min-w-0 rounded-[4px] border border-transparent bg-transparent px-1.5 outline-none hover:border-ui-divider focus:border-[var(--ui-focus-ring)] focus:bg-ui-input-bg placeholder:font-normal placeholder:text-ui-text-secondary/70';

function TextCell({ value, onCommit, readOnly, list, placeholder, className }: {
  value: string | null; onCommit: (v: string | null) => void; readOnly?: boolean; list?: string; placeholder?: string; className?: string;
}) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  if (readOnly) return <span className={cn('block truncate', className)} title={value ?? undefined}>{value || '—'}</span>;
  const commit = () => { const v = draft.trim(); if (v !== (value ?? '')) onCommit(v || null); };
  return (
    <input
      value={draft} list={list} placeholder={placeholder} title={draft || undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); e.currentTarget.blur(); } }}
      className={cn(INPUT, '-ml-1.5', className)}
    />
  );
}

/** Blockers / notes: two lines of small secondary text; Enter saves, Shift+Enter adds a line. */
function NoteCell({ value, onCommit, readOnly, label }: { value: string | null; onCommit: (v: string | null) => void; readOnly?: boolean; label: string }) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  const text = 'text-[12px] leading-[1.2] text-ui-text-secondary';
  if (readOnly) return <span className={cn('line-clamp-3 whitespace-pre-wrap', text)} title={value ?? undefined}>{value || ''}</span>;
  const commit = () => { const v = draft.trim(); if (v !== (value ?? '')) onCommit(v || null); };
  return (
    <textarea
      rows={2} value={draft} aria-label={label} title={draft || undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setDraft(value ?? ''); e.currentTarget.blur(); }
      }}
      className={cn(INPUT, text, 'block h-[40px] resize-none py-1')}
    />
  );
}

const toISO = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const fromISO = (s: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

function DateCell({ value, onCommit, readOnly, label, invalid, title }: {
  value: string | null; onCommit: (v: string | null) => void; readOnly?: boolean; label: string; invalid?: boolean; title?: string;
}) {
  if (readOnly) return <span className={MUTED}>{fmtDate(value) || '—'}</span>;
  return (
    <span className="inline-block" title={title}>
      <DatePicker
        value={fromISO(value)} aria-label={label} aria-invalid={invalid} placeholder="Set date"
        onValueChange={d => { const v = toISO(d); if (v !== value) onCommit(v); }}
        className={cn(BOX, 'flex-row-reverse justify-end px-2 dark:px-2 [&_svg]:size-4', invalid && 'border-[var(--status-t10-fg)] dark:border-[var(--status-t10-fg)]')}
      />
    </span>
  );
}

function NumberCell({ value, shown, onCommit, readOnly }: { value: number | null; shown: number; onCommit: (v: number | null) => void; readOnly?: boolean }) {
  const [draft, setDraft] = React.useState(String(value ?? ''));
  React.useEffect(() => setDraft(String(value ?? '')), [value]);
  const fromNames = shown !== (value ?? 0);
  if (readOnly) return <span className={cn(STRONG, 'text-[14px]')}>{shown}</span>;
  const commit = () => {
    const t = draft.trim();
    const n = t === '' ? null : Number(t);
    if (n !== null && (!Number.isInteger(n) || n < 0)) { setDraft(String(value ?? '')); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input inputMode="numeric" aria-label="Team members" value={fromNames ? String(shown) : draft} readOnly={fromNames}
      title={fromNames ? `${shown} named in the team` : undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={cn(INPUT, STRONG, 'mx-auto w-16 text-center text-[14px]', fromNames && 'cursor-default')} />
  );
}

const titleCaseOf = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

/** A pick-list cell on the platform Dropdown: outlined (confidence), filled with a colour (branch,
 *  scope) or tinted like a status chip (status). */
function ChoiceCell({ value, options, onCommit, readOnly, fill, tone, label, small, titleCase }: {
  value: string | null; options: readonly string[]; onCommit: (v: string | null) => void; readOnly?: boolean;
  fill?: string; tone?: string; label: string; small?: boolean; titleCase?: boolean;
}) {
  const show = (v: string) => (titleCase ? titleCaseOf(v) : v);
  const filled = !!(value && fill);
  const fillStyle = filled ? ({ '--cell-fill': fill } as React.CSSProperties) : undefined;
  const FILLED = cn('border-[var(--cell-fill)] bg-[var(--cell-fill)] text-white hover:border-[var(--cell-fill)] dark:border-[var(--cell-fill)] dark:bg-[var(--cell-fill)] dark:text-white', small ? 'text-[12px]' : '');
  const style = filled ? fillStyle : value && tone ? toneStyle(tone) : undefined;
  if (readOnly) {
    if (!value) return <span className="text-ui-text-secondary">—</span>;
    if (filled) return <span className={cn('inline-flex rounded-[4px] px-4 py-2 font-medium leading-4 text-white', small ? 'text-[12px]' : 'text-[14px]')} style={{ background: fill }}>{show(value)}</span>;
    if (tone) return <span style={toneStyle(tone)}><Chip className="bg-[var(--chip-bg)] text-[var(--chip-fg)]">{value}</Chip></span>;
    return <span className={MUTED}>{value}</span>;
  }
  const list = [{ value: '', label: '-' }, ...options.map(o => ({ value: o, label: show(o) })),
    ...(value && !options.includes(value) ? [{ value, label: show(value) }] : [])];
  return (
    <span className="inline-block max-w-full" style={style}>
      <Select
        value={value ?? ''} options={list} aria-label={label}
        onValueChange={v => { if ((v ?? '') !== (value ?? '')) onCommit(v || null); }}
        className={cn(BOX, small ? 'px-4 dark:px-4' : 'pl-4 pr-2.5 dark:pl-4 dark:pr-2.5', filled && FILLED, value && tone && TONED)}
      />
    </span>
  );
}

/** Assigned Team: pick a saved team (Teams tab). A row typed before teams existed shows its text
 *  until a team is picked. */
function TeamCell({ row, teams, readOnly, onPick }: {
  row: Installation; teams: InstallTeam[]; readOnly?: boolean; onPick: (t: InstallTeam | null) => void;
}) {
  const label = row.team || 'TBD';
  if (readOnly) return <span className={cn('block truncate text-[14px] font-medium uppercase', row.team ? HEADING : 'text-ui-text-secondary')} title={label}>{label}</span>;
  const legacy = !row.team_id && !!row.team;
  const current = row.team_id ?? (legacy ? '__legacy' : '');
  const list = [
    { value: '', label: 'TBD' },
    ...(legacy ? [{ value: '__legacy', label: `${row.team} (not a saved team)` }] : []),
    ...teams.filter(t => t.active || t.id === row.team_id).map(t => ({ value: t.id, label: teamLabel(t) })),
  ];
  return (
    <span className="inline-block max-w-full" title={label}>
      <Select
        value={current} options={list} aria-label="Assigned team"
        onValueChange={v => { const id = v ?? ''; if (id === current || id === '__legacy') return; onPick(id ? teams.find(t => t.id === id) ?? null : null); }}
        className={cn(BOX, 'max-w-[254px] pl-4 pr-2.5 uppercase dark:pl-4 dark:pr-2.5', !row.team && 'text-ui-text-secondary dark:text-ui-text-secondary', legacy && 'italic')}
      />
    </span>
  );
}

// ── toolbar pieces (rendered by InstallationClient beside the filters) ───────────────────────
export function ColumnsMenu({ hidden, onToggle }: { hidden: Set<RegisterColumn>; onToggle: (k: RegisterColumn) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading">
        <Eye size={14} aria-hidden /> Columns <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex max-h-[380px] w-64 flex-col overflow-y-auto rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1.5 shadow-03">
          {REGISTER_COLUMNS.map(c => (
            <label key={c.key} className={cn('flex h-8 items-center gap-2 rounded-[4px] px-2 text-[13px] text-ui-body hover:bg-ui-hover-bg', 'locked' in c ? 'cursor-default opacity-60' : 'cursor-pointer')}>
              <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => onToggle(c.key)} disabled={'locked' in c} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
