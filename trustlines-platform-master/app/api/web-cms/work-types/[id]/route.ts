import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { isImageKitUrl } from '@/lib/web-cms/config';
import { pingWebsite } from '@/lib/web-cms/revalidate';

type Params = { params: Promise<{ id: string }> };

// Rename, change the icon, activate / deactivate. The slug is deliberately NOT editable
// (projects store it), and there is no delete: retire a type by deactivating it.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { label?: unknown; icon_url?: unknown; is_active?: unknown; sort_order?: unknown } | null;

  const patch: Record<string, unknown> = {};
  if (typeof b?.label === 'string') {
    const v = b.label.trim().slice(0, 60);
    if (!v) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    patch.label = v;
  }
  if (typeof b?.icon_url === 'string') {
    const v = b.icon_url.trim();
    if (v && !isImageKitUrl(v)) return NextResponse.json({ error: 'Icon must be an ImageKit URL' }, { status: 400 });
    patch.icon_url = v || null;
  }
  if (typeof b?.is_active === 'boolean') patch.is_active = b.is_active;
  if (typeof b?.sort_order === 'number' && Number.isInteger(b.sort_order)) patch.sort_order = b.sort_order;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes given' }, { status: 400 });

  const { data, error } = await admin.from('web_work_types').update(patch).eq('id', id)
    .select('id, slug, label, icon_url, sort_order, is_active').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'web_work_type.updated', resource: `web_work_type:${id}`, newValue: patch });
  const refreshed = await pingWebsite();
  return NextResponse.json({ workType: data, refreshed });
}
