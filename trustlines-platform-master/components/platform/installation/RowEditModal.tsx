'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import {
  BRANCHES, CONFIDENCES, SCOPES, STATUSES, alertOf, durationDays, headcount, suggestedStatus, teamHeadcount, teamLabel,
  type InstallTeam, type Installation, type RowPatch,
} from '@/lib/installations/compute';
import { AlertPill } from './shared';
import { Field, INPUT } from './TeamsManagerTab';
import { Select } from '@/components/ui/select';

/** The platform Dropdown sized like the form's text inputs. */
const SELECT = 'h-9 rounded-[6px] text-[13px] dark:rounded-[6px]';
const opts = (list: readonly string[]) => [{ value: '', label: '—' }, ...list.map(v => ({ value: v, label: v }))];

type Draft = Required<Pick<RowPatch,
  'project_no' | 'project_name' | 'branch' | 'city_state' | 'planned_start' | 'planned_finish' | 'team_id' | 'team' | 'team_size' |
  'scope' | 'pm_name' | 'confidence' | 'status' | 'blockers' | 'notes'>>;

const EMPTY: Draft = {
  project_no: null, project_name: null, branch: null, city_state: null, planned_start: null, planned_finish: null, team_id: null,
  team: null, team_size: null, scope: null, pm_name: null, confidence: null, status: null, blockers: null, notes: null,
};
const OTHER = '__other';

// One installation as a form — the same cells as the register row, for editing a whole row at
// once or adding a new one.
export function RowEditModal({ open, row, teams, pmNames, today, onClose, onSave }: {
  open: boolean;
  /** null = a new row. */
  row: Installation | null;
  teams: InstallTeam[];
  pmNames: string[];
  today: string;
  onClose: () => void;
  /** Resolves true once saved. */
  onSave: (patch: RowPatch) => Promise<boolean>;
}) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  const [teamMode, setTeamMode] = React.useState<'saved' | 'other'>('saved');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const next = row ? (Object.fromEntries(Object.keys(EMPTY).map(k => [k, (row as unknown as Record<string, unknown>)[k] ?? null])) as Draft) : EMPTY;
    setD(next);
    setTeamMode(row && !row.team_id && row.team ? 'other' : 'saved');
  }, [open, row]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const str = (v: unknown) => (v == null ? '' : String(v));

  const team = d.team_id ? teams.find(t => t.id === d.team_id) : undefined;
  // Live preview of the automatic columns.
  const preview = { ...(row ?? {}), ...d, team: team ? teamLabel(team) : d.team, team_size: team ? teamHeadcount(team) : d.team_size } as Installation;
  const badDates = !!(d.planned_start && d.planned_finish && String(d.planned_finish) < String(d.planned_start));

  const submit = async () => {
    if (badDates) return;
    setBusy(true);
    try {
      const patch: RowPatch = { ...d };
      if (team) { patch.team = teamLabel(team); patch.team_size = teamHeadcount(team); }
      if (teamMode === 'other') patch.team_id = null;
      if (!row) for (const k of Object.keys(patch) as (keyof RowPatch)[]) if (patch[k] === null) delete patch[k];
      if (await onSave(patch)) onClose();
    } finally { setBusy(false); }
  };

  const alert = alertOf(preview, today);
  const suggested = suggestedStatus(preview, today);

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        size="lg"
        title={row ? `Edit ${row.project_no ?? 'installation'} ${row.project_name ?? ''}` : 'Add project to the installation plan'}
        description="Dates, team, PM and status — the dashboard, months, Gantt and team allocation update from these."
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button onClick={() => void submit()} loading={busy} disabled={badDates}>{row ? 'Save changes' : 'Add project'}</Button>
        </>}
      >
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <Field label="Project #" hint="e.g. #480 STG 1"><input autoFocus value={str(d.project_no)} onChange={e => set('project_no', e.target.value || null)} className={INPUT} /></Field>
            <Field label="Project / Store name"><input value={str(d.project_name)} onChange={e => set('project_name', e.target.value || null)} className={INPUT} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Branch">
              <Select aria-label="Branch" value={str(d.branch)} onValueChange={v => set('branch', v || null)} className={SELECT} options={opts(BRANCHES)} />
            </Field>
            <Field label="City / State"><input value={str(d.city_state)} onChange={e => set('city_state', e.target.value || null)} className={INPUT} /></Field>
            <Field label="Company / Scope">
              <Select aria-label="Company / Scope" value={str(d.scope)} onValueChange={v => set('scope', v || null)} className={SELECT}
                options={opts(d.scope && !(SCOPES as readonly string[]).includes(String(d.scope)) ? [...SCOPES, String(d.scope)] : SCOPES)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Planned start"><input type="date" value={str(d.planned_start)} onChange={e => set('planned_start', e.target.value || null)} className={INPUT} /></Field>
            <Field label="Planned finish" hint={badDates ? undefined : d.planned_start && !d.planned_finish ? 'Needed for the duration and the Gantt' : undefined}>
              <input type="date" value={str(d.planned_finish)} onChange={e => set('planned_finish', e.target.value || null)}
                className={cn(INPUT, (badDates || (d.planned_start && !d.planned_finish)) && 'border-[var(--status-t10-fg)]')} />
              {badDates && <span className="text-[11px] font-semibold text-[var(--status-t10-fg)]">Finish is before start</span>}
            </Field>
            <Field label="Duration"><div className="flex h-9 items-center rounded-[6px] bg-ui-page-bg px-3 text-[13px] font-semibold text-ui-heading">{durationDays(preview) ?? '—'} days</div></Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Assigned team" hint={team ? teamLabel(team) : teamMode === 'other' ? 'Not a saved team — set teams up on the Teams tab' : undefined}>
              <Select
                aria-label="Assigned team"
                value={teamMode === 'other' ? OTHER : str(d.team_id)}
                onValueChange={raw => {
                  const v = raw ?? '';
                  if (v === OTHER) { setTeamMode('other'); set('team_id', null); }
                  else { setTeamMode('saved'); set('team_id', v || null); if (!v) { set('team', null); } }
                }}
                className={SELECT}
                options={[
                  { value: '', label: 'TBD' },
                  ...teams.filter(t => t.active || t.id === d.team_id).map(t => ({ value: t.id, label: `${t.name}${t.members.length ? ` (${t.members.join(', ')})` : ''}` })),
                  { value: OTHER, label: 'Other (type it)…' },
                ]}
              />
            </Field>
            <Field label="Team members">
              {teamMode === 'other'
                ? <input inputMode="numeric" value={str(d.team_size)} onChange={e => set('team_size', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={INPUT} />
                : <div className="flex h-9 items-center rounded-[6px] bg-ui-page-bg px-3 text-[13px] font-semibold text-ui-heading">{headcount(preview)}</div>}
            </Field>
          </div>
          {teamMode === 'other' && (
            <Field label="Team (text)" hint="Installers in brackets are checked for double-booking, e.g. TEAM C (Jhon, Allen, Kevin)">
              <input value={str(d.team)} onChange={e => set('team', e.target.value || null)} className={INPUT} />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Assigned project manager">
              <input list="inst-form-pm" value={str(d.pm_name)} onChange={e => set('pm_name', e.target.value || null)} placeholder="TBD" className={INPUT} />
              <datalist id="inst-form-pm">{pmNames.map(n => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Confidence">
              <Select aria-label="Confidence" value={str(d.confidence)} onValueChange={v => set('confidence', v || null)} className={SELECT} options={opts(CONFIDENCES)} />
            </Field>
            <Field label="Project status" hint={suggested && suggested !== d.status ? `Dates suggest: ${suggested}` : undefined}>
              <Select aria-label="Project status" value={str(d.status)} onValueChange={v => set('status', v || null)} className={SELECT} options={opts(STATUSES)} />
            </Field>
          </div>
          <Field label="Dependencies / blockers"><textarea rows={2} value={str(d.blockers)} onChange={e => set('blockers', e.target.value || null)} className={cn(INPUT, 'h-auto py-2')} /></Field>
          <Field label="Notes"><textarea rows={3} value={str(d.notes)} onChange={e => set('notes', e.target.value || null)} className={cn(INPUT, 'h-auto py-2')} /></Field>
          {alert && <div className="flex items-center gap-2 text-[12px] text-ui-body">Alert: <AlertPill tone={alert.tone} text={alert.text} /></div>}
          <button type="submit" hidden />
        </form>
      </ModalContent>
    </Modal>
  );
}
