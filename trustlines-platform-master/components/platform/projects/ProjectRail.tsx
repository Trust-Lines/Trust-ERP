'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/platform/shared/Avatar';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import type { ProfileSnippet, NoteRow, StageTransitionRow } from './ProjectDetailClient';

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

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rail-card">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function TeamCard({ team }: { team: DerivedTeamPerson[] }) {
  if (team.length === 0) {
    return (
      <RailCard title="Team">
        <div style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
          No one yet — people appear automatically once a PM is set or a member&apos;s skill matches a project type.
        </div>
      </RailCard>
    );
  }

  return (
    <RailCard title="Team">
      {team.map((p, i) => (
        <div
          key={p.id}
          className="meta-person"
          style={{ alignItems: 'flex-start', borderBottom: i < team.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
        >
          <Avatar name={p.full_name} size="sm" colorIndex={i} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.full_name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
              {p.reasons.map(r => (
                <span key={r} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', whiteSpace: 'nowrap',
                }}>{r}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
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
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  return (
    <RailCard title="Internal Notes">
      {notes.length === 0 && !showInput && (
        <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginBottom: 8 }}>No notes yet</div>
      )}

      {notes.slice(0, 5).map(note => (
        <div key={note.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontWeight: 600, color: 'var(--fg-default)' }}>
              {note.author?.full_name ?? 'Unknown'}
            </span>
            <span style={{ color: 'var(--fg-faint)', fontSize: 11 }}>{fmtDate(note.created_at)}</span>
          </div>
          <div style={{ color: 'var(--fg-muted)', lineHeight: 1.4 }}>
            {note.content.length > 120 ? `${note.content.slice(0, 120)}…` : note.content}
          </div>
        </div>
      ))}

      {showInput ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="form-input"
            rows={3}
            style={{ resize: 'vertical', fontSize: 12 }}
            placeholder="Write a note..."
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!text.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowInput(false); setText(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--brand-teal)', padding: '4px 0', marginTop: 6, fontSize: 12 }}
          onClick={() => setShowInput(true)}
        >
          + Add note
        </button>
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
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const rows = stageHistory.filter(t => t.to_stage && STAGE_DISPLAY[t.to_stage]);

  return (
    <RailCard title="Timeline">
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fg-faint)' }}>No stage transitions yet</div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{
            position: 'absolute', left: 5, top: 6, bottom: 6,
            width: 2, background: 'var(--border-subtle)', borderRadius: 2,
          }} />
          {rows.map((t, i) => {
            const info = STAGE_DISPLAY[t.to_stage];
            return (
              <div key={t.id} style={{ position: 'relative', marginBottom: i < rows.length - 1 ? 14 : 0 }}>
                <div style={{
                  position: 'absolute', left: -14, top: 3,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--brand-teal)', border: '2px solid var(--bg-default)',
                }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', lineHeight: 1.3 }}>
                  {info.num} · {info.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>
                  {fmtDate(t.created_at)}
                  {t.actor?.full_name && ` · ${t.actor.full_name}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

export function IntegrationsCard({ project, userRole }: { project: FullProject; userRole: string }) {
  const hideSensitive = userRole === 'tlines_pm';

  return (
    <RailCard title="Integrations">
      <div className="meta-row">
        <span className="k">Dropbox</span>
        {project.dropbox_root_path ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a
              href={`https://www.dropbox.com/home${project.dropbox_root_path}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--brand-teal)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
            >
              Open ↗
            </a>
            <span className="pill" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-fg)', fontSize: 9 }}>
              Synced
            </span>
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Not set</span>
            <span className="pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', fontSize: 9 }}>
              Not set
            </span>
          </span>
        )}
      </div>

      <div className="meta-row">
        <span className="k">ClickUp</span>
        {project.clickup_task_id ? (
          <a
            href={`https://app.clickup.com/t/${project.clickup_task_id}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--brand-teal)', fontSize: 12 }}
          >
            {project.clickup_task_id}
          </a>
        ) : (
          <span style={{ color: 'var(--fg-faint)', fontSize: 12 }}>—</span>
        )}
      </div>

      {!hideSensitive && (
        <div className="meta-row">
          <span className="k">QuickBooks</span>
          <span style={{ fontSize: 12 }}>{project.quickbooks_ref ?? '—'}</span>
        </div>
      )}
      {hideSensitive && (
        <div className="meta-row">
          <span className="k">QuickBooks</span>
          <PermissionShield label="Restricted" />
        </div>
      )}
    </RailCard>
  );
}

export function ProjectRail({ project, userRole, userId, notes, stageHistory, team }: Props) {
  const hideNotes = userRole === 'tlines_pm';

  return (
    <div>
      <IntegrationsCard project={project} userRole={userRole} />
      <TeamCard team={team} />
      <StageTimelineCard stageHistory={stageHistory} />
      {!hideNotes && (
        <InternalNotesCard projectId={project.id} userId={userId} initialNotes={notes} />
      )}
    </div>
  );
}
