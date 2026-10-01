import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { pingWebsite } from '@/lib/web-cms/revalidate';

// Body: { ids: string[] } — the complete list in the new order.
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const b = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(b?.ids) ? (b!.ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length || new Set(ids).size !== ids.length) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });

  const { data: existing, error } = await admin.from('web_work_types').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const known = new Set((existing ?? []).map((r: { id: string }) => r.id));
  if (ids.length !== known.size || !ids.every(i => known.has(i))) return NextResponse.json({ error: 'The list changed — reload and try again' }, { status: 409 });

  for (let i = 0; i < ids.length; i++) {
    const { error: e } = await admin.from('web_work_types').update({ sort_order: (i + 1) * 10 }).eq('id', ids[i]);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  await logAudit({ actorId: user.id, action: 'web_work_type.reordered', resource: 'web_work_types', newValue: { ids } });
  const refreshed = await pingWebsite();
  return NextResponse.json({ success: true, refreshed });
}
