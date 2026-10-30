import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { NOT_READY, requireDesignPage, tableMissing } from '@/lib/design/access';
import { dropboxError, fileIn, uploadLinkIn } from '@/lib/design/dropboxDirect';
import { ASSET_KINDS, LIBRARY_ROOT, assetFolder, parseTags } from '@/lib/design/libraryPaths';

const COLS = 'id, kind, title, description, tags, dropbox_path, file_name, size_bytes, created_by, created_at, updated_at';
const KINDS: string[] = ASSET_KINDS.map(k => k.value);

// Asset Library — reusable templates, CAD blocks, render setups and standard details, stored in
// Dropbox under /Design/Library/<kind>.
export async function GET() {
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_assets');
  if (deny) return deny;
  const { data, error } = await admin.from('design_assets').select(COLS).is('deleted_at', null).order('created_at', { ascending: false }).limit(2000);
  if (error) return tableMissing(error) ? NextResponse.json({ notReady: NOT_READY, assets: [] }) : NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as { created_by: string | null }[];
  const ids = [...new Set(rows.map(a => a.created_by).filter(Boolean))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
  const names = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  return NextResponse.json({
    me: user.id, isManager,
    assets: rows.map(a => ({ ...a, created_by_name: a.created_by ? names.get(a.created_by) ?? null : null })),
  });
}

// { action: 'upload-link', kind, fileName } → one-shot Dropbox link (big files go straight to Dropbox)
// { action: 'create', kind, title, description, tags, path } → index the uploaded file
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireDesignPage('page.design_assets');
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'other';

  if (body.action === 'upload-link') {
    try {
      const link = await uploadLinkIn(assetFolder(kind), String(body.fileName ?? ''));
      return link ? NextResponse.json({ link }) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  }

  if (body.action === 'create') {
    const file = await fileIn(LIBRARY_ROOT, String(body.path ?? ''));
    if (!file) return NextResponse.json({ error: 'The uploaded file was not found in the library folder' }, { status: 400 });
    const title = String(body.title ?? '').trim().slice(0, 200) || file.name;
    const { data, error } = await admin.from('design_assets').insert({
      kind, title, description: String(body.description ?? '').trim().slice(0, 2000) || null, tags: parseTags(body.tags),
      dropbox_path: file.path, file_name: file.name, size_bytes: file.size, created_by: user.id,
    }).select(COLS).single();
    if (error) return NextResponse.json({ error: tableMissing(error) ? NOT_READY : error.message }, { status: tableMissing(error) ? 409 : 500 });
    await logAudit({ actorId: user.id, action: 'design_asset.created', resource: `design_asset:${data.id}`, newValue: { kind, title } });
    return NextResponse.json({ asset: data }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
