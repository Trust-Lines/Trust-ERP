import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { assertLeadAccess } from '@/lib/sales/leadAccess';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: intake } = await admin.from('lead_intake')
    .select('project_id, is_delivered').eq('id', id).maybeSingle();
  const row = intake as { project_id: string | null; is_delivered: boolean } | null;
  if (!row?.is_delivered || !row.project_id) {
    return NextResponse.json({ delivered: false });
  }

  const projectId = row.project_id;
  const [projRes, stepsRes, docsRes] = await Promise.all([
    admin.from('projects').select('code, name, current_stage, current_phase').eq('id', projectId).single(),
    admin.from('project_steps').select('phase, step_key, cat_group, status, completed_at').eq('project_id', projectId),
    admin.from('documents').select('doc_type, status, uploaded_at').eq('project_id', projectId).neq('doc_type', 'pf'),
  ]);

  const project = (projRes.data as { code: string; name: string; current_stage: string; current_phase: string } | null) ?? null;
  const steps = (stepsRes.data ?? []) as { phase: string; step_key: string; cat_group: string | null; status: string }[];

  const docCounts: Record<string, number> = {};
  for (const d of (docsRes.data ?? []) as { doc_type: string }[]) {
    docCounts[d.doc_type] = (docCounts[d.doc_type] ?? 0) + 1;
  }

  return NextResponse.json({
    delivered: true,
    project,
    steps: steps.map(s => ({ phase: s.phase, step_key: s.step_key, cat_group: s.cat_group, status: s.status })),
    documents: docCounts,
  });
}
