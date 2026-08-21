import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CONTAINER_READ_ROLES, CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, container_id, doc_type, name, dropbox_path, url, created_at';
const DOC_TYPES = ['bill_of_lading', 'packing_list', 'customs', 'invoice', 'other'];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(CONTAINER_READ_ROLES);
  if (deny) return deny;
  const { data } = await admin.from('container_documents').select(COLS)
    .eq('container_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'A document name is required' }, { status: 400 });
  const docType = String(body.doc_type ?? 'other');
  if (!DOC_TYPES.includes(docType)) return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });

  const { data: container } = await admin.from('containers').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!container) return NextResponse.json({ error: 'Container not found' }, { status: 404 });

  const insert = {
    container_id: id, doc_type: docType, name,
    dropbox_path: str(body.dropbox_path), url: str(body.url), uploaded_by: user.id,
  };
  const { data, error } = await admin.from('container_documents').insert(insert).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'container.document_added', resource: `container:${id}`, newValue: { name, docType } });
  return NextResponse.json({ document: data });
}

function str(v: unknown): string | null { const s = String(v ?? '').trim(); return s || null; }
