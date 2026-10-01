import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES, MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { isImageKitUrl } from '@/lib/web-cms/config';
import { SLUG_RE, workTypeSlug } from '@/lib/web-cms/workTypes';
import { pingWebsite } from '@/lib/web-cms/revalidate';

const COLS = 'id, slug, label, icon_url, sort_order, is_active';

// All types, inactive ones included (the marketing screen needs them).
export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('web_work_types').select(COLS)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workTypes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const b = (await req.json().catch(() => null)) as { label?: unknown; icon_url?: unknown } | null;
  const label = typeof b?.label === 'string' ? b.label.trim().slice(0, 60) : '';
  if (!label) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const slug = workTypeSlug(label);
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Use letters or numbers in the name' }, { status: 400 });
  const icon = typeof b?.icon_url === 'string' ? b.icon_url.trim() : '';
  if (icon && !isImageKitUrl(icon)) return NextResponse.json({ error: 'Icon must be an ImageKit URL' }, { status: 400 });

  const { data: last } = await admin.from('web_work_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const sort_order = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 10;

  const { data, error } = await admin.from('web_work_types')
    .insert({ slug, label, icon_url: icon || null, sort_order, is_active: true }).select(COLS).single();
  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json({ error: dup ? `A type with the link name "${slug}" already exists` : error.message }, { status: dup ? 409 : 500 });
  }

  await logAudit({ actorId: user.id, action: 'web_work_type.created', resource: `web_work_type:${data.id}`, newValue: { slug, label } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ workType: data, refreshed }, { status: 201 });
}
