'use client';

import * as React from 'react';
import { ArrowDownUp, CalendarDays, Ellipsis, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { TagInput } from '@/components/ui/tag-input';
import { Select as FilterSelect } from '@/components/ui/select';
import {
  BRANCHES, byStart, installersOf, isActive, teamHeadcount, type Clash, type InstallTeam, type Installation,
} from '@/lib/installations/compute';
import { BRANCH_COLOR, HEADING } from './shared';

export type TeamDraft = { name: string; branch: string | null; members: string[]; size: number | null; notes: string | null; active: boolean };

type View = 'teams' | 'members';
type Sort = 'newest' | 'oldest' | 'name' | 'size';
type Availability = 'all' | 'free' | 'busy';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' }, { value: 'size', label: 'Most members' },
];
const AVAIL: { value: Availability; label: string }[] = [
  { value: 'all', label: 'Availability' }, { value: 'free', label: 'Free now' }, { value: 'busy', label: 'On a job' },
];
const CONTROL = 'inline-flex h-10 w-auto shrink-0 cursor-pointer items-center gap-2 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:px-3 dark:text-ui-heading [&_svg]:size-3.5';
const CHIP = 'inline-flex items-center rounded-[4px] py-0.5 text-[14px] font-medium leading-[1.4] whitespace-nowrap';

/** "16 OCT" */
const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();

// Figma 654:39143 — T-Lines PM → Installation → Teams: the crews set up once and picked on each
// installation row. A card per team: its branch, installers, the job it's on now (or "Free") and
// the next two jobs (red when an installer is double-booked). Editing a team changes every row
// that uses it.
export function TeamsManagerTab({ teams, rows, today, clashes, canEdit, setupNeeded, onCreate, onUpdate, onDelete }: {
  teams: InstallTeam[];
  rows: Installation[];
  today: string;
  clashes: Map<string, Clash[]>;
  canEdit: boolean;
  setupNeeded: boolean;
  projectByNo: Record<string, string>;
  onCreate: (t: TeamDraft) => Promise<boolean>;
  onUpdate: (id: string, t: TeamDraft) => Promise<boolean>;
  onDelete: (t: InstallTeam) => void;
}) {
  const [editing, setEditing] = React.useState<InstallTeam | 'new' | null>(null);
  const [view, setView] = React.useState<View>('teams');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState<Sort>('newest');
  const [avail, setAvail] = React.useState<Availability>('all');
  const [project, setProject] = React.useState('');
  const members = React.useMemo(() => buildMembers(teams, rows, clashes, today), [teams, rows, clashes, today]);
  // Projects someone is booked on (Members List "Project" filter).
  const projectOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of members) for (const j of m.jobs) if (!seen.has(j.id)) seen.set(j.id, [j.project_no, j.project_name].filter(Boolean).join(' ') || '—');
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [members]);

  // Per team: current job and the upcoming ones.
  const plan = React.useMemo(() => {
    const out = new Map<string, { now: Installation | null; next: Installation[] }>();
    for (const t of teams) {
      const jobs = rows.filter(r => r.team_id === t.id && isActive(r)).sort(byStart);
      const now = jobs.find(j => j.planned_start && j.planned_start <= today && (j.planned_finish ?? j.planned_start) >= today) ?? null;
      const next = jobs.filter(j => j.planned_start && j.planned_start > today);
      out.set(t.id, { now, next });
    }
    return out;
  }, [teams, rows, today]);

  if (setupNeeded) {
    return (
      <div className="rounded-[10px] border border-ui-divider bg-ui-surface p-6 text-[13px] text-ui-body">
        Teams aren’t set up in the database yet. Run <code className="rounded bg-ui-page-bg px-1.5 py-0.5">supabase/migrations/143_install_teams.sql</code> in
        the Supabase SQL editor — it creates the teams from the workbook (TEAM A–D, EXPRESS EM, CVW) and links the rows to them.
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const matches = (t: InstallTeam) => !needle || t.name.toLowerCase().includes(needle) || t.members.some(m => m.toLowerCase().includes(needle));
  const isFree = (t: InstallTeam) => !plan.get(t.id)?.now;
  const shownMembers = members
    .filter(m => !needle || m.name.toLowerCase().includes(needle))
    .filter(m => avail === 'all' || (avail === 'free' ? !m.busyNow : m.busyNow))
    .filter(m => !project || m.jobs.some(j => j.id === project))
    .sort((a, b) => sort === 'newest' ? b.teamOrder - a.teamOrder
      : sort === 'oldest' ? a.teamOrder - b.teamOrder
      : sort === 'name' ? a.name.localeCompare(b.name)
      : b.jobs.length - a.jobs.length);
  const shownTeams = teams
    .filter(matches)
    .filter(t => avail === 'all' || (avail === 'free' ? isFree(t) : !isFree(t)))
    .sort((a, b) => sort === 'newest' ? b.sort_order - a.sort_order
      : sort === 'oldest' ? a.sort_order - b.sort_order
      : sort === 'name' ? a.name.localeCompare(b.name)
      : teamHeadcount(b) - teamHeadcount(a));

  return (
    <div className="flex flex-col gap-[30px]">
      {/* Figma 663:41092 — Teams / Members List */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ui-divider pb-3" role="tablist" aria-label="Teams view">
        {(['teams', 'members'] as View[]).map(v => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={cn('inline-flex h-[38px] cursor-pointer items-center rounded-[6px] border-0 px-4 text-[13px] text-[var(--color-secondary-700)] dark:text-ui-heading',
              view === v ? 'bg-[#CCD7E5] font-semibold dark:bg-primary-700' : 'bg-transparent font-medium hover:bg-ui-hover-bg')}>
            {v === 'teams' ? 'Teams' : 'Members List'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[30px]">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex items-center">
            <Search size={16} className="pointer-events-none absolute left-2.5 text-ui-text-secondary" aria-hidden />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search member…" aria-label="Search team or member"
              className="h-10 w-[380px] max-w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus:border-[var(--ui-focus-ring)]" />
          </label>
          <span className="relative inline-flex items-center">
            <ArrowDownUp size={14} aria-hidden className="pointer-events-none absolute left-3 z-[1] text-[var(--color-secondary-700)] dark:text-ui-heading" />
            <FilterSelect aria-label="Sort teams" value={sort} onValueChange={v => setSort((v ?? 'newest') as Sort)} options={SORTS}
              className={cn(CONTROL, 'pl-[34px] dark:pl-[34px]')} />
          </span>
          <FilterSelect aria-label="Availability" value={avail} onValueChange={v => setAvail((v ?? 'all') as Availability)} options={AVAIL} className={CONTROL} />
          {view === 'members' && (
            <FilterSelect aria-label="Project" value={project} onValueChange={v => setProject(v ?? '')} className={CONTROL}
              options={[{ value: '', label: 'Project' }, ...projectOptions]} />
          )}
          {canEdit && (
            <Button className="ml-auto h-10" onClick={() => setEditing('new')}><Plus /> New team</Button>
          )}
        </div>

        {view === 'teams'
          ? (shownTeams.length === 0
            ? <EmptyBox>{teams.length === 0 ? 'No teams yet.' : 'No teams match.'}</EmptyBox>
            : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shownTeams.map(t => (
                  <TeamCard key={t.id} team={t} now={plan.get(t.id)?.now ?? null} next={plan.get(t.id)?.next ?? []} clashes={clashes}
                    canEdit={canEdit} onEdit={() => setEditing(t)} onDelete={() => onDelete(t)} />
                ))}
              </div>
            ))
          : <MembersList members={shownMembers} />}
      </div>

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

function TeamCard({ team: t, now, next, clashes, canEdit, onEdit, onDelete }: {
  team: InstallTeam; now: Installation | null; next: Installation[]; clashes: Map<string, Clash[]>;
  canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const free = !now;
  const count = teamHeadcount(t);
  return (
    <div className={cn('flex flex-col gap-5 rounded-[11px] border bg-ui-page-bg py-2.5 pl-2.5 pr-3.5',
      free && t.active ? 'border-[var(--status-t0-fg)]' : 'border-ui-divider', !t.active && 'opacity-60')}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className={cn('truncate text-[20px] font-semibold tracking-[-0.44px] uppercase', HEADING)}>{t.name}</span>
              {t.branch && (
                <span className="inline-flex items-center rounded-[4px] px-4 py-0.5 text-[12px] font-medium leading-4 text-white" style={{ background: BRANCH_COLOR[t.branch] }}>{t.branch}</span>
              )}
              {!t.active && <span className="text-[12px] text-ui-text-secondary">Inactive</span>}
            </div>
            <span className="text-[14px] tracking-[-0.308px] text-ui-text-secondary">{count} Member{count === 1 ? '' : 's'}</span>
          </div>
          {now
            ? <span className={cn(CHIP, 'max-w-[60%] truncate px-2.5 text-[16px] bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)]')} title={now.project_name ?? undefined}>
                {[now.project_no, now.project_name].filter(Boolean).join(' ')}
              </span>
            : <span className={cn(CHIP, 'px-2.5 text-[16px] bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]')}>Free</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {t.members.length
            ? t.members.map(m => (
                <span key={m} className={cn(CHIP, 'pl-1.5 pr-2 bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950')}>{m}</span>
              ))
            : <span className="text-[13px] italic text-ui-text-secondary">No installers named</span>}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="text-[16px] font-medium leading-[1.4] text-[var(--status-t0-fg)]">Next:</span>
          {next.length === 0
            ? <span className="text-[14px] text-ui-text-secondary">Nothing planned</span>
            : next.slice(0, 2).map(j => {
                const clash = clashes.get(j.id);
                const nos = clash ? [j.project_no, ...clash.map(c => c.projectNo)].filter(Boolean).join(', ') : j.project_no;
                return (
                  <span key={j.id} title={`${j.project_no ?? ''} ${j.project_name ?? ''}${clash ? `\nDouble-booked with ${clash.map(c => c.projectNo).join(', ')}` : ''}`}
                    className={cn(CHIP, 'gap-4 pl-1.5 pr-2',
                      clash ? 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]' : 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]')}>
                    <span>{nos || '—'}</span>
                    <span className="inline-flex items-center gap-1">{dayMonth(j.planned_start!)} <CalendarDays size={16} aria-hidden /></span>
                  </span>
                );
              })}
          {next.length > 2 && <span className="text-[13px] text-ui-text-secondary">+{next.length - 2}</span>}
        </div>
        {canEdit && <CardMenu name={t.name} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  );
}

/** The card's "…" button: Edit / Delete. */
function CardMenu({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
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
  const item = 'flex h-8 w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 text-left text-[13px]';
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${name}`} onClick={() => setOpen(o => !o)}
        className="inline-flex h-5 w-[42px] cursor-pointer items-center justify-center rounded-[4px] border border-[var(--color-secondary-700)] bg-transparent text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading">
        <Ellipsis size={20} />
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-20 mb-1 flex w-40 flex-col rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1.5 shadow-03">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }} className={cn(item, 'text-ui-body hover:bg-ui-hover-bg')}>
            <Pencil size={14} /> Edit team
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className={cn(item, 'text-[var(--status-t10-fg)] hover:bg-[var(--status-t10-bg)]')}>
            <Trash2 size={14} /> Delete team
          </button>
        </div>
      )}
    </div>
  );
}

/** One installer and the active jobs their name appears on (from each row's team text, so typed
 *  crews count too). */
interface Member { key: string; name: string; teamOrder: number; jobs: Installation[]; clashJobs: Set<string>; busyNow: boolean }

function buildMembers(teams: InstallTeam[], rows: Installation[], clashes: Map<string, Clash[]>, today: string): Member[] {
  const byKey = new Map<string, Member>();
  const add = (raw: string, order: number) => {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    const had = byKey.get(key);
    if (!had) byKey.set(key, { key, name: raw.trim(), teamOrder: order, jobs: [], clashJobs: new Set(), busyNow: false });
    else had.teamOrder = Math.max(had.teamOrder, order);
  };
  for (const t of teams) for (const m of t.members) add(m, t.sort_order);
  for (const r of rows) {
    if (!isActive(r) || !r.planned_start) continue;
    if ((r.planned_finish ?? r.planned_start) < today) continue;
    for (const who of installersOf(r.team)) {
      const m = byKey.get(who);
      if (!m) continue;
      m.jobs.push(r);
      if (clashes.get(r.id)?.some(c => c.people.includes(who))) m.clashJobs.add(r.id);
      if (r.planned_start <= today) m.busyNow = true;
    }
  }
  for (const m of byKey.values()) m.jobs.sort(byStart);
  return [...byKey.values()];
}

/** Figma 663:41118 — Members List: a card per installer with their jobs, red when double-booked. */
function MembersList({ members }: { members: Member[] }) {
  if (members.length === 0) return <EmptyBox>No members match.</EmptyBox>;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {members.map(m => {
        const double = m.clashJobs.size > 0;
        return (
          <div key={m.key} className="flex flex-col gap-4 rounded-[11px] border border-ui-divider bg-ui-page-bg py-2.5 pl-2.5 pr-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar name={m.name} size="lg" className="size-[53px] rounded-[4px]" />
                <div className="flex min-w-0 flex-col">
                  <span className={cn('truncate text-[20px] font-semibold tracking-[-0.44px]', HEADING)}>{m.name}</span>
                  <span className="text-[14px] tracking-[-0.308px] text-ui-text-secondary">{m.jobs.length} Job{m.jobs.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              {double
                ? <span className={cn(CHIP, 'px-2.5 text-[16px] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]')}>Double Booked</span>
                : !m.busyNow && <span className={cn(CHIP, 'px-2.5 text-[16px] bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]')}>Free</span>}
            </div>
            {m.jobs.length === 0
              ? <p className="m-0 text-[14px] text-ui-text-secondary">Nothing planned</p>
              : (
                <div className="flex flex-col gap-1">
                  {m.jobs.map(j => {
                    const red = m.clashJobs.has(j.id);
                    return (
                      <div key={j.id} title={red ? 'Double-booked: overlaps another of this installer’s jobs' : undefined}
                        className={cn('flex items-center justify-between gap-4 rounded-[4px] px-4 py-0.5 text-[14px] font-medium leading-[1.4]',
                          red ? 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]' : 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]')}>
                        <span className="flex min-w-0 items-center gap-4">
                          <span className="shrink-0">{j.project_no || '—'}</span>
                          <span className="truncate">{j.project_name}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1">{dayMonth(j.planned_start!)} <CalendarDays size={16} aria-hidden /></span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-[8px] border border-ui-divider bg-ui-page-bg px-4 py-8 text-center text-[13px] text-ui-text-secondary">{children}</p>;
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
