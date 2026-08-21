import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectDetailClient } from '@/components/platform/projects/ProjectDetailClient';
import { ProjectCockpit } from '@/components/platform/projects/ProjectCockpit';
import { loadCockpit } from '@/lib/lifecycle/cockpitData';
import { typesForCategories } from '@/lib/production/board';
import { deriveTeam, type TeamCandidate } from '@/lib/team/derive';
import { getNextStage, STAGE_PHASE } from '@/lib/workflow/machine';
import { getRolePermissions } from '@/lib/permissions/server';
import type { ProjectStage } from '@/types/database';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [
    profileRes,
    projectRes,
    documentsRes,
    stageHistoryRes,
    auditRes,
    notesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, role').eq('id', user.id).single(),

    sb.from('projects').select('*').eq('id', id).single(),

    sb.from('documents').select('id, project_id, doc_type, version, status, dropbox_path, dropbox_file_id, dropbox_rev, file_name, file_size_bytes, mime_type, uploaded_by, approved_by, signed_by, approved_at, signed_at, uploaded_at, branch, notes, created_at, updated_at, cat_group, step_key, dropbox_version, prod_type, revision_count, last_revised_at, version_set_id, pf_meta').eq('project_id', id).order('created_at', { ascending: false }),

    sb.from('stage_transitions')
      .select('id, from_stage, to_stage, transitioned_by, is_override, override_reason, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),

    sb.from('audit_log')
      .select('id, action, old_value, new_value, created_at, actor_id')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(30),

    sb.from('project_notes')
      .select('id, content, is_internal, created_at, author_id')
      .eq('project_id', id)
      .eq('is_internal', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  let stepsRes = await sb
    .from('project_steps').select('*').eq('project_id', id).order('created_at', { ascending: true });

  const project = projectRes.data;
  if (!project) {
    if (projectRes.error) {
      console.error('[project/[id]] query failed:', projectRes.error.message);
    }
    notFound();
  }

  {
    const admin = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    type RepairDoc  = { id: string; status: string; approved_at: string | null; approved_by: string | null; dropbox_version: number | null; version: number };
    type RepairStep = { id: string; phase: string; step_key: string; status: string; notes: string | null };

    const DOC_STEP_MAP = [
      { docType: 'plan_layout',           phase: 'phase1', stepKey: 'plan_layout' },
      { docType: 'proposal',              phase: 'phase1', stepKey: 'design_proposal' },
      { docType: 'construction_drawings', phase: 'phase2', stepKey: 'construction_drawings' },
    ] as const;

    const { data: repairDocs } = await admin
      .from('documents').select('id, status, approved_at, approved_by, dropbox_version, version, doc_type')
      .eq('project_id', id).in('doc_type', DOC_STEP_MAP.map(d => d.docType)) as {
        data: (RepairDoc & { doc_type: string })[] | null;
      };
    const repairByType = new Map<string, RepairDoc[]>();
    for (const d of repairDocs ?? []) { const a = repairByType.get(d.doc_type) ?? []; a.push(d); repairByType.set(d.doc_type, a); }
    const currentSteps = (stepsRes.data ?? []) as RepairStep[];
    let repairChanged = false;

    for (const { docType, phase, stepKey } of DOC_STEP_MAP) {
      const existingStep = currentSteps.find(s => s.phase === phase && s.step_key === stepKey);

      const docs = repairByType.get(docType);
      if (!docs || docs.length === 0) continue;

      const maxVer = Math.max(...docs.map(d => d.dropbox_version ?? d.version ?? 0));
      const latestDocs = docs.filter(d => (d.dropbox_version ?? d.version ?? 0) === maxVer);
      const latestAllApproved = latestDocs.every(d => d.status === 'approved');
      const latestAnyRejected = latestDocs.some(d => d.status === 'rejected');
      const now = new Date().toISOString();

      if (existingStep?.status === 'rejected' && !latestAnyRejected && !latestAllApproved) {
        await admin.from('project_steps').delete().eq('id', existingStep.id);

      } else if (latestAllApproved && existingStep?.status !== 'approved') {
        const latest = [...latestDocs].sort((a, b) =>
          new Date(b.approved_at ?? '').getTime() - new Date(a.approved_at ?? '').getTime()
        )[0];
        const payload = {
          status: 'approved',
          completed_by:     latest.approved_by ?? user.id,
          completed_at:     latest.approved_at ?? now,
          approved_by:      latest.approved_by ?? user.id,
          approved_at:      latest.approved_at ?? now,
          version_approved: latest.dropbox_version ?? latest.version ?? null,
          notes:            null,
        };
        if (existingStep) {
          await admin.from('project_steps').update(payload).eq('id', existingStep.id);
        } else {
          await admin.from('project_steps').insert({ project_id: id, phase, step_key: stepKey, cat_group: null, ...payload });
        }

      } else if (latestAnyRejected && !latestAllApproved && existingStep?.status !== 'rejected') {
        const rejectedDoc = latestDocs.find(d => d.status === 'rejected')!;
        const { data: rejApproval } = await admin
          .from('document_approvals').select('notes, approved_by')
          .eq('document_id', rejectedDoc.id).eq('status', 'rejected')
          .order('stage', { ascending: false }).limit(1).maybeSingle() as
          { data: { notes: string | null; approved_by: string | null } | null };
        let stepNote = 'Revision required';
        if (rejApproval?.approved_by) {
          const { data: profile } = await admin.from('profiles').select('full_name')
            .eq('id', rejApproval.approved_by).single() as { data: { full_name?: string } | null };
          const name = (profile as { full_name?: string } | null)?.full_name ?? 'Unknown';
          stepNote = rejApproval.notes ? `Rejected by ${name}: ${rejApproval.notes}` : `Rejected by ${name}`;
        }
        const rejPayload = { status: 'rejected', notes: stepNote };
        if (existingStep) {
          await admin.from('project_steps').update(rejPayload).eq('id', existingStep.id);
        } else {
          await admin.from('project_steps').insert({ project_id: id, phase, step_key: stepKey, cat_group: null, completed_by: user.id, completed_at: now, ...rejPayload });
        }
      } else {
        continue;
      }
      repairChanged = true;
    }
    if (repairChanged) {
      stepsRes = await (admin as any).from('project_steps').select('*').eq('project_id', id).order('created_at', { ascending: true });
    }
  }

  {
    const admin = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    type P3Doc  = { id: string; status: string; approved_at: string | null; approved_by: string | null; dropbox_version: number | null; version: number; cat_group: string | null; file_name: string };
    type P3Step = { id: string; phase: string; step_key: string; cat_group: string | null; status: string };

    const PROD_STEP_MAP = [
      { docType: 'proposal',   stepKey: 'proposal' },
      { docType: 'item_plan',  stepKey: 'item_plan' },
      { docType: 'item_list',  stepKey: 'item_list' },
      { docType: 'price_list', stepKey: 'item_price_list' },
      { docType: 'book',       stepKey: 'book' },
      { docType: 'po_bo',      stepKey: 'po' },
      { docType: 'pf',         stepKey: 'pfs' },
    ] as const;

    const { data: allProdDocs } = await admin
      .from('documents').select('id, status, approved_at, approved_by, dropbox_version, version, cat_group, file_name, doc_type')
      .eq('project_id', id).in('doc_type', PROD_STEP_MAP.map(p => p.docType)).not('cat_group', 'is', null) as {
        data: (P3Doc & { doc_type: string })[] | null;
      };
    const docsByType = new Map<string, P3Doc[]>();
    for (const d of allProdDocs ?? []) { const a = docsByType.get(d.doc_type) ?? []; a.push(d); docsByType.set(d.doc_type, a); }

    let changed = false;
    for (const { docType, stepKey } of PROD_STEP_MAP) {
      const docs = docsByType.get(docType);
      if (!docs?.length) continue;

      const byCat = new Map<string, P3Doc[]>();
      for (const d of docs) { if (!d.cat_group) continue; const a = byCat.get(d.cat_group) ?? []; a.push(d); byCat.set(d.cat_group, a); }

      for (const [cat, list] of byCat) {
        let approvedDocs: P3Doc[];
        if (docType === 'pf') {
          const byCode = new Map<string, P3Doc[]>();
          for (const d of list) { const code = d.file_name.split(' - PF')[0]; const a = byCode.get(code) ?? []; a.push(d); byCode.set(code, a); }
          approvedDocs = [];
          let allApproved = byCode.size > 0;
          for (const [, series] of byCode) {
            const mv = Math.max(...series.map(d => d.dropbox_version ?? d.version ?? 0));
            const ap = series.filter(d => (d.dropbox_version ?? d.version ?? 0) === mv && d.status === 'approved');
            if (!ap.length) { allApproved = false; break; }
            approvedDocs.push(...ap);
          }
          if (!allApproved) approvedDocs = [];
        } else {
          const maxVer = Math.max(...list.map(d => d.dropbox_version ?? d.version ?? 0));
          approvedDocs = list.filter(d => (d.dropbox_version ?? d.version ?? 0) === maxVer && d.status === 'approved');
        }

        const steps = (stepsRes.data ?? []) as P3Step[];
        const existing = steps.find(s => s.phase === 'phase3' && s.step_key === stepKey && s.cat_group === cat);

        if (!approvedDocs.length) {
          if (existing && (existing.status === 'approved' || existing.status === 'done')) {
            await admin.from('project_steps').delete().eq('id', existing.id);
            changed = true;
          }
          continue;
        }
        if (existing && (existing.status === 'approved' || existing.status === 'done')) continue;

        const top = [...approvedDocs].sort((a, b) => new Date(b.approved_at ?? '').getTime() - new Date(a.approved_at ?? '').getTime())[0];
        const now = new Date().toISOString();
        const payload = {
          status: 'approved',
          completed_by:     top.approved_by ?? user.id,
          completed_at:     top.approved_at ?? now,
          approved_by:      top.approved_by ?? user.id,
          approved_at:      top.approved_at ?? now,
          version_approved: top.dropbox_version ?? top.version ?? null,
          notes:            null,
        };
        if (existing) await admin.from('project_steps').update(payload).eq('id', existing.id);
        else          await admin.from('project_steps').insert({ project_id: id, phase: 'phase3', step_key: stepKey, cat_group: cat, ...payload });
        changed = true;
      }
    }
    if (changed) {
      stepsRes = await (admin as any).from('project_steps').select('*').eq('project_id', id).order('created_at', { ascending: true });
    }
  }

  if ((project as { closed_deal_date?: string | null }).closed_deal_date) {
    const steps = (stepsRes.data ?? []) as { phase: string; step_key: string; status: string }[];
    const hasClosedDeal = steps.some(
      s => s.phase === 'phase1' && s.step_key === 'closed_deal' &&
           (s.status === 'done' || s.status === 'approved'),
    );
    if (!hasClosedDeal) {
      const admin = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const closedAt = new Date(
        (project as { closed_deal_date: string }).closed_deal_date,
      ).toISOString();
      const { error: stepErr } = await admin.from('project_steps').insert({
        project_id:   id,
        phase:        'phase1',
        step_key:     'closed_deal',
        cat_group:    null,
        status:       'done',
        completed_by: user.id,
        completed_at: closedAt,
      });
      if (!stepErr) {
        const refreshed = await (admin as any)
          .from('project_steps').select('*').eq('project_id', id).order('created_at', { ascending: true });
        stepsRes = refreshed;
      }
    }
  }

  {
    const admin = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const STAGE_GATES: Record<string, { phase: string; stepKeys: string[] }> = {
      closed_deal:     { phase: 'phase1', stepKeys: ['closed_deal'] },
      finalization:    { phase: 'phase1', stepKeys: ['closed_deal', 'plan_layout', 'design_proposal', 'client_approval'] },
      client_approval: { phase: 'phase2', stepKeys: ['construction_drawings'] },
    };

    let currentStage = (project as { current_stage: string }).current_stage;

    let advanced = true;
    while (advanced) {
      advanced = false;
      const gate = STAGE_GATES[currentStage];
      if (!gate) break;

      const allSteps = (stepsRes.data ?? []) as { phase: string; step_key: string; status: string }[];
      const allGateDone = gate.stepKeys.every(key => {
        const s = allSteps.find(r => r.phase === gate.phase && r.step_key === key);
        return s?.status === 'done' || s?.status === 'approved';
      });

      if (allGateDone) {
        const nextStage = getNextStage(currentStage as ProjectStage);
        if (nextStage) {
          const nextPhase = STAGE_PHASE[nextStage];
          await admin.from('projects')
            .update({ current_stage: nextStage, current_phase: nextPhase })
            .eq('id', id);
          await admin.from('stage_transitions').insert({
            project_id:      id,
            from_stage:      currentStage,
            to_stage:        nextStage,
            transitioned_by: user.id,
            is_override:     false,
          });
          await admin.from('audit_log').insert({
            project_id: id, actor_id: user.id,
            action:     'stage.auto_advanced',
            old_value:  { stage: currentStage },
            new_value:  { stage: nextStage },
          });
          (project as Record<string, unknown>).current_stage = nextStage;
          (project as Record<string, unknown>).current_phase  = nextPhase;
          currentStage = nextStage;
          advanced = true;
        }
      }
    }
  }

  const profileData = profileRes.data as { id: string; role: string } | null;
  const userRole: string = profileData?.role ?? 'ops_manager';
  const userPerms = await getRolePermissions(createAdminClient() as never, userRole);

  if (userRole === 'tlines_pm' && project.tlines_pm_id !== user.id) {
    redirect('/projects');
  }

  const profileIds = [
    project.ops_manager_id,
    project.trustlines_pm_id,
    project.tlines_pm_id,
    project.prod_pm_ms_id,
    project.prod_pm_ci_id,
    project.qc_inspector_id,
    project.pm_supervisor_id,
    ...(stageHistoryRes.data ?? []).map((t: { transitioned_by: string | null }) => t.transitioned_by),
    ...(auditRes.data      ?? []).map((e: { actor_id: string | null })          => e.actor_id),
    ...(notesRes.data      ?? []).map((n: { author_id: string | null })         => n.author_id),
  ].filter((x): x is string => !!x);

  const uniqueProfileIds = [...new Set(profileIds)];

  const [profilesRes, clientRes, franchiseRes, companyRes, candidatesRes] = await Promise.all([
    uniqueProfileIds.length > 0
      ? sb.from('profiles').select('id, full_name').in('id', uniqueProfileIds)
      : Promise.resolve({ data: [] }),

    project.client_id
      ? sb.from('clients').select('id, name, code').eq('id', project.client_id).single()
      : Promise.resolve({ data: null }),

    project.client_franchise_id
      ? sb.from('client_franchises').select('id, name, code').eq('id', project.client_franchise_id).single()
      : Promise.resolve({ data: null }),

    project.client_company_id
      ? sb.from('client_companies').select('id, name').eq('id', project.client_company_id).single()
      : Promise.resolve({ data: null }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createAdminClient() as any).from('profiles')
      .select('id, full_name, role, skills, department').eq('is_active', true).order('full_name').limit(300),
  ]);

  const profileMap = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p])
  );

  const snap = (fkId: string | null) =>
    fkId ? (profileMap.get(fkId) ?? null) : null;

  const stageHistory = (stageHistoryRes.data ?? []).map((t: {
    id: string; from_stage: string; to_stage: string;
    transitioned_by: string | null; is_override: boolean;
    override_reason: string | null; created_at: string;
  }) => ({
    ...t,
    actor: snap(t.transitioned_by) ? { full_name: snap(t.transitioned_by)!.full_name } : null,
  }));

  const auditEvents = (auditRes.data ?? []).map((e: {
    id: string; action: string; old_value: unknown;
    new_value: unknown; created_at: string; actor_id: string | null;
  }) => ({
    ...e,
    actor: snap(e.actor_id) ? { full_name: snap(e.actor_id)!.full_name } : null,
  }));

  const notes = (notesRes.data ?? []).map((n: {
    id: string; content: string; is_internal: boolean;
    created_at: string; author_id: string | null;
  }) => ({
    ...n,
    author: snap(n.author_id) ? { full_name: snap(n.author_id)!.full_name } : null,
  }));

  const fullProject = {
    ...project,
    client:           clientRes.data   ?? null,
    client_franchise: franchiseRes.data ?? null,
    client_company:   companyRes.data   ?? null,
    ops_manager:      snap(project.ops_manager_id),
    trustlines_pm:    snap(project.trustlines_pm_id),
    tlines_pm:        snap(project.tlines_pm_id),
    prod_pm_ms:       snap(project.prod_pm_ms_id),
    prod_pm_ci:       snap(project.prod_pm_ci_id),
    qc_inspector:     snap(project.qc_inspector_id),
  };

  let cockpit: Awaited<ReturnType<typeof loadCockpit>> = null;
  try {
    cockpit = await loadCockpit(createAdminClient() as never, id, userRole);
  } catch (e) {
    console.error('[project/[id]] cockpit load failed:', e instanceof Error ? e.message : e);
  }

  const projectTypes = typesForCategories(project.categories);
  const teamCandidates = (candidatesRes.error ? [] : (candidatesRes.data ?? [])) as TeamCandidate[];
  const isExternalRole = userRole === 'tlines_pm' || userRole === 'sales_rep' || userRole === 'sales_marketing_manager';
  const team = isExternalRole ? [] : deriveTeam(
    {
      ops_manager:   snap(project.ops_manager_id),
      trustlines_pm: snap(project.trustlines_pm_id),
      tlines_pm:     snap(project.tlines_pm_id),
      prod_pm_ms:    snap(project.prod_pm_ms_id),
      prod_pm_ci:    snap(project.prod_pm_ci_id),
      qc_inspector:  snap(project.qc_inspector_id),
      pm_supervisor: snap(project.pm_supervisor_id),
    },
    projectTypes,
    teamCandidates,
  );

  const topSlot = cockpit ? (
    <div style={{ marginBottom: 20 }}>
      <ProjectCockpit
        projectId={cockpit.projectId}
        phase={cockpit.lifecycle.phase}
        rail={cockpit.rail}
        blockers={cockpit.lifecycle.blockers}
        perType={cockpit.lifecycle.perType}
        nextActions={cockpit.nextActions}
        pending={cockpit.pending}
        canSeeInternal={cockpit.canSeeInternal}
        pmNames={{ tlines_pm_id: snap(project.tlines_pm_id)?.full_name ?? null, trustlines_pm_id: snap(project.trustlines_pm_id)?.full_name ?? null }}
      />
    </div>
  ) : null;

  return (
    <ProjectDetailClient
      project={fullProject}
      userId={user.id}
      userRole={userRole}
      userPerms={userPerms}
      documents={documentsRes.data ?? []}
      stageHistory={stageHistory}
      auditEvents={auditEvents}
      notes={notes}
      steps={stepsRes.data ?? []}
      team={team}
      topSlot={topSlot}
      hidePhaseRail={!!cockpit}
    />
  );
}
