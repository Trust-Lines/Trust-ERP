import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRequestUser, isOpsRole } from '@/lib/permissions/requestUser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

async function requireOps(req: NextRequest): Promise<boolean> {
  const caller = await resolveRequestUser(req);
  return isOpsRole(caller?.role);
}

type Params = { params: Promise<{ name: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await requireOps(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { name } = await params;
  const body = await req.json() as { label?: string; description?: string; color_bg?: string; color_fg?: string; permissions?: Record<string, boolean> };

  const admin = adminDb();
  const patch: Record<string, unknown> = {};
  if (body.label       !== undefined) patch.label       = body.label;
  if (body.description !== undefined) patch.description = body.description;
  if (body.color_bg    !== undefined) patch.color_bg    = body.color_bg;
  if (body.color_fg    !== undefined) patch.color_fg    = body.color_fg;
  if (body.permissions !== undefined) patch.permissions = body.permissions;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('role_definitions').update(patch).eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

const PROTECTED_ROLES = ['ops_manager', 'general_manager'];

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!await requireOps(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { name } = await params;
  const admin = adminDb();

  if (PROTECTED_ROLES.includes(name))
    return NextResponse.json({ error: 'This admin role is protected and cannot be deleted.' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('role', name);
  if (count && count > 0)
    return NextResponse.json({ error: `${count} member${count > 1 ? 's' : ''} still have this role. Reassign them in Team first.` }, { status: 409 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('role_definitions').delete().eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
