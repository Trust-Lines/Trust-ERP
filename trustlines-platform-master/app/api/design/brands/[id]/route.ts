import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { canEditEntry, requireDesignPage } from '@/lib/design/access';
import { dropboxError, fileIn, listFiles, temporaryLink, uploadLinkIn } from '@/lib/design/dropboxDirect';
import { brandKitFolder, cleanColors, cleanFonts } from '@/lib/design/libraryPaths';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, name, prospect_id, colors, fonts, guidelines, dropbox_folder_path, created_by, created_at, updated_at';

interface Kit { id: string; name: string; created_by: string | null; dropbox_folder_path: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function load(admin: any, id: string): Promise<Kit | null> {
  const { data } = await admin.from('design_brand_kits').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data as Kit | null;
}
const folderOf = (k: Kit) => k.dropbox_folder_path ?? brandKitFolder(k.id, k.name);

// The kit's files (logos, guideline PDFs, fonts) straight from its Dropbox folder.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;
  const kit = await load(admin, id);
  if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try { return NextResponse.json({ files: await listFiles(folderOf(kit)), folder: folderOf(kit) }); }
  catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}`, files: [] }, { status: 502 }); }
}

// { action: 'upload-link', fileName } | { action: 'open', path }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;
  const kit = await load(admin, id);
  if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === 'upload-link') {
      if (!canEditEntry(kit, user.id, isManager)) return NextResponse.json({ error: 'Only the kit owner or a manager can add files' }, { status: 403 });
      const link = await uploadLinkIn(folderOf(kit), String(body.fileName ?? ''));
      return link ? NextResponse.json({ link }) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }
    if (body.action === 'open') {
      const file = await fileIn(folderOf(kit), String(body.path ?? ''));
      if (!file) return NextResponse.json({ error: 'File not found in this kit' }, { status: 404 });
      return NextResponse.json({ link: await temporaryLink(file.path) });
    }
  } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;
  const kit = await load(admin, id);
  if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(kit, user.id, isManager)) return NextResponse.json({ error: 'Only the kit owner or a manager can edit it' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in body) {
    const n = String(body.name ?? '').trim();
    if (!n) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    patch.name = n.slice(0, 120); // the Dropbox folder keeps its first name — nothing is moved
  }
  if ('prospect_id' in body) patch.prospect_id = typeof body.prospect_id === 'string' && body.prospect_id ? body.prospect_id : null;
  if ('colors' in body) patch.colors = cleanColors(body.colors);
  if ('fonts' in body) patch.fonts = cleanFonts(body.fonts);
  if ('guidelines' in body) patch.guidelines = String(body.guidelines ?? '').trim().slice(0, 5000) || null;
  const { data, error } = await admin.from('design_brand_kits').update(patch).eq('id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kit: data });
}

// Soft delete; the Dropbox folder stays.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_brands');
  if (deny) return deny;
  const kit = await load(admin, id);
  if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(kit, user.id, isManager)) return NextResponse.json({ error: 'Only the kit owner or a manager can remove it' }, { status: 403 });
  const { error } = await admin.from('design_brand_kits').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'design_brand_kit.removed', resource: `design_brand_kit:${id}`, oldValue: { name: kit.name } });
  return NextResponse.json({ ok: true });
}
