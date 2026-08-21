import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { APPROVAL_LINK_ROLES, generateReviewToken, hashReviewToken } from '@/lib/approvals/reviewToken';

type Params = { params: Promise<{ id: string }> };
const LIST_COLS = 'id, project_id, document_id, customer_contact_id, title, status, decision, expires_at, max_views, view_count, require_email_verification, first_opened_at, completed_at, revoked_at, created_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(APPROVAL_LINK_ROLES);
  if (deny) return deny;
  const res = await admin.from('approval_links').select(LIST_COLS).eq('project_id', id).order('created_at', { ascending: false });
  if (res.error) return NextResponse.json({ links: [] });
  return NextResponse.json({ links: res.data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(APPROVAL_LINK_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as {
    documentId?: string | null; customerContactId?: string | null; title?: string;
    expiresInDays?: number | null; maxViews?: number | null; requireEmailVerification?: boolean;
  } | null;

  if (b?.documentId) {
    const { data: doc } = await admin.from('documents').select('id, doc_type').eq('id', b.documentId).eq('project_id', id).maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found on this project' }, { status: 404 });
    if ((doc as { doc_type?: string }).doc_type === 'pf') {
      return NextResponse.json({ error: 'PF documents can never be shared externally' }, { status: 400 });
    }
  }

  const token = generateReviewToken();
  const expiresAt = b?.expiresInDays && b.expiresInDays > 0
    ? new Date(Date.now() + b.expiresInDays * 86400_000).toISOString() : null;

  const { data, error } = await admin.from('approval_links').insert({
    project_id: id,
    document_id: b?.documentId || null,
    customer_contact_id: b?.customerContactId || null,
    title: b?.title?.trim() || null,
    token_hash: hashReviewToken(token),
    status: 'active',
    expires_at: expiresAt,
    max_views: b?.maxViews && b.maxViews > 0 ? b.maxViews : null,
    require_email_verification: b?.requireEmailVerification !== false,
    created_by: user.id,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'approval_link.created', projectId: id, resource: `approval_link:${data.id}`, newValue: { documentId: b?.documentId ?? null } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({ id: data.id, url: `${appUrl}/review/${token}`, token }, { status: 201 });
}
