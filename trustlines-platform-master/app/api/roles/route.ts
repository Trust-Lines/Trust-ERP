import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRequestUser, isOpsRole } from '@/lib/permissions/requestUser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

async function requireOps(req: NextRequest): Promise<string | null> {
  const caller = await resolveRequestUser(req);
  return caller && isOpsRole(caller.role) ? caller.userId : null;
}

export async function GET(req: NextRequest) {
  if (!await requireOps(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = adminDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from('role_definitions').select('*').order('is_system', { ascending: false }).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await requireOps(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { name: string; label: string; description?: string; color_bg?: string; color_fg?: string };
  if (!body.name?.trim() || !body.label?.trim())
    return NextResponse.json({ error: 'name and label required' }, { status: 400 });

  const slug = body.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const admin = adminDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from('role_definitions').insert({
    name:        slug,
    label:       body.label.trim(),
    description: body.description?.trim() ?? null,
    color_bg:    body.color_bg ?? '#f1f5f9',
    color_fg:    body.color_fg ?? '#475569',
    is_system:   false,
    permissions: {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ role: data });
}
