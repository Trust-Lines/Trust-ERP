import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';
import { requireProductionWrite } from '@/lib/production/guard';
import { NO_PF_ROLES } from '@/lib/production/access';
import { PROD_KEYS } from '@/lib/production/access';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// The Production tracker's "ToDo" (kind PF) / "Receive Follow Up" (kind FOLLOWUP) flags and PF
// groups (migration 152), Trust System "Today's PFs" rules:
//   • a ToDo flag is a project + type; its progress is how many of that type's rows have a PF code,
//     and it completes by itself once all of them do;
//   • a Follow Up flag is one PF row, and only an ORDERED row can be followed up;
//   • flags of a deleted project / row drop off the list.
// Before migration 152 both lists are empty instead of an error.

type Flag = { id: string; kind: string; project_id: string; type: string; item_id: string | null; completed_at: string | null; created_at: string };
type Member = { id: string; group_id: string; rank: number; project_id: string; type: string };
type Row = { id: string; project_id: string; type: string; pf_code: string | null; status: string; vendor_id: string | null };

export async function GET() {
  const { user, admin, deny } = await requireVendorAccess('read');
  if (deny) return deny;
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const noPf = NO_PF_ROLES.has((prof as { role?: string } | null)?.role ?? '');

  const [f, g, m] = await Promise.all([
    admin.from('production_pf_flags').select('id, kind, project_id, type, item_id, completed_at, created_at').order('created_at', { ascending: false }),
    admin.from('production_pf_groups').select('id, number').order('number', { ascending: true }),
    admin.from('production_pf_group_members').select('id, group_id, rank, project_id, type'),
  ]);
  if (f.error || g.error || m.error) return NextResponse.json({ flags: [], groups: [], ready: false });

  const flags = (f.data ?? []) as Flag[];
  const members = (m.data ?? []) as Member[];
  const projectIds = [...new Set([...flags, ...members].map(r => r.project_id))];
  const { data: projects } = projectIds.length
    ? await admin.from('projects').select('id, code, name, region').in('id', projectIds).is('deleted_at', null)
    : { data: [] };
  const proj = new Map(((projects ?? []) as { id: string; code: string; name: string; region: string | null }[]).map(p => [p.id, p]));

  // The flagged projects' live rows: progress, the followed-up row, auto-completion.
  const flaggedProjects = [...new Set(flags.map(x => x.project_id))].filter(id => proj.has(id));
  const { data: rowData } = flaggedProjects.length
    ? await admin.from('production_items').select('id, project_id, type, pf_code, status, vendor_id')
      .in('project_id', flaggedProjects).eq('source', 'project').is('deleted_at', null)
    : { data: [] };
  const rows = (rowData ?? []) as Row[];
  const rowById = new Map(rows.map(r => [r.id, r]));
  const vendorIds = [...new Set(rows.map(r => r.vendor_id).filter(Boolean))] as string[];
  const { data: vendors } = vendorIds.length ? await admin.from('suppliers').select('id, name').in('id', vendorIds) : { data: [] };
  const vendorName = new Map(((vendors ?? []) as { id: string; name: string }[]).map(v => [v.id, v.name]));
  const typeRows = (projectId: string, type: string) => rows.filter(r => r.project_id === projectId && r.type.toLowerCase() === type.toLowerCase());

  const live = flags.filter(x => proj.has(x.project_id) && (!x.item_id || rowById.has(x.item_id)));
  const doneNow: string[] = [];
  const out = live.map(x => {
    const tr = typeRows(x.project_id, x.type);
    const filled = tr.filter(r => r.pf_code).length;
    let completedAt = x.completed_at;
    if (x.kind === 'PF' && !completedAt && tr.length > 0 && filled === tr.length) { completedAt = new Date().toISOString(); doneNow.push(x.id); }
    const item = x.item_id ? rowById.get(x.item_id) : undefined;
    const p = proj.get(x.project_id)!;
    return {
      id: x.id, kind: x.kind, projectId: x.project_id, projectCode: p.code, projectName: p.name, bucket: p.region,
      type: x.type, itemId: x.item_id, completedAt, createdAt: x.created_at,
      totalItems: tr.length, filledItems: filled,
      pfCode: noPf ? null : item?.pf_code ?? null, itemStatus: item?.status ?? null,
      vendorName: item?.vendor_id ? vendorName.get(item.vendor_id) ?? null : null,
    };
  });
  if (doneNow.length) await admin.from('production_pf_flags').update({ completed_at: new Date().toISOString() }).in('id', doneNow).is('completed_at', null);

  return NextResponse.json({
    ready: true,
    flags: out,
    groups: ((g.data ?? []) as { id: string; number: number }[]).map(gr => ({
      id: gr.id, number: gr.number,
      members: members.filter(x => x.group_id === gr.id && proj.has(x.project_id)).sort((a, b) => a.rank - b.rank).map(x => ({
        id: x.id, rank: x.rank, projectId: x.project_id, projectCode: proj.get(x.project_id)?.code ?? '', type: x.type,
      })),
    })),
  });
}

/**
 * Flag a project + type for ToDo ({ projectId, type }) or one ORDERED row for Follow Up
 * ({ projectId, kind: 'FOLLOWUP', itemId }). Flagging the same thing again re-opens the old flag.
 */
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite(PROD_KEYS.todo);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { projectId?: string; kind?: string; type?: string; itemId?: string };
  const kind = body.kind === 'FOLLOWUP' ? 'FOLLOWUP' : 'PF';
  const projectId = String(body.projectId ?? '').trim();
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).is('deleted_at', null).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let type = String(body.type ?? '').trim();
  let itemId: string | null = null;
  if (kind === 'FOLLOWUP') {
    const { data: item } = await admin.from('production_items').select('id, project_id, type, status')
      .eq('id', String(body.itemId ?? '')).is('deleted_at', null).maybeSingle() as { data: { id: string; project_id: string; type: string; status: string } | null };
    if (!item || item.project_id !== projectId) return NextResponse.json({ error: 'PF not found' }, { status: 404 });
    if (item.status !== 'ORDERED') return NextResponse.json({ error: 'Only ORDERED PFs can be added to Follow Up' }, { status: 400 });
    itemId = item.id;
    type = item.type;
  } else if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  let q = admin.from('production_pf_flags').select('id').eq('kind', kind).eq('project_id', projectId);
  q = itemId ? q.eq('item_id', itemId) : q.eq('type', type).is('item_id', null);
  const { data: existing, error: exErr } = await q.limit(1);
  if (exErr) return NextResponse.json({ error: 'Flags are not set up yet (migration 152)' }, { status: 503 });

  let flagId: string;
  if (existing?.length) {
    flagId = existing[0].id;
    const { error } = await admin.from('production_pf_flags').update({ completed_at: null }).eq('id', flagId);
    if (error) return NextResponse.json({ error: 'Could not flag it' }, { status: 500 });
  } else {
    const { data, error } = await admin.from('production_pf_flags')
      .insert({ kind, project_id: projectId, type, item_id: itemId, created_by: user.id }).select('id').single();
    if (error) return NextResponse.json({ error: 'Could not flag it' }, { status: 500 });
    flagId = data.id;
  }
  await logAudit({ actorId: user.id, action: 'production.flag_added', projectId, resource: `production_pf_flag:${flagId}`, newValue: { kind, type, itemId } });
  return NextResponse.json({ id: flagId });
}
