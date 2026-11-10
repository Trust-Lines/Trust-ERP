'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { TagInput } from '@/components/ui/tag-input';
import { Select as FilterSelect } from '@/components/ui/select';
import {
  BRANCHES, byStart, fmtDate, isActive, teamHeadcount, type InstallTeam, type Installation,
} from '@/lib/installations/compute';
import { BranchChip, Empty, HEADING, ProjectNo, Section } from './shared';

export type TeamDraft = { name: string; branch: string | null; members: string[]; size: number | null; notes: string | null; active: boolean };

// T-Lines PM → Installation → Teams: the crews set up once and picked on each installation row.
// Editing a team (renaming it, adding / removing installers) changes every row that uses it.
export function TeamsManagerTab({ teams, rows, today, canEdit, setupNeeded, projectByNo, onCreate, onUpdate, onDelete }: {
  teams: InstallTeam[];
  rows: Installation[];
  today: string;
  canEdit: boolean;
  setupNeeded: boolean;
  projectByNo: Record<string, string>;
  onCreate: (t: TeamDraft) => Promise<boolean>;
  onUpdate: (id: string, t: TeamDraft) => Promise<boolean>;
  onDelete: (t: InstallTeam) => void;
}) {
  const [editing, setEditing] = React.useState<InstallTeam | 'new' | null>(null);

  if (setupNeeded) {
    return (
      <div className="rounded-[10px] border border-ui-divider bg-ui-surface p-6 text-[13px] text-ui-body">
        Teams aren’t set up in the database yet. Run <code className="rounded bg-ui-page-bg px-1.5 py-0.5">supabase/migrations/143_install_teams.sql</code> in
        the Supabase SQL editor — it creates the teams from the workbook (TEAM A–D, EXPRESS EM, CVW) and links the rows to them.
      </div>
    );
  }

  const jobsOf = (t: InstallTeam) => rows.filter(r => r.team_id === t.id && isActive(r)).sort(byStart);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Installation teams"
        hint={`${teams.filter(t => t.active).length} active · pick a team on each row in the Project Register`}
        actions={canEdit && (
          <Button size="sm" onClick={() => setEditing('new')}><Plus /> New team</Button>
        )}
      >
        {teams.length === 0 ? <Empty>No teams yet.</Empty> : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {teams.map(t => {
              const jobs = jobsOf(t);
              const now = jobs.find(j => j.planned_start && j.planned_start <= today && (j.planned_finish ?? j.planned_start) >= today);
              const next = jobs.find(j => j.planned_start && j.planned_start > today);
              return (
                <div key={t.id} className={cn('flex flex-col gap-2.5 rounded-[10px] border border-ui-divider bg-ui-page-bg p-3.5', !t.active && 'opacity-60')}>
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-[var(--ui-btn-solid)] text-[var(--ui-btn-solid-fg)]"><Users size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[15px] font-bold', HEADING)}>{t.name}</div>
                      <div className="text-[11px] text-ui-text-secondary">
                        {teamHeadcount(t)} installer{teamHeadcount(t) === 1 ? '' : 's'} · {jobs.length} active job{jobs.length === 1 ? '' : 's'}{!t.active && ' · inactive'}
                      </div>
                    </div>
                    {t.branch && <BranchChip branch={t.branch} />}
                    {canEdit && (
                      <>
                        <button type="button" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}
                          className="inline-grid size-8 cursor-pointer place-items-center rounded-[6px] border border-ui-divider bg-ui-surface text-ui-body hover:text-ui-heading"><Pencil size={14} /></button>
                        <button type="button" onClick={() => onDelete(t)} aria-label={`Delete ${t.name}`}
                          className="inline-grid size-8 cursor-pointer place-items-center rounded-[6px] border border-ui-divider bg-ui-surface text-ui-body hover:bg-[var(--status-t10-bg)] hover:text-[var(--status-t10-fg)]"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.members.length
                      ? t.members.map(m => <span key={m} className="inline-flex h-6 items-center rounded-full bg-ui-surface px-2.5 text-[12px] font-medium text-ui-heading ring-1 ring-ui-divider">{m}</span>)
                      : <span className="text-[12px] italic text-ui-text-secondary">No installers named — head count {t.size ?? 0}</span>}
                  </div>
                  <div className="flex flex-col gap-1 border-t border-ui-divider pt-2 text-[11px] text-ui-body">
                    <span><strong>Now:</strong> {now ? <><ProjectNo row={now} projectByNo={projectByNo} /> {now.project_name} · until {fmtDate(now.planned_finish)}</> : <span className="text-ui-text-secondary">free</span>}</span>
                    <span><strong>Next:</strong> {next ? <><ProjectNo row={next} projectByNo={projectByNo} /> {next.project_name} · from {fmtDate(next.planned_start)}</> : <span className="text-ui-text-secondary">nothing planned</span>}</span>
                  </div>
                  {t.notes && <p className="m-0 text-[11px] italic text-ui-text-secondary">{t.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <TeamFormModal
        open={editing !== null}
        team={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={async d => {
          const ok = editing === 'new' ? await onCreate(d) : editing ? await onUpdate(editing.id, d) : false;
          if (ok) setEditing(null);
        }}
      />
    </div>
  );
}

function TeamFormModal({ open, team, onClose, onSave }: {
  open: boolean; team: InstallTeam | null; onClose: () => void; onSave: (d: TeamDraft) => Promise<void>;
}) {
  const blank: TeamDraft = { name: '', branch: null, members: [], size: null, notes: null, active: true };
  const [d, setD] = React.useState<TeamDraft>(blank);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setD(team ? { name: team.name, branch: team.branch, members: team.members, size: team.size, notes: team.notes, active: team.active } : blank);
     
  }, [open, team]);
  const set = <K extends keyof TeamDraft>(k: K, v: TeamDraft[K]) => setD(x => ({ ...x, [k]: v }));
  const submit = async () => { setBusy(true); try { await onSave(d); } finally { setBusy(false); } };

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        size="md"
        title={team ? `Edit ${team.name}` : 'New team'}
        description="Rows using this team change with it — its name, installers and head count."
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button onClick={submit} loading={busy} disabled={!d.name.trim()}>{team ? 'Save team' : 'Create team'}</Button>
        </>}
      >
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
          <Field label="Team name" required>
            <input autoFocus value={d.name} onChange={e => set('name', e.target.value)} placeholder="e.g. TEAM E" className={INPUT} />
          </Field>
          <Field label="Installers" hint="Type a name and press Enter. The double-booking check matches these names.">
            <TagInput value={d.members} onValueChange={v => set('members', v)} placeholder="Add installer…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Head count" hint={d.members.length ? `${d.members.length} from the names` : 'For a crew with no names yet'}>
              <input inputMode="numeric" disabled={d.members.length > 0} value={d.members.length ? d.members.length : d.size ?? ''}
                onChange={e => set('size', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={INPUT} />
            </Field>
            <Field label="Home branch" hint="Optional — teams can work anywhere">
              <FilterSelect aria-label="Home branch" value={d.branch ?? ''} onValueChange={v => set('branch', v || null)}
                options={[{ value: '', label: 'Any branch' }, ...BRANCHES.map(b => ({ value: b, label: b }))]} className="h-9 w-full" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={2} value={d.notes ?? ''} onChange={e => set('notes', e.target.value || null)} className={cn(INPUT, 'h-auto py-2')} />
          </Field>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ui-body">
            <Checkbox checked={d.active} onCheckedChange={v => set('active', !!v)} />
            Active — inactive teams stay on their old rows but aren’t offered for new ones
          </label>
          <button type="submit" hidden />
        </form>
      </ModalContent>
    </Modal>
  );
}

export const INPUT = 'h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none focus:border-[var(--ui-focus-ring)] disabled:opacity-60';

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-ui-heading">{label}{required && <span className="text-[var(--status-t10-fg)]"> *</span>}</span>
      {children}
      {hint && <span className="text-[11px] text-ui-text-secondary">{hint}</span>}
    </label>
  );
}
