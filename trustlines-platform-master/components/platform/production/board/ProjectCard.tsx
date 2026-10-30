'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import type { ApiProject, ApiRow } from '@/modules/trust-projects/lib/projects';
import type { ColumnKey } from '@/modules/trust-projects/lib/columns';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import {
  HEADING, ITEM_STATUSES, PF_SIGN_STATUSES, PO_SIGN_STATUSES, PROJECT_TONE, parseDay, showDay, statusToEnum, tl, toDay, toNumber, usd,
} from './boardShared';

export type SaveItem = (row: ApiRow, patch: Record<string, unknown>, label: string) => Promise<void>;

interface Props {
  project: ApiProject;
  rows: ApiRow[];
  canEdit: boolean;
  visible: (k: ColumnKey) => boolean;
  editable: (k: ColumnKey) => boolean;
  onSave: SaveItem;
}

// Cell select without the form-field box (the table cell is the box); trigger shows the badge.
const CELL_SELECT = 'h-auto w-auto max-w-full gap-1.5 border-0 bg-transparent px-0 hover:border-0 dark:border-0 dark:bg-transparent dark:px-0';
const TH = 'whitespace-nowrap border-b border-ui-divider px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary';
const TD = 'whitespace-nowrap border-b border-ui-divider px-2.5 py-1.5 text-[12px] text-ui-body';

const DATE_COLS: { key: ColumnKey; label: string; field: keyof ApiRow; writable: boolean }[] = [
  { key: 'std', label: 'STD', field: 'std', writable: true },
  { key: 'etd', label: 'ETD', field: 'etd', writable: true },
  { key: 'rtr', label: 'RTR', field: 'rtr', writable: false },
  { key: 'rtd', label: 'RTD', field: 'rtd', writable: true },
  { key: 'rdy', label: 'RDY', field: 'rdy', writable: false },
  { key: 'ftd', label: 'FTD', field: 'ftd', writable: true },
  { key: 'snd', label: 'SND', field: 'snd', writable: false },
];

/** One Trust System project: header (number, name, address, half, totals) + its lines. */
export function ProjectCard({ project, rows, canEdit, visible, editable, onSave }: Props) {
  const totals = rows.reduce((t, r) => ({ usd: t.usd + toNumber(r.pfUsd), tl: t.tl + toNumber(r.pfTl) }), { usd: 0, tl: 0 });
  const tone = PROJECT_TONE[project.projectNumberColor] ?? 't0';
  const can = (k: ColumnKey) => canEdit && editable(k);

  return (
    <article className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface-elevated">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ui-divider px-4 py-3">
        <span
          className="inline-flex h-9 min-w-[56px] items-center justify-center rounded-[6px] px-2.5 text-[15px] font-semibold tabular-nums"
          style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
          title="Project number colour follows the Trust System rules (urgent, container window…)"
        >
          {project.projectNumber}
        </span>
        <div className="flex min-w-[200px] flex-1 flex-col">
          <span className={cn('flex items-center gap-2 text-[14px] font-semibold leading-tight', HEADING)}>
            {project.projectName}
            {project.isUrgent && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-error-normal"><Flame size={12} aria-hidden /> Urgent</span>}
          </span>
          <span className="text-[12px] text-ui-text-secondary">{project.address || '—'}</span>
        </div>
        {project.halfOfYear && project.halfYear && (
          <span className="rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-t0-fg)]">
            {project.halfOfYear === 'FIRST_HALF' ? 'H1' : 'H2'} {project.halfYear}
          </span>
        )}
        {(visible('pfUsd') || visible('pfTl')) && (
          <div className="flex gap-4 text-right text-[12px]">
            {visible('pfUsd') && <span><span className="block text-[10px] uppercase text-ui-text-secondary">PF USD</span><b className={HEADING}>{usd(totals.usd)}</b></span>}
            {visible('pfTl') && <span><span className="block text-[10px] uppercase text-ui-text-secondary">PF TL</span><b className={HEADING}>{tl(totals.tl)}</b></span>}
          </div>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse">
          <thead className="bg-ui-surface">
            <tr>
              <th className={TH}>Type</th>
              {visible('pfCode') && <th className={TH}>PF code</th>}
              {visible('vendor') && <th className={TH}>Vendor</th>}
              {visible('orderType') && <th className={TH}>Order type</th>}
              {visible('poSignStatus') && <th className={TH}>PO sign</th>}
              {visible('pfSignStatus') && <th className={TH}>PF sign</th>}
              {visible('status') && <th className={TH}>Status</th>}
              {DATE_COLS.filter(c => visible(c.key)).map(c => <th key={c.key} className={TH}>{c.label}</th>)}
              {visible('pfUsd') && <th className={cn(TH, 'text-right')}>PF USD</th>}
              {visible('pfTl') && <th className={cn(TH, 'text-right')}>PF TL</th>}
              {visible('paymentRule') && <th className={TH}>Payment rule</th>}
              {visible('containerNo') && <th className={TH}>Container</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.itemId ?? i} className="hover:bg-ui-hover-bg">
                <td className={cn(TD, 'font-semibold', HEADING)}>{r.type}</td>
                {visible('pfCode') && <td className={cn(TD, 'font-mono text-[11.5px]')}>{r.pfCode || '—'}</td>}
                {visible('vendor') && <td className={cn(TD, 'max-w-[200px] truncate')} title={r.vendor}>{r.vendor || '—'}</td>}
                {visible('orderType') && <td className={TD}>{r.orderType || '—'}</td>}
                {visible('poSignStatus') && <td className={TD}>
                  <BadgeSelect group="trust_sign" value={r.poSignStatus} options={PO_SIGN_STATUSES} disabled={!r.itemId || !can('poSignStatus')}
                    label={`PO sign for ${r.type}`} onChange={v => onSave(r, { poSignStatus: statusToEnum(v) }, `PO sign → ${v}`)} />
                </td>}
                {visible('pfSignStatus') && <td className={TD}>
                  <BadgeSelect group="trust_sign" value={r.pfSignStatus} options={PF_SIGN_STATUSES} disabled={!r.itemId || !can('pfSignStatus')}
                    label={`PF sign for ${r.type}`} onChange={v => onSave(r, { pfSignStatus: statusToEnum(v) }, `PF sign → ${v}`)} />
                </td>}
                {visible('status') && <td className={TD} title={r.statusNote || undefined}>
                  <BadgeSelect group="trust_status" value={r.status} options={ITEM_STATUSES} disabled={!r.itemId || !can('status')}
                    label={`Status for ${r.type}`} onChange={v => onSave(r, { status: statusToEnum(v) }, `Status → ${v}`)} />
                </td>}
                {DATE_COLS.filter(c => visible(c.key)).map(c => (
                  <td key={c.key} className={TD}>
                    {c.writable && r.itemId && can(c.key) ? (
                      <DatePicker aria-label={`${c.label} for ${r.type}`} placeholder="—" className="h-7 w-[118px] text-[12px]"
                        value={parseDay(r[c.field] as string)}
                        onValueChange={d => void onSave(r, { [c.field]: toDay(d) }, `${c.label} updated`)} />
                    ) : (showDay(r[c.field] as string) || <span className="text-ui-text-secondary">—</span>)}
                  </td>
                ))}
                {visible('pfUsd') && <td className={cn(TD, 'text-right tabular-nums')}>
                  <MoneyCell value={r.pfUsd} format={usd} editable={!!r.itemId && can('pfUsd')} label={`PF USD for ${r.type}`}
                    onSave={n => onSave(r, { pfUsd: n }, 'PF USD updated')} />
                </td>}
                {visible('pfTl') && <td className={cn(TD, 'text-right tabular-nums')}>
                  <MoneyCell value={r.pfTl} format={tl} editable={!!r.itemId && can('pfTl')} label={`PF TL for ${r.type}`}
                    onSave={n => onSave(r, { pfTl: n }, 'PF TL updated')} />
                </td>}
                {visible('paymentRule') && <td className={cn(TD, 'max-w-[180px] truncate')} title={r.paymentRule}>{r.paymentRule || '—'}</td>}
                {visible('containerNo') && <td className={cn(TD, 'font-mono text-[11.5px]')}>{r.containerNo || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function BadgeSelect({ group, value, options, disabled, label, onChange }: {
  group: 'trust_sign' | 'trust_status'; value: string; options: string[]; disabled: boolean; label: string; onChange: (v: string) => void;
}) {
  if (disabled) return value ? <StatusBadge group={group} status={value} size="sm" /> : <span className="text-ui-text-secondary">—</span>;
  const opts = options.includes(value) || !value ? options : [value, ...options];
  return (
    <Select aria-label={label} className={CELL_SELECT} value={value || null} placeholder="—"
      options={opts.map(o => ({ value: o, label: o }))}
      renderOption={o => <StatusBadge group={group} status={o.value} size="sm" />}
      onValueChange={v => { if (v && v !== value) onChange(v); }} />
  );
}

function MoneyCell({ value, format, editable, label, onSave }: {
  value: string; format: (n: number) => string; editable: boolean; label: string; onSave: (n: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const n = toNumber(value);
  if (!editable) return <>{value ? format(n) : <span className="text-ui-text-secondary">—</span>}</>;
  if (!editing) {
    return (
      <button type="button" aria-label={label} onClick={() => { setDraft(value || ''); setEditing(true); }}
        className="w-full rounded-[4px] border-0 bg-transparent px-1 py-0.5 text-right hover:bg-ui-hover-bg">
        {value ? format(n) : <span className="text-ui-text-secondary">—</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const t = draft.trim().replace(/,/g, '');
    const next = t === '' ? null : Number(t);
    if (next != null && !Number.isFinite(next)) return;
    if ((next ?? 0) !== n) onSave(next);
  };
  return (
    <input autoFocus aria-label={label} inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="h-7 w-[110px] rounded-[4px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2 text-right text-[12px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring" />
  );
}
