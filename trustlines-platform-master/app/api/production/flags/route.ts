import { NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';

export const dynamic = 'force-dynamic';

// The Production tracker's "To do" / "Receive Follow Up" flags and PF groups (migration 152).
// Before that migration both lists are empty instead of an error.
export async function GET() {
  const { admin, deny } = await requireVendorAccess('read');
  if (deny) return deny;

  const [f, g, m] = await Promise.all([
    admin.from('production_pf_flags').select('id, kind, project_id, type, item_id, completed_at, created_at').order('created_at', { ascending: false }),
    admin.from('production_pf_groups').select('id, number').order('number', { ascending: true }),
    admin.from('production_pf_group_members').select('id, group_id, rank, project_id, type'),
  ]);
  if (f.error || g.error || m.error) return NextResponse.json({ flags: [], groups: [], ready: false });

  const projectIds = [...new Set([...(f.data ?? []), ...(m.data ?? [])].map((r: { project_id: string }) => r.project_id))];
  const { data: projects } = projectIds.length
    ? await admin.from('projects').select('id, code, name').in('id', projectIds)
    : { data: [] };
  const proj = new Map(((projects ?? []) as { id: string; code: string; name: string }[]).map(p => [p.id, p]));

  type Flag = { id: string; kind: string; project_id: string; type: string; item_id: string | null; completed_at: string | null; created_at: string };
  type Member = { id: string; group_id: string; rank: number; project_id: string; type: string };
  return NextResponse.json({
    ready: true,
    flags: ((f.data ?? []) as Flag[]).map(r => ({
      id: r.id, kind: r.kind, projectId: r.project_id, projectCode: proj.get(r.project_id)?.code ?? '', projectName: proj.get(r.project_id)?.name ?? '',
      type: r.type, itemId: r.item_id, completedAt: r.completed_at, createdAt: r.created_at,
    })),
    groups: ((g.data ?? []) as { id: string; number: number }[]).map(gr => ({
      id: gr.id, number: gr.number,
      members: ((m.data ?? []) as Member[]).filter(x => x.group_id === gr.id).sort((a, b) => a.rank - b.rank).map(x => ({
        id: x.id, rank: x.rank, projectId: x.project_id, projectCode: proj.get(x.project_id)?.code ?? '', type: x.type,
      })),
    })),
  });
}
