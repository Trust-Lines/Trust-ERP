import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

export async function GET() {
  const { admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;

  const [oppRes, potRes] = await Promise.all([
    admin.from('opportunities').select('tags').limit(5000),
    admin.from('prospect_potentials').select('tags').limit(5000),
  ]);
  if (oppRes.error) return NextResponse.json({ error: oppRes.error.message }, { status: 500 });
  if (potRes.error) return NextResponse.json({ error: potRes.error.message }, { status: 500 });

  const options = [...new Set(
    [...(oppRes.data ?? []), ...(potRes.data ?? [])]
      .flatMap((r: { tags: { name: string }[] }) => r.tags ?? [])
      .map((t: { name: string }) => t.name?.trim())
      .filter(Boolean),
  )].sort();
  return NextResponse.json({ options });
}
