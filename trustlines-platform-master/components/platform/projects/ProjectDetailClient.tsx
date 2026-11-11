'use client';

import { ChevronRight, Copy, FolderInput, Trash } from 'lucide-react';
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
import { ProjectFiles } from './ProjectFiles';
import { ProjectTabContext } from './projectTabContext';
import { permCan } from '@/lib/permissions/catalog';
import { can } from '@/lib/permissions/can';
import type { ProjectStage, ProjectPhase } from '@/types/database';
import type { StepRecord } from '@/lib/workflow/steps';
import { cn } from '@/lib/utils';
import { PROJECT_FINANCE_READ_ROLES } from '@/lib/finance/projectTotals';

// Figma "Project Detail" (node 245:28820).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const BTN_OUTLINE = 'inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-solid border-[var(--color-secondary-700)] bg-transparent px-3.5 text-[13px] font-semibold text-[var(--color-secondary-700)] no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading dark:text-ui-heading';
const BTN_PRIMARY = 'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-primary-50 dark:text-primary-950';

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
  ops_manager: ProfileSnippet | null;
  trustlines_pm: ProfileSnippet | null;
  tlines_pm: ProfileSnippet | null;
  prod_pm_ms: ProfileSnippet | null;
  prod_pm_ci: ProfileSnippet | null;
  qc_inspector: ProfileSnippet | null;
  tlines_pm_id: string | null;
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
  const hasPFSigned = documents.some(d => d.doc_type === 'pf' && d.status === 'signed');
  const noValue = `${S} -`;
  const note = (text: string) => <span className="text-[14px] font-normal tracking-normal">{text}</span>;

  return (
    <div className="flex flex-col gap-2.5 rounded-[8px] border border-ui-divider bg-ui-page-bg pb-5 pl-4 pr-[18px] pt-3.5">
      <h2 className={cn('m-0 text-[20px] font-semibold tracking-[0.4px]', HEADING)}>
        {/* Opens the Finance tab for roles that can read it (same list the finance page enforces). */}
        {(PROJECT_FINANCE_READ_ROLES as readonly string[]).includes(userRole) ? (
          <Link href={`/projects/${project.id}/finance`} className="inline-flex items-center gap-1.5 text-inherit no-underline hover:underline">
            Finance <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : 'Finance'}
      </h2>
      {/* Figma 445:7500: one row — EST. Value, Total PF, Total PO, Margin. */}
      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 2xl:grid-cols-4">
        <FinanceTile label="EST. Value" currency={currency}>
          {project.deal_value != null ? fmt(project.deal_value) : noValue}
        </FinanceTile>
        <FinanceTile label="Total PF" currency={hideSensitive ? undefined : currency}>
          {hideSensitive
            ? <PermissionShield label="Restricted" />
            : hasPFSigned ? noValue : note('No PF yet')}
        </FinanceTile>
        <FinanceTile label="Total PO" currency={currency}>
          {hasPOSigned ? noValue : note('No PO yet')}
        </FinanceTile>
        <FinanceTile label="Margin">
          {hideSensitive
            ? <PermissionShield label="Restricted" />
            : project.margin_target_pct != null
              ? (
                <span style={{
                  color: project.margin_target_pct >= 0 ? undefined : 'var(--status-t10-fg)',
                }}>
                  {project.margin_target_pct}%
                </span>
              )
              : noValue}
        </FinanceTile>
      </div>
    </div>
  );
}

function FinanceTile({ label, currency, children }: { label: string; currency?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-col justify-center gap-1 rounded-[8px] py-3.5 pl-4 pr-4"
      style={{ background: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}
    >
      <p className="m-0 text-[14px] leading-[1.5] tracking-[-0.308px]">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[30px] font-semibold leading-[1.5] tracking-[0.6px]">{children}</div>
        {currency && (
          <span className="rounded-[4px] bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px]">{currency}</span>
        )}
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
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
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
          { label: 'Closed deal', value: fmtDate(project.closed_deal_date) },
          { label: 'PO signed', value: poSignedTransition ? fmtDate(poSignedTransition.created_at) : '—' },
          {
            label: 'Est. delivery', value: (
              <span style={{ color: isOverdue ? 'var(--status-danger)' : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                {fmtDate(project.est_delivery_date)}
                {project.hard_deadline && (
                  <span className="pill" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)', marginLeft: 6, fontSize: 9 }}>
                    HARD DEADLINE
                  </span>
                )}
              </span>
            )
          },
          { label: 'Last updated', value: relTime(project.updated_at) },
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const TAB_SLUG_MAP: Record<string, string> = {
    plan_layout: 'Plan Layout',
    design_proposal: 'Design Proposal',
    construction_drawing: 'Construction Drawing',
    files: 'Files',
  };
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    initialTab && TAB_SLUG_MAP[initialTab] ? TAB_SLUG_MAP[initialTab] : 'Overview',
  );
  const [deleting, setDeleting] = useState(false);
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
        phase: 'phase1',
        step_key: 'closed_deal',
        cat_group: null,
        status: 'done',
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_approvals', filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_versions', filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log', filter: `project_id=eq.${project.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_steps', filter: `project_id=eq.${project.id}` }, () => router.refresh())
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
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const json = await res.json() as { error?: string };
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return; }
      toast.success('Project moved to trash');
      router.push('/projects');
    } finally { setDeleting(false); }
  }

  const dynamicTabs = project.categories ?? [];
  const TAB_PERM: Record<string, string> = {
    'Overview': 'view.tab_overview',
    'Plan Layout': 'view.tab_plan_layout',
    'Design Proposal': 'view.tab_design_proposal',
    'Construction Drawing': 'view.tab_construction',
  };
  const tabPermKey = (tab: string) => TAB_PERM[tab] ?? `view.tab_${tab.toLowerCase()}`;
  const allTabs = [
    'Overview',
    'Plan Layout',
    'Design Proposal',
    'Construction Drawing',
    ...dynamicTabs,
    // The whole Dropbox folder, live — anyone who can open the project (no separate tab permission).
    ...(project.dropbox_root_path ? ['Files'] : []),
  ].filter(tab => tab === 'Overview' || tab === 'Files' || permCan(userPerms, tabPermKey(tab)));

  function fmtDateShort(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(project.code); toast.success('Project code copied'); }
    catch { toast.error('Could not copy'); }
  }

  const clientLine = [
    project.client?.name, project.client_franchise?.code, project.client_company?.name,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div className="mb-[18px] flex flex-col gap-[18px]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] leading-[1.4]">
          <Link href="/projects" className="text-ui-text-secondary no-underline hover:underline">Supply</Link>
          <ChevronRight aria-hidden className="size-3 text-ui-text-secondary" />
          <Link href="/projects" className="text-ui-body no-underline hover:underline">Projects</Link>
          <ChevronRight aria-hidden className="size-3 text-ui-text-secondary" />
          <Link href={`/projects/${project.id}`} aria-current="page" className="text-ui-body no-underline hover:underline">#{project.code}</Link>
        </nav>

        {!hidePhaseRail && <PhaseRail currentPhase={project.current_phase} />}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2.5 text-[30px] leading-normal" style={{ color: 'var(--status-t4-fg)' }}>
              <span># {project.code}</span>
              <button
                type="button" onClick={copyCode} aria-label="Copy project code"
                className="grid size-[26px] place-items-center border-0 bg-transparent p-0 text-inherit hover:opacity-70"
              >
                <Copy size={26} aria-hidden />
              </button>
            </div>
            <h1 className="m-0 text-[30px] font-semibold leading-normal" style={{ color: 'var(--status-t4-fg)' }}>
              {project.name}
            </h1>
            {clientLine && <p className="m-0 text-[13px] text-ui-body">{clientLine}</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              <StageBadge stage={project.current_stage} />
              {project.categories?.length > 0 && (
                <span className="text-[13px] text-ui-body">{project.categories.join(', ')}</span>
              )}
              {project.est_delivery_date && (
                <span className={cn('text-[13px]', isOverdue ? 'font-semibold' : 'text-ui-body')} style={isOverdue ? { color: 'var(--status-t10-fg)' } : undefined}>
                  · Due {fmtDateShort(project.est_delivery_date)}
                  {isOverdue && <span className="font-bold"> · {overdueDays}d overdue</span>}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Link href="/projects" className={BTN_OUTLINE}>← Back</Link>
            <Link href={`/projects/${project.id}/handover`} className={BTN_OUTLINE}>Handover</Link>
            <Link href={`/projects/${project.id}/finalization`} className={BTN_OUTLINE}>Finalization</Link>
            <Link href={`/projects/${project.id}/delivery`} className={BTN_OUTLINE}>Delivery</Link>
            {permCan(userPerms, 'page.production') && (
              <Link href={`/projects/${project.id}/types`} className={BTN_OUTLINE}>Types</Link>
            )}
            {(PROJECT_FINANCE_READ_ROLES as readonly string[]).includes(userRole) && (
              <Link href={`/projects/${project.id}/finance`} className={BTN_OUTLINE}>Finance</Link>
            )}
            {(userRole === 'ops_manager' || userRole === 'general_manager') && (
              <Link href={`/projects/${project.id}/edit`} className={BTN_OUTLINE}>Edit</Link>
            )}
            <button type="button" className={BTN_PRIMARY}><FolderInput size={16} aria-hidden /> Export File</button>
            {can(userRole, 'project:delete') && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                title="Move to trash"
                aria-label="Move to trash"
                className="inline-flex h-10 items-center justify-center rounded-[6px] border-0 px-3.5 transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}
              >
                {deleting ? '…' : <Trash size={16} aria-hidden />}
              </button>
            )}
          </div>
        </div>

        {/* Figma 445:7500: the cockpit (lifecycle, counts, next actions, types) sits above the tabs. */}
        <ProjectTabContext.Provider value={activeTab}>{topSlot}</ProjectTabContext.Provider>

        {/* ── Saved views (underline tabs, 48px, 3px active border) ── */}
        <div role="tablist" aria-label="Project sections" className="flex h-12 items-stretch gap-8 overflow-x-auto border-b border-ui-divider">
          {allTabs.map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex shrink-0 items-center whitespace-nowrap border-0 border-b-[3px] border-solid bg-transparent px-0 text-[13px] leading-[1.4]',
                  active
                    ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                    : 'border-transparent text-ui-text-secondary hover:text-ui-body',
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <div className="flex flex-col gap-[18px]">
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

          {/* Figma 445:7500: Finance over Team / Time Line / Internal Notes / Integration, Activity on the right.
              Key dates and Documents stay in the left column too, and Activity sticks below the top bar
              while the page scrolls — before, they ran full width under a tall Activity column and left
              an empty gap beside the cards. */}
          <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_398px]">
            <div className="flex min-w-0 flex-col gap-5">
              <FinanceCard project={project} documents={documents} userRole={userRole} />
              <ProjectRail
                project={project}
                userRole={userRole}
                userId={userId}
                notes={notes}
                stageHistory={stageHistory}
                team={team}
              />
              {/* Not in the frame, kept: key dates and the project's documents. */}
              <DatesCard project={project} stageHistory={stageHistory} />
              <DocumentTable
                documents={documents}
                userRole={userRole}
                projectId={project.id}
                projectCode={project.code}
                dropboxRootPath={project.dropbox_root_path}
                onRefresh={() => router.refresh()}
              />
            </div>
            <AuditTrail
              events={auditEvents} userRole={userRole} userId={userId}
              className="xl:sticky xl:top-[100px] xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto"
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
      ) : activeTab === 'Files' ? (
        <ProjectFiles projectId={project.id} />
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
