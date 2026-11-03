'use client';

import { Users, StickyNote, GitCommitHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/platform/shared/Avatar';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import type { ProfileSnippet, NoteRow, StageTransitionRow } from './ProjectDetailClient';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FullProject {
  id: string;
  code: string;
  categories: string[];
  has_millwork_shelving: boolean;
  has_ceiling_image: boolean;
  closed_deal_date: string | null;
  est_delivery_date: string | null;
  hard_deadline: boolean;
  clickup_task_id: string | null;
  quickbooks_ref: string | null;
  dropbox_root_path: string | null;
  ops_manager:   ProfileSnippet | null;
  trustlines_pm: ProfileSnippet | null;
  tlines_pm:     ProfileSnippet | null;
  prod_pm_ms:    ProfileSnippet | null;
  prod_pm_ci:    ProfileSnippet | null;
  qc_inspector:  ProfileSnippet | null;
}

interface DerivedTeamPerson { id: string; full_name: string; role: string; reasons: string[] }

interface Props {
  project: FullProject;
  userRole: string;
  userId: string;
  notes: NoteRow[];
  stageHistory: StageTransitionRow[];
  team: DerivedTeamPerson[];
}

// Figma "Project Detail" (node 445:7500): Team / Time Line / Internal Notes / Integration as a
// row of bordered cards under Finance.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const ROW = 'border-b border-ui-divider py-2.5 first:pt-0 last:border-b-0 last:pb-0';

function RailCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg px-4 pb-4 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn('m-0 text-[20px] font-semibold tracking-[0.4px]', HEADING)}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TeamCard({ team }: { team: DerivedTeamPerson[] }) {
  return (
    <RailCard title="Team">
      {team.length === 0 ? (
        <EmptyState size="sm" className="py-0" icon={<Users />} title="No one yet." description="People appear automatically once a PM is set or a member's skill matches a project type." />
      ) : (
        <div className="flex flex-col">
          {team.map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3', ROW)}>
              <Avatar name={p.full_name} size="sm" colorIndex={i} />
              <div className="min-w-0 flex-1">
                <p className={cn('m-0 truncate text-[14px] font-semibold leading-[1.3]', HEADING)}>{p.full_name}</p>
                <p className="m-0 truncate text-[12px] text-ui-body">{p.role.replace(/_/g, ' ')}</p>
              </div>
              {p.reasons.length > 0 && (
                <span className="max-w-[45%] truncate text-right text-[14px] text-ui-body" title={p.reasons.join(', ')}>{p.reasons.join(', ')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </RailCard>
  );
}

function InternalNotesCard({ projectId, userId, initialNotes }: {
  projectId: string;
  userId: string;
  initialNotes: NoteRow[];
}) {
  const supabase = createClient();
  const [notes, setNotes]       = useState<NoteRow[]>(initialNotes);
  const [showInput, setShowInput] = useState(false);
  const [text, setText]           = useState('');
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from('project_notes').insert({
      project_id: projectId,
      author_id:  userId,
      content:    text.trim(),
      is_internal: true,
    }).select('*, author:profiles(full_name)').single();

    if (error) { toast.error('Failed to save note'); setSaving(false); return; }
    setNotes(prev => [data as NoteRow, ...prev]);
    setText('');
    setShowInput(false);
    setSaving(false);
  }

  function fmtDate(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${Math.max(m, 1)}m ago`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  return (
    <RailCard
      title="Internal Notes"
      action={!showInput && (
        <Button variant="ghost" size="icon-sm" aria-label="Add note" title="Add note" onClick={() => setShowInput(true)}><Plus /></Button>
      )}
    >
      {showInput && (
        <div className="flex flex-col gap-1.5">
          <textarea
            className="min-h-[72px] w-full resize-y rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2.5 py-2 text-[12px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            rows={3}
            placeholder="Write a note..."
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button onClick={handleSave} disabled={!text.trim()} loading={saving}>Save</Button>
            <Button variant="ghost" onClick={() => { setShowInput(false); setText(''); }} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}

      {notes.length === 0 && !showInput ? (
        <EmptyState size="sm" className="py-0" icon={<StickyNote />} title="No notes yet." />
      ) : (
        <div className="flex flex-col">
          {notes.slice(0, 5).map(note => (
            <div key={note.id} className={ROW}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('truncate text-[14px] font-semibold', HEADING)}>{note.author?.full_name ?? 'Unknown'}</span>
                <span className="shrink-0 text-[11px] text-ui-text-secondary">{fmtDate(note.created_at)}</span>
              </div>
              <p className="m-0 text-[12px] leading-[1.4] text-ui-body">
                {note.content.length > 120 ? `${note.content.slice(0, 120)}…` : note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </RailCard>
  );
}

const STAGE_DISPLAY: Record<string, { label: string; num: number }> = {
  closed_deal:    { label: 'Finalization',           num: 1 },
  finalization:   { label: 'Finalization',           num: 1 },
  client_approval:{ label: 'Construction Documents', num: 2 },
  production:     { label: 'Production',             num: 3 },
  delivered:      { label: 'Delivery',               num: 4 },
};

function StageTimelineCard({ stageHistory }: { stageHistory: StageTransitionRow[] }) {
  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  }

  const rows = stageHistory.filter(t => t.to_stage && STAGE_DISPLAY[t.to_stage]);

  return (
    <RailCard title="Time Line">
      {rows.length === 0 ? (
        <EmptyState size="sm" className="py-0" icon={<GitCommitHorizontal />} title="No stage transitions yet." />
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 border-l border-ui-divider p-0 pl-3">
          {rows.map(t => {
            const info = STAGE_DISPLAY[t.to_stage];
            return (
              <li key={t.id} className="relative">
                <span aria-hidden className="absolute -left-[15.5px] top-[7px] size-1.5 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('text-[14px] font-semibold', HEADING)}>{info.num}. {info.label}</span>
                  <span className="shrink-0 text-[10px] text-ui-text-secondary">{fmtDate(t.created_at)}</span>
                </div>
                {t.actor?.full_name && <p className="m-0 text-[12px] text-ui-body">{t.actor.full_name}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </RailCard>
  );
}

export function IntegrationsCard({ project, userRole }: { project: FullProject; userRole: string }) {
  const hideSensitive = userRole === 'tlines_pm';
  const line = (label: string, value: React.ReactNode) => (
    <div className={cn('flex items-center justify-between gap-2', ROW)}>
      <span className={cn('text-[14px] font-semibold', HEADING)}>{label}</span>
      <span className="min-w-0 truncate text-[14px] text-ui-body">{value}</span>
    </div>
  );

  return (
    <RailCard title="Integration">
      <div className="flex flex-col">
        {line('Dropbox', project.dropbox_root_path ? (
          <a href={`https://www.dropbox.com/home${project.dropbox_root_path}`} target="_blank" rel="noreferrer" className="text-ui-link">Open ↗</a>
        ) : 'Not Set')}
        {line('Clickup', project.clickup_task_id ? (
          <a href={`https://app.clickup.com/t/${project.clickup_task_id}`} target="_blank" rel="noreferrer" className="text-ui-link">{project.clickup_task_id}</a>
        ) : '-')}
        {line('Quickbooks', hideSensitive ? <PermissionShield label="Restricted" /> : (project.quickbooks_ref ?? '-'))}
      </div>
    </RailCard>
  );
}

export function ProjectRail({ project, userRole, userId, notes, stageHistory, team }: Props) {
  const hideNotes = userRole === 'tlines_pm';

  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', hideNotes ? 'xl:grid-cols-3' : 'xl:grid-cols-[1fr_1fr_1.1fr_0.8fr]')}>
      <TeamCard team={team} />
      <StageTimelineCard stageHistory={stageHistory} />
      {!hideNotes && (
        <InternalNotesCard projectId={project.id} userId={userId} initialNotes={notes} />
      )}
      <IntegrationsCard project={project} userRole={userRole} />
    </div>
  );
}
