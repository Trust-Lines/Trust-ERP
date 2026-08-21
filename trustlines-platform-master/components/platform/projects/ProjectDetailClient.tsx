'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { PhaseRail } from '@/components/platform/shared/PhaseRail';
import { StageBadge } from '@/components/platform/shared/StageBadge';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import { Avatar } from '@/components/platform/shared/Avatar';
import { ProjectWorkflow } from './ProjectWorkflow';
import { FileUploadZone } from './FileUploadZone';
import { DocumentTable } from './DocumentTable';
import { AuditTrail } from './AuditTrail';
import { ProjectRail } from './ProjectRail';
import { PlanLayoutTab } from './PlanLayoutTab';
import { CategoryTab } from './CategoryTab';
import { permCan } from '@/lib/permissions/catalog';
import { can } from '@/lib/permissions/can';
import type { ProjectStage, ProjectPhase } from '@/types/database';
import type { StepRecord } from '@/lib/workflow/steps';

export interface ProfileSnippet { id: string; full_name: string }

export interface StageTransitionRow {
  id: string;
  from_stage: string;
  to_stage: string;
  transitioned_by: string | null;
  is_override: boolean;
  override_reason: string | null;
  created_at: string;
  actor?: { full_name: string } | null;
}

export interface AuditRow {
  id: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actor?: { full_name: string } | null;
}

export interface NoteRow {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: { full_name: string } | null;
}

export interface DocumentRow {
  id: string;
  doc_type: string;
  version: number;
  dropbox_version: number | null;
  status: string;
  dropbox_path: string;
  dropbox_file_id: string | null;
  file_name: string;
  file_size_bytes: number | null;
  uploaded_at: string;
  branch: string | null;
  cat_group: string | null;
  notes: string | null;
  last_revised_at: string | null;
}

interface FullProject {
  id: string;
  code: string;
  name: string;
  site_location: string | null;
  current_stage: ProjectStage;
  current_phase: ProjectPhase;
  categories: string[];
  has_millwork_shelving: boolean;
  has_ceiling_image: boolean;
  deal_value: number | null;
  currency: string;
  margin_target_pct: number | null;
  closed_deal_date: string | null;
  est_delivery_date: string | null;
  hard_deadline: boolean;
  clickup_task_id: string | null;
  quickbooks_ref: string | null;
  dropbox_root_path: string | null;
  client: { id: string; name: string; code: string | null } | null;
  client_franchise: { id: string; code: string; name: string } | null;
  client_company: { id: string; name: string } | null;
  ops_manager:   ProfileSnippet | null;
  trustlines_pm: ProfileSnippet | null;
  tlines_pm:     ProfileSnippet | null;
  prod_pm_ms:    ProfileSnippet | null;
  prod_pm_ci:    ProfileSnippet | null;
  qc_inspector:  ProfileSnippet | null;
  tlines_pm_id:  string | null;
  updated_at: string;
}

interface Props {
  project: FullProject;
  userId: string;
  userRole: string;
  userPerms: Record<string, boolean>;
  documents: DocumentRow[];
  stageHistory: StageTransitionRow[];
  auditEvents: AuditRow[];
  notes: NoteRow[];
  steps: StepRecord[];
  team: DerivedTeamPerson[];
  topSlot?: React.ReactNode;
  hidePhaseRail?: boolean;
}

const FIXED_TABS = [
  'Overview',
  'Plan Layout',
  'Design Proposal',
  'Construction Drawing',
  'PF',
] as const;

export interface DerivedTeamPerson { id: string; full_name: string; role: string; reasons: string[] }

function InternalNotesCard({ projectId, userId, initialNotes }: {
  projectId: string; userId: string; initialNotes: NoteRow[];
}) {
  const supabase = createClient();
  const [notesList, setNotesList] = useState<NoteRow[]>(initialNotes);
  const [showInput, setShowInput] = useState(false);
  const [text, setText]           = useState('');
  const [saving, setSaving]       = useState(false);

  function relTime(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const h    = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (h < 1)   return 'just now';
    if (h < 24)  return `${h}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('project_notes')
      .insert({ project_id: projectId, author_id: userId, content: text.trim(), is_internal: true })
      .select('*, author:profiles(full_name)')
      .single();
    if (error) { toast.error('Failed to save note'); setSaving(false); return; }
    setNotesList(prev => [data as NoteRow, ...prev]);
    setText(''); setShowInput(false); setSaving(false);
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="text-eyebrow">Internal only</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Internal Notes</h3>
        </div>
        {!showInput && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-teal)' }} onClick={() => setShowInput(true)}>
            + Add note
          </button>
        )}
      </div>

      {showInput && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Write a note..."
            style={{ resize: 'vertical', fontSize: 13, marginBottom: 8 }}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!text.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowInput(false); setText(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {notesList.length === 0 && !showInput ? (
        <div className="card-body" style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No notes yet</div>
      ) : (
        notesList.slice(0, 5).map((note, i) => (
          <div key={note.id} style={{
            padding: '10px 18px',
            borderBottom: i < Math.min(notesList.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{note.author?.full_name ?? 'Unknown'}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{relTime(note.created_at)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
              {note.content.length > 200 ? `${note.content.slice(0, 200)}…` : note.content}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FinanceCard({ project, documents, userRole }: {
  project: FullProject;
  documents: DocumentRow[];
  userRole: string;
}) {
  const hideSensitive = userRole === 'tlines_pm';
  const sym: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
  const currency = project.currency ?? 'USD';
  const S = sym[currency] ?? '';

  const fmt = (v: number | null) =>
    v != null ? `${S}${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—';

  const hasPOSigned = documents.some(d => d.doc_type === 'po_bo' && d.status === 'signed');
  const hasPFSigned = documents.some(d => d.doc_type === 'pf'    && d.status === 'signed');

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Finance</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Value & margin</h3>
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <div className="kpi">
            <div className="label">Est. Value</div>
            <div className="value" style={{ fontSize: 20 }}>{fmt(project.deal_value)}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{currency}</div>
          </div>
          <div className="kpi">
            <div className="label">Total PO</div>
            <div className="value" style={{ fontSize: 20 }}>
              {hasPOSigned ? '—' : <span style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No PO yet</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{currency}</div>
          </div>
          <div className="kpi">
            <div className="label">Total PF</div>
            <div className="value" style={{ fontSize: 20 }}>
              {hideSensitive
                ? <PermissionShield label="Restricted" />
                : hasPFSigned ? '—' : <span style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No PF yet</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{hideSensitive ? '' : currency}</div>
          </div>
          <div className="kpi">
            <div className="label">Margin</div>
            <div className="value" style={{ fontSize: 20 }}>
              {hideSensitive
                ? <PermissionShield label="Restricted" />
                : project.margin_target_pct != null
                  ? (
                    <span style={{
                      color: project.margin_target_pct >= 0 ? 'var(--status-success-fg)' : 'var(--status-danger-fg)',
                    }}>
                      {project.margin_target_pct}%
                    </span>
                  )
                  : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DatesCard({ project, stageHistory }: {
  project: FullProject;
  stageHistory: StageTransitionRow[];
}) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = project.est_delivery_date && project.est_delivery_date < today && project.current_stage !== 'delivered';

  const poSignedTransition = stageHistory.find(t => t.to_stage === 'po_bo_signed');

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function relTime(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (h < 1)    return 'just now';
    if (h < 24)   return `${h}h ago`;
    if (days < 30) return `${days}d ago`;
    return fmtDate(d);
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Timeline</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Key dates</h3>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {[
          { label: 'Closed deal',    value: fmtDate(project.closed_deal_date) },
          { label: 'PO signed',      value: poSignedTransition ? fmtDate(poSignedTransition.created_at) : '—' },
          { label: 'Est. delivery',  value: (
            <span style={{ color: isOverdue ? 'var(--status-danger)' : undefined, fontWeight: isOverdue ? 600 : undefined }}>
              {fmtDate(project.est_delivery_date)}
              {project.hard_deadline && (
                <span className="pill" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)', marginLeft: 6, fontSize: 9 }}>
                  HARD DEADLINE
                </span>
              )}
            </span>
          )},
          { label: 'Last updated',   value: relTime(project.updated_at) },
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 18px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>{label}</span>
            <span suppressHydrationWarning>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        {label} — coming in next sprint
      </div>
    </div>
  );
}

export function ProjectDetailClient({
  project,
  userId,
  userRole,
  userPerms,
  documents,
  stageHistory,
  auditEvents,
  notes,
  steps,
  team,
  topSlot,
  hidePhaseRail,
}: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const TAB_SLUG_MAP: Record<string, string> = {
    plan_layout:           'Plan Layout',
    design_proposal:       'Design Proposal',
    construction_drawing:  'Construction Drawing',
  };
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    initialTab && TAB_SLUG_MAP[initialTab] ? TAB_SLUG_MAP[initialTab] : 'Overview',
  );
  const [deleting, setDeleting]   = useState(false);
  const [workflowUpload, setWorkflowUpload] = useState<{
    stepKey: string; phase: string; catGroup: string | null; docType?: string;
  } | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = project.est_delivery_date && project.est_delivery_date < today && project.current_stage !== 'delivered';
  const overdueDays = isOverdue
    ? Math.floor((new Date(today).getTime() - new Date(project.est_delivery_date!).getTime()) / 86400000)
    : 0;

  useEffect(() => {
    if (!project.closed_deal_date) return;
    const alreadyDone = steps.some(
      s => s.phase === 'phase1' && s.step_key === 'closed_deal' &&
           (s.status === 'done' || s.status === 'approved'),
    );
    if (alreadyDone) return;

    fetch(`/api/projects/${project.id}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase:        'phase1',
        step_key:     'closed_deal',
        cat_group:    null,
        status:       'done',
        completed_by: userId,
        completed_at: new Date(project.closed_deal_date).toISOString(),
      }),
    })
      .then(r => r.ok ? router.refresh() : null)
      .catch(() => null);
   
  }, []);

  useEffect(() => {
    if (!project.dropbox_root_path) return;
    fetch('/api/dropbox/auto-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
      .then(r => r.json() as Promise<{ synced?: number }>)
      .then(({ synced }) => { if (synced && synced > 0) router.refresh(); })
      .catch(() => null);
   
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`project-${project.id}`)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'projects',           filter: `id=eq.${project.id}` },         () => router.refresh())
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'documents',          filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'document_approvals', filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'document_versions',  filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log',          filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'project_steps',      filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [project.id, supabase, router]);

  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) router.refresh(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [router]);

  async function handleDelete() {
    if (!window.confirm(`Move "${project.name}" to trash? It will be permanently deleted after 30 days.`)) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const json = await res.json() as { error?: string };
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return; }
      toast.success('Project moved to trash');
      router.push('/projects');
    } finally { setDeleting(false); }
  }

  const dynamicTabs = project.categories ?? [];
  const TAB_PERM: Record<string, string> = {
    'Overview':             'view.tab_overview',
    'Plan Layout':          'view.tab_plan_layout',
    'Design Proposal':      'view.tab_design_proposal',
    'Construction Drawing': 'view.tab_construction',
  };
  const tabPermKey = (tab: string) => TAB_PERM[tab] ?? `view.tab_${tab.toLowerCase()}`;
  const allTabs = [
    'Overview',
    'Plan Layout',
    'Design Proposal',
    'Construction Drawing',
    ...dynamicTabs,
  ].filter(tab => tab === 'Overview' || permCan(userPerms, tabPermKey(tab)));

  function fmtDateShort(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 14 }}>
        <Link href="/projects" style={{ color: 'var(--fg-subtle)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-teal)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-subtle)')}
        >
          Projects
        </Link>
        <span style={{ color: 'var(--fg-faint)' }}>/</span>
        <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>
          {project.code} — {project.name}
        </span>
      </div>

      {!hidePhaseRail && (
        <div style={{ marginBottom: 16 }}>
          <PhaseRail currentPhase={project.current_phase} />
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-faint)', marginBottom: 4 }}>
              {project.code}
              {project.client && ` · ${project.client.name}`}
              {project.client_franchise && ` · ${project.client_franchise.code}`}
              {project.client_company && ` · ${project.client_company.name}`}
            </div>
            <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--fg-default)', margin: '0 0 6px' }}>
              {project.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StageBadge stage={project.current_stage} />
              {project.categories?.length > 0 && (
                <span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>
                  {project.categories.join(', ')}
                </span>
              )}
              {project.est_delivery_date && (
                <span style={{ fontSize: 13, color: isOverdue ? 'var(--status-danger)' : 'var(--fg-subtle)', fontWeight: isOverdue ? 600 : undefined }}>
                  · Due {fmtDateShort(project.est_delivery_date)}
                  {isOverdue && (
                    <span style={{ color: 'var(--status-danger)', fontWeight: 700 }}> · {overdueDays}d overdue</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Link href="/projects" className="btn btn-ghost btn-sm">← Back</Link>
            <Link href={`/projects/${project.id}/handover`} className="btn btn-secondary btn-sm">Handover</Link>
            <Link href={`/projects/${project.id}/finalization`} className="btn btn-secondary btn-sm">Finalization</Link>
            <Link href={`/projects/${project.id}/delivery`} className="btn btn-secondary btn-sm">Delivery</Link>
            {permCan(userPerms, 'page.production') && (
              <Link href={`/projects/${project.id}/types`} className="btn btn-secondary btn-sm">Types</Link>
            )}
            {['ops_manager', 'general_manager', 'accountant', 'accounting', 'trustlines_pm'].includes(userRole) && (
              <Link href={`/projects/${project.id}/finance`} className="btn btn-secondary btn-sm">Finance</Link>
            )}
            <button className="btn btn-secondary btn-sm">Export</button>
            {(userRole === 'ops_manager' || userRole === 'general_manager') && (
              <Link href={`/projects/${project.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
            )}
            {can(userRole, 'project:delete') && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDelete}
                disabled={deleting}
                title="Move to trash"
                style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
              >
                {deleting ? '…' : '🗑'}
              </button>
            )}
          </div>
        </div>

      </div>

      {topSlot}

      <div className="tab-bar">
        {allTabs.map(tab => (
          <button
            key={tab}
            className={`tab-item${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' ? (
        <div className="detail-grid">
          <div>
            <ProjectWorkflow
              projectId={project.id}
              projectCode={project.code}
              dropboxRootPath={project.dropbox_root_path}
              categories={project.categories as never}
              userRole={userRole}
              userId={userId}
              initialSteps={steps}
              documents={(documents as never[])}
              onRequestUpload={(stepKey, phase, catGroup, docType) =>
                setWorkflowUpload({ stepKey, phase, catGroup, docType })
              }
              onStepsChanged={() => router.refresh()}
            />

            <FinanceCard project={project} documents={documents} userRole={userRole} />

            <DatesCard project={project} stageHistory={stageHistory} />

            {userRole !== 'tlines_pm' && (
              <InternalNotesCard projectId={project.id} userId={userId} initialNotes={notes} />
            )}

            <DocumentTable
              documents={documents}
              userRole={userRole}
              projectId={project.id}
              projectCode={project.code}
              dropboxRootPath={project.dropbox_root_path}
              onRefresh={() => router.refresh()}
            />

            <AuditTrail events={auditEvents} userRole={userRole} userId={userId} />
          </div>

          <div className="detail-rail">
            <ProjectRail
              project={project}
              userRole={userRole}
              userId={userId}
              notes={notes}
              stageHistory={stageHistory}
              team={team}
            />
          </div>
        </div>
      ) : activeTab === 'Plan Layout' ? (
        <PlanLayoutTab
          projectId={project.id}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          documents={documents}
          auditEvents={auditEvents}
          docType="plan_layout"
          title="Plan Layout"
          dropboxRootPath={project.dropbox_root_path}
          onSynced={() => router.refresh()}
          onFullyApproved={() => router.refresh()}
          trustlinesPmId={project.trustlines_pm?.id ?? null}
          tlinesPmId={project.tlines_pm_id}
        />
      ) : activeTab === 'Design Proposal' ? (
        <PlanLayoutTab
          projectId={project.id}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          documents={documents}
          auditEvents={auditEvents}
          docType="proposal"
          title="Design Proposal"
          dropboxRootPath={project.dropbox_root_path}
          onSynced={() => router.refresh()}
          onFullyApproved={() => router.refresh()}
          trustlinesPmId={project.trustlines_pm?.id ?? null}
          tlinesPmId={project.tlines_pm_id}
        />
      ) : activeTab === 'Construction Drawing' ? (
        <PlanLayoutTab
          projectId={project.id}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          documents={documents}
          auditEvents={auditEvents}
          docType="construction_drawings"
          title="Construction Drawing"
          dropboxRootPath={project.dropbox_root_path}
          onSynced={() => router.refresh()}
          onFullyApproved={() => router.refresh()}
          trustlinesPmId={project.trustlines_pm?.id ?? null}
          tlinesPmId={project.tlines_pm_id}
        />
      ) : dynamicTabs.includes(activeTab) ? (
        <CategoryTab
          projectId={project.id}
          userId={userId}
          userRole={userRole}
          userPerms={userPerms}
          catGroup={activeTab.toLowerCase()}
          categoryLabel={activeTab}
          documents={documents}
          auditEvents={auditEvents}
          dropboxRootPath={project.dropbox_root_path}
          onSynced={() => router.refresh()}
        />
      ) : (
        <ComingSoonTab label={activeTab} />
      )}

      {workflowUpload && (
        <FileUploadZone
          projectId={project.id}
          projectCode={project.code}
          dropboxRootPath={project.dropbox_root_path}
          userRole={userRole}
          presetDocType={workflowUpload.docType}
          onSuccess={() => router.refresh()}
          onClose={() => setWorkflowUpload(null)}
        />
      )}

    </>
  );
}
