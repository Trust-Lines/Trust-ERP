import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

/**
 * The Production tracker's Half toolbar: assign the selected projects / cases to the first or
 * second half of a year, or clear it.
 *   { kind: 'project' | 'direct_order' | 'missing_extra', ids, halfOfYear: 'FIRST_HALF' | 'SECOND_HALF' | null, halfYear: 2026 | null }
 */
export async function PATCH(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { kind?: string; ids?: unknown; halfOfYear?: string | null; halfYear?: number | null };
  const kind = body.kind ?? 'project';
  if (!['project', 'direct_order', 'missing_extra'].includes(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String).filter(Boolean))] : [];
  if (!ids.length || ids.length > 500) return NextResponse.json({ error: 'Select 1–500 projects' }, { status: 400 });

  const half = body.halfOfYear ?? null;
  if (half !== null && half !== 'FIRST_HALF' && half !== 'SECOND_HALF') return NextResponse.json({ error: 'Invalid half' }, { status: 400 });
  const year = half === null ? null : Math.floor(Number(body.halfYear));
  if (half !== null && !(year! >= 2000 && year! <= 2100)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });

  let q = admin.from(kind === 'project' ? 'projects' : 'production_cases')
    .update({ half_of_year: half, half_year: year }).in('id', ids).is('deleted_at', null);
  if (kind !== 'project') q = q.eq('kind', kind);
  const { data, error } = await q.select('id');
  if (error) return NextResponse.json({ error: 'Failed to assign half' }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'production.half_assigned', resource: `${kind}:bulk`, newValue: { ids, halfOfYear: half, halfYear: year } });
  return NextResponse.json({ updated: (data ?? []).length });
}
