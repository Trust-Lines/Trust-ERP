import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { canAccessProspect } from '@/lib/marketing/prospectAccess';
import { getDropboxClient } from '@/lib/dropbox/client';

export const maxDuration = 60;

const MAX_ITEMS = 25; // Dropbox's thumbnail batch limit

// Small previews of Contacts' photos for "Export to Excel" (so the pictures can sit inside the
// workbook). Returns base64 JPEG thumbnails — never the full-size photo (phone pictures are
// several MB; the response of a serverless function is capped at ~4.5 MB).
//
// A path is only served when it really belongs to that Contact (a Files-tab file or an Activity
// photo) AND the caller may read that Contact.
export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { items?: { prospectId?: string; path?: string }[] } | null;
  const items = (Array.isArray(body?.items) ? body!.items! : [])
    .filter((i): i is { prospectId: string; path: string } => typeof i?.prospectId === 'string' && typeof i?.path === 'string' && !i.path.includes('..'))
    .slice(0, MAX_ITEMS);
  if (!items.length) return NextResponse.json({ photos: {} });

  const prospectIds = [...new Set(items.map(i => i.prospectId))];
  const paths = [...new Set(items.map(i => i.path))];

  const [{ data: files }, { data: contacts }] = await Promise.all([
    admin.from('prospect_files').select('prospect_id, dropbox_path').in('prospect_id', prospectIds).in('dropbox_path', paths),
    admin.from('prospect_contacts').select('id, prospect_id').in('prospect_id', prospectIds),
  ]);
  const prospectOfContact = new Map(((contacts ?? []) as { id: string; prospect_id: string }[]).map(c => [c.id, c.prospect_id]));
  const { data: notes } = prospectOfContact.size
    ? await admin.from('prospect_contact_notes').select('prospect_contact_id, image_path').in('prospect_contact_id', [...prospectOfContact.keys()]).in('image_path', paths)
    : { data: [] };

  const owned = new Set<string>();
  for (const f of (files ?? []) as { prospect_id: string; dropbox_path: string }[]) owned.add(`${f.prospect_id}|${f.dropbox_path}`);
  for (const n of (notes ?? []) as { prospect_contact_id: string; image_path: string }[]) {
    const pid = prospectOfContact.get(n.prospect_contact_id);
    if (pid) owned.add(`${pid}|${n.image_path}`);
  }

  const readable = new Map<string, boolean>();
  for (const id of prospectIds) readable.set(id, await canAccessProspect(admin, id, user.id, role, 'read'));
  const allowed = [...new Set(items.filter(i => owned.has(`${i.prospectId}|${i.path}`) && readable.get(i.prospectId)).map(i => i.path))];

  const photos: Record<string, string | null> = Object.fromEntries(paths.map(p => [p, null]));
  if (allowed.length) {
    try {
      const res = await getDropboxClient().filesGetThumbnailBatch({
        entries: allowed.map(path => ({ path, format: { '.tag': 'jpeg' }, size: { '.tag': 'w480h320' }, mode: { '.tag': 'bestfit' } })),
      });
      res.result.entries.forEach((entry, i) => {
        if (entry['.tag'] === 'success') photos[allowed[i]] = (entry as unknown as { thumbnail: string }).thumbnail;
      });
    } catch (e) {
      console.error('[prospects/photos]', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'Could not load photos from Dropbox.' }, { status: 502 });
    }
  }
  return NextResponse.json({ photos });
}
