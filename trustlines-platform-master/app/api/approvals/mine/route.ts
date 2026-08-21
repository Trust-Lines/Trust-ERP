import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvalStagesFor, signPermForStage } from '@/lib/approvals/stageConfig';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';

interface MyApproval {
  approvalId:    string;
  projectId:     string;
  projectName:   string;
  projectCode:   string;
  documentId:    string;
  fileName:      string;
  docType:       string;
  catGroup:      string | null;
  version:       number;
  versionNum:    number | null;
  stage:         number;
  totalStages:   number;
  isFinalStage:  boolean;
  stageLabel:    string;
  createdAt:     string;
}

function stageLabels(docType: string, catGroup: string | null, totalStages: number): string[] {
  if (docType === 'pf' && totalStages === 4) {
    return ['Production Manager', 'Project Manager', 'General Manager', 'Accountant'];
  }
  return approvalStagesFor(docType, catGroup).map(s => s.label);
}

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null };
  const myRole = profile?.role ?? '';
  const myPerms = await getRolePermissions(admin, myRole);

  const { data: pending } = await admin
    .from('document_approvals')
    .select('id, stage, status, document_id, project_id, doc_type, version_num, created_at, assigned_to')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(300) as {
      data: {
        id: string; stage: number; status: string; document_id: string;
        project_id: string; doc_type: string | null; version_num: number | null; created_at: string; assigned_to: string | null;
      }[] | null;
    };

  if (!pending?.length) return NextResponse.json({ approvals: [] });

  const allDocIds = [...new Set(pending.map(a => a.document_id))];
  const { data: docsData } = await admin.from('documents')
    .select('id, file_name, doc_type, cat_group, version, dropbox_version, status')
    .in('id', allDocIds) as { data: {
      id: string; file_name: string; doc_type: string; cat_group: string | null;
      version: number; dropbox_version: number | null; status: string;
    }[] | null };
  const docs = new Map((docsData ?? []).map(d => [d.id, d]));

  const approvals = pending.filter(a => {
    const doc = docs.get(a.document_id);
    if (!doc) return false;
    if (a.assigned_to === user.id) return true;
    const needPerm = signPermForStage(a.doc_type ?? doc.doc_type, doc.cat_group, a.stage);
    return !!needPerm && permCan(myPerms, needPerm);
  });

  if (!approvals.length) return NextResponse.json({ approvals: [] });

  const docIds  = [...new Set(approvals.map(a => a.document_id))];
  const projIds = [...new Set(approvals.map(a => a.project_id))];

  const { data: projsData } = await admin.from('projects')
    .select('id, name, code').in('id', projIds) as { data: { id: string; name: string; code: string }[] | null };
  const projs = new Map((projsData ?? []).map(p => [p.id, p]));

  const stageCounts = new Map<string, number>();
  const { data: stageRows } = await admin
    .from('document_approvals').select('document_id').in('document_id', docIds) as {
      data: { document_id: string }[] | null;
    };
  for (const r of stageRows ?? []) stageCounts.set(r.document_id, (stageCounts.get(r.document_id) ?? 0) + 1);

  const result: MyApproval[] = [];
  for (const a of approvals) {
    const doc = docs.get(a.document_id);
    if (!doc) continue;
    if (doc.status === 'rejected') continue;
    const proj = projs.get(a.project_id);
    const totalStages = stageCounts.get(a.document_id) ?? 0;
    const labels = stageLabels(a.doc_type ?? doc.doc_type, doc.cat_group, totalStages);

    result.push({
      approvalId:   a.id,
      projectId:    a.project_id,
      projectName:  proj?.name ?? 'Unknown project',
      projectCode:  proj?.code ?? '',
      documentId:   a.document_id,
      fileName:     doc.file_name,
      docType:      a.doc_type ?? doc.doc_type,
      catGroup:     doc.cat_group,
      version:      doc.dropbox_version ?? doc.version,
      versionNum:   a.version_num,
      stage:        a.stage,
      totalStages,
      isFinalStage: totalStages >= 1 && a.stage === totalStages,
      stageLabel:   labels[a.stage - 1] ?? `Stage ${a.stage}`,
      createdAt:    a.created_at,
    });
  }

  return NextResponse.json({ approvals: result });
}
