import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';

export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('prospects').select('tags').limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options = [...new Set(
    (data ?? []).flatMap((r: { tags: { name: string }[] }) => r.tags ?? []).map((t: { name: string }) => t.name?.trim()).filter(Boolean),
  )].sort();
  return NextResponse.json({ options });
}
