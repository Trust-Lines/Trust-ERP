'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BRANCHES, CONFIDENCES, SCOPES, STATUSES, alertOf, durationDays, fmtDate, headcount, statusNeedsUpdate,
  suggestedStatus, teamHeadcount, teamLabel, type Clash, type EditableField, type InstallTeam, type Installation, type RowPatch,
} from '@/lib/installations/compute';
import { AlertPill, BRANCH_COLOR, ProjectNo, SCOPE_COLOR, STATUS_TONE, TH } from './shared';

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
};

const CELL = 'border-b border-r border-ui-divider p-0 align-middle text-[12px]';
const AUTO = 'bg-[#F3F6FA] dark:bg-[rgba(255,255,255,0.03)]';
const INPUT = 'h-8 w-full min-w-0 border-0 bg-transparent px-2 text-[12px] text-ui-heading outline-none focus:bg-ui-surface-elevated focus:shadow-[inset_0_0_0_2px_var(--ui-focus-ring)]';

// The workbook's Project Register: one row per installation, edited in place like a sheet.
// White cells are typed; tinted cells (Duration, Last Updated, Alert, Suggested Status,
// Double-Booking) fill in by themselves.
export function RegisterTab({ rows, today, clashes, canEdit, projectByNo, onSave, onAdd, onEdit, onDelete, pmNames, teams }: Props) {
  const cols: { label: string; w: number; auto?: boolean; title?: string }[] = [
    { label: 'Project #', w: 108 }, { label: 'Project / Store Name', w: 170 }, { label: 'Branch', w: 78 },
    { label: 'City / State', w: 84 }, { label: 'Planned Start', w: 132 }, { label: 'Planned Finish', w: 132 },
    { label: 'Duration (days)', w: 74, auto: true }, { label: 'Assigned Team', w: 240 }, { label: 'Team Members', w: 78, title: 'Counted from the names in brackets; otherwise the number typed here' },
    { label: 'Installation Scope / Company', w: 158 }, { label: 'Assigned Project Manager', w: 130 }, { label: 'Confidence', w: 110 },
    { label: 'Project Status', w: 124 }, { label: 'Dependencies / Blockers', w: 220 }, { label: 'Notes', w: 240 },
    { label: 'Last Updated', w: 96, auto: true }, { label: 'Alert (auto)', w: 190, auto: true }, { label: 'Suggested Status (auto)', w: 130, auto: true },
    { label: 'Installer Double-Booking (auto)', w: 220, auto: true },
  ];

  return (
    <div className="flex flex-col gap-2">
      <datalist id="inst-pm-names">{pmNames.map(n => <option key={n} value={n} />)}</datalist>

      <div className="max-h-[calc(100dvh-260px)] overflow-auto rounded-[8px] border border-ui-divider bg-ui-surface">
        <table className="border-separate border-spacing-0" style={{ width: cols.reduce((n, c) => n + c.w, canEdit ? 72 : 0) }}>
          <colgroup>{cols.map(c => <col key={c.label} style={{ width: c.w }} />)}{canEdit && <col style={{ width: 72 }} />}</colgroup>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.label} title={c.title} className={cn(TH, 'whitespace-normal border-r border-white/15 align-bottom leading-tight', c.auto && 'bg-[#2C5F8A] dark:bg-primary-600', i === 0 && 'left-0 z-[3]')}>{c.label}</th>
              ))}
              {canEdit && <th className={TH} aria-label="Edit or delete" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const alert = alertOf(r, today);
              const suggested = suggestedStatus(r, today);
              const clash = clashes.get(r.id);
              const badDates = !!(r.planned_start && r.planned_finish && r.planned_finish < r.planned_start);
              const save = (field: EditableField) => (v: string | number | null) => onSave(r.id, { [field]: v });
              return (
                <tr key={r.id} className="group hover:[&>td]:bg-ui-hover-bg/40">
                  <td className={cn(CELL, 'sticky left-0 z-[2] bg-ui-surface')}>
                    {canEdit ? <TextCell value={r.project_no} onCommit={save('project_no')} placeholder="#" bold /> : <span className="px-2"><ProjectNo row={r} projectByNo={projectByNo} /></span>}
                  </td>
                  <td className={CELL}><TextCell value={r.project_name} onCommit={save('project_name')} readOnly={!canEdit} /></td>
                  <td className={CELL}>
                    <SelectCell value={r.branch} options={BRANCHES} onCommit={save('branch')} readOnly={!canEdit}
                      color={r.branch ? BRANCH_COLOR[r.branch] : undefined} />
                  </td>
                  <td className={CELL}><TextCell value={r.city_state} onCommit={save('city_state')} readOnly={!canEdit} /></td>
                  <td className={cn(CELL, r.planned_start && !r.planned_finish && 'bg-[var(--status-t10-bg)]')}>
                    <DateCell value={r.planned_start} onCommit={save('planned_start')} readOnly={!canEdit} />
                  </td>
                  <td className={cn(CELL, ((r.planned_start && !r.planned_finish) || badDates) && 'bg-[var(--status-t10-bg)]')} title={badDates ? 'Finish is before start' : r.planned_start && !r.planned_finish ? 'Add the finish date — the duration and the Gantt need both' : undefined}>
                    <DateCell value={r.planned_finish} onCommit={save('planned_finish')} readOnly={!canEdit} />
                  </td>
                  <td className={cn(CELL, AUTO, 'px-2 text-center font-semibold')}>{durationDays(r) ?? ''}</td>
                  <td className={CELL}>
                    <TeamCell row={r} teams={teams} readOnly={!canEdit} onPick={t => onSave(r.id, t ? { team_id: t.id, team: teamLabel(t), team_size: teamHeadcount(t) } : { team_id: null, team: null })} />
                  </td>
                  <td className={CELL}>
                    <NumberCell value={r.team_size} shown={headcount(r)} onCommit={save('team_size')} readOnly={!canEdit || !!r.team_id} />
                  </td>
                  <td className={CELL}>
                    <SelectCell value={r.scope} options={SCOPES} onCommit={save('scope')} readOnly={!canEdit}
                      color={r.scope ? SCOPE_COLOR[r.scope.toUpperCase()] : undefined} />
                  </td>
                  <td className={CELL}><TextCell value={r.pm_name} onCommit={save('pm_name')} readOnly={!canEdit} list="inst-pm-names" placeholder="TBD" /></td>
                  <td className={CELL}><SelectCell value={r.confidence} options={CONFIDENCES} onCommit={save('confidence')} readOnly={!canEdit} /></td>
                  <td className={cn(CELL, r.status && STATUS_TONE[r.status])}>
                    <SelectCell value={r.status} options={STATUSES} onCommit={save('status')} readOnly={!canEdit} plain />
                  </td>
                  <td className={CELL}><TextCell value={r.blockers} onCommit={save('blockers')} readOnly={!canEdit} wrap /></td>
                  <td className={CELL}><TextCell value={r.notes} onCommit={save('notes')} readOnly={!canEdit} wrap /></td>
                  <td className={cn(CELL, AUTO, 'px-2 text-[11px] text-ui-text-secondary')}>{fmtDate(r.updated_at?.slice(0, 10) ?? null)}</td>
                  <td className={cn(CELL, AUTO, 'px-2')}>{alert && <AlertPill tone={alert.tone} text={alert.text} />}</td>
                  <td className={cn(CELL, AUTO, 'px-2', statusNeedsUpdate(r, today) && 'bg-[#FFF1D6] dark:bg-[#5C4410]')} title={statusNeedsUpdate(r, today) ? 'Differs from the status entered' : undefined}>
                    <span className="text-[12px] italic">{suggested ?? ''}</span>
                  </td>
                  <td className={cn(CELL, AUTO, 'px-2', clash && 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]')}>
                    {clash && (
                      <span className="block truncate text-[11px] font-semibold" title={clash.map(c => `${c.projectNo}: ${c.people.join(', ')}`).join('\n')}>
                        Clashes with {clash.map(c => c.projectNo).join(', ')}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className={cn(CELL, 'whitespace-nowrap text-center')}>
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
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + (canEdit ? 1 : 0)} className="p-6 text-center text-[12px] italic text-ui-text-secondary">No projects match these filters.</td></tr>
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

// ── cells ─────────────────────────────────────────────────────────────────────────────────────
// Each cell keeps its own draft and saves on Enter / leaving the cell (Esc puts it back).

function TextCell({ value, onCommit, readOnly, list, placeholder, bold, wrap }: {
  value: string | null; onCommit: (v: string | null) => void; readOnly?: boolean; list?: string; placeholder?: string; bold?: boolean; wrap?: boolean;
}) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  if (readOnly) return <span className={cn('block px-2 py-1.5', wrap ? 'whitespace-pre-wrap break-words' : 'truncate', bold && 'font-semibold')}>{value || ''}</span>;
  const commit = () => { const v = draft.trim(); if (v !== (value ?? '')) onCommit(v || null); };
  return (
    <input
      value={draft} list={list} placeholder={placeholder} title={draft || undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); e.currentTarget.blur(); } }}
      className={cn(INPUT, bold && 'font-semibold', 'placeholder:text-ui-text-secondary/60')}
    />
  );
}

function DateCell({ value, onCommit, readOnly }: { value: string | null; onCommit: (v: string | null) => void; readOnly?: boolean }) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  if (readOnly) return <span className="block px-2 py-1.5">{fmtDate(value)}</span>;
  const commit = () => { if (draft !== (value ?? '')) onCommit(draft || null); };
  return (
    <input type="date" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); e.currentTarget.blur(); } }}
      className={cn(INPUT, 'pr-1')} />
  );
}

function NumberCell({ value, shown, onCommit, readOnly }: { value: number | null; shown: number; onCommit: (v: number | null) => void; readOnly?: boolean }) {
  const [draft, setDraft] = React.useState(String(value ?? ''));
  React.useEffect(() => setDraft(String(value ?? '')), [value]);
  const fromNames = shown !== (value ?? 0);
  if (readOnly) return <span className="block px-2 py-1.5 text-center font-semibold">{shown}</span>;
  const commit = () => {
    const t = draft.trim();
    const n = t === '' ? null : Number(t);
    if (n !== null && (!Number.isInteger(n) || n < 0)) { setDraft(String(value ?? '')); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <span className="relative block" title={fromNames ? `${shown} named in the team` : undefined}>
      <input inputMode="numeric" value={fromNames ? String(shown) : draft} readOnly={fromNames}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={cn(INPUT, 'text-center font-semibold', fromNames && 'cursor-default text-ui-body')} />
    </span>
  );
}

function SelectCell({ value, options, onCommit, readOnly, color, plain }: {
  value: string | null; options: readonly string[]; onCommit: (v: string | null) => void; readOnly?: boolean; color?: string; plain?: boolean;
}) {
  const filled = !!(value && color);
  if (readOnly) {
    return filled
      ? <span className="m-1 inline-flex h-6 items-center rounded-[4px] px-1.5 text-[11px] font-bold uppercase text-white" style={{ background: color }}>{value}</span>
      : <span className="block px-2 py-1.5 font-medium">{value ?? ''}</span>;
  }
  return (
    <select
      value={value ?? ''} onChange={e => onCommit(e.target.value || null)}
      className={cn(INPUT, 'cursor-pointer appearance-auto pr-1', filled && 'font-bold uppercase text-white focus:text-ui-heading', plain && 'bg-transparent font-medium')}
      style={filled ? { background: color } : undefined}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

/** Assigned Team: pick a saved team (Teams tab). A row typed before teams existed shows its text
 *  until a team is picked. */
function TeamCell({ row, teams, readOnly, onPick }: {
  row: Installation; teams: InstallTeam[]; readOnly?: boolean; onPick: (t: InstallTeam | null) => void;
}) {
  const label = row.team || 'TBD';
  if (readOnly) return <span className={cn('block truncate px-2 py-1.5', !row.team && 'text-ui-text-secondary')} title={label}>{label}</span>;
  const legacy = !row.team_id && !!row.team;
  return (
    <select
      value={row.team_id ?? (legacy ? '__legacy' : '')}
      title={label}
      onChange={e => { const v = e.target.value; if (v === '__legacy') return; onPick(v ? teams.find(t => t.id === v) ?? null : null); }}
      className={cn(INPUT, 'cursor-pointer appearance-auto pr-1', !row.team && 'text-ui-text-secondary', legacy && 'italic')}
    >
      <option value="">TBD</option>
      {legacy && <option value="__legacy">{row.team} (not a saved team)</option>}
      {teams.filter(t => t.active || t.id === row.team_id).map(t => (
        <option key={t.id} value={t.id}>{teamLabel(t)}</option>
      ))}
    </select>
  );
}
