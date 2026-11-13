import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { PROD_KEYS } from '@/lib/production/access';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// The Production tracker's project menu (right click on a Project # box or a project header),
// Trust System "ProjectMenu" behaviour on T-ERP's own data:
//   PATCH  ?kind=project|direct_order|missing_extra
//          { isUrgent } | { name } | { address } | { bucket } | { types: { add: [{ type, customTypeCode? }], remove: [type] } }
//   DELETE ?kind=…   → the project / case goes to the trash (deleted_at), never removed.
// A block is a T-ERP project (kind=project) or a production case (Direct Order / Missing & Extra).

type Params = { params: Promise<{ id: string }> };
const KINDS = ['project', 'direct_order', 'missing_extra'] as const;
type Kind = typeof KINDS[number];
const BUCKETS = new Set(['TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW', 'TLINES_HQ', 'TLINES_TC']);
const BOARD_TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];

const now = () => new Date().toISOString();
const clean = (v: unknown, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** A custom type's short code: its letters and digits, upper case, at most 10 (Trust System rule). */
const customCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

function kindOf(req: NextRequest): Kind | null {
  const k = req.nextUrl.searchParams.get('kind') ?? 'project';
  return (KINDS as readonly string[]).includes(k) ? (k as Kind) : null;
}

/** T-ERP project names read "STNE 440 - Cherry Hill, …": the part before " - " is the name, the rest the address. */
function splitName(full: string | null): { head: string; address: string } {
  const parts = String(full ?? '').split(' - ');
  return { head: parts[0].trim(), address: parts.slice(1).join(' - ').trim() };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite(PROD_KEYS.editProjects);
  if (deny) return deny;
  const { id } = await params;
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const table = kind === 'project' ? 'projects' : 'production_cases';
  const { data: block } = await admin.from(table)
    .select(kind === 'project' ? 'id, code, name, region' : 'id, kind, code, name, address, bucket, base_project_name')
    .eq('id', id).is('deleted_at', null).maybeSingle() as {
      data: { id: string; code: string; name: string | null; region?: string | null; kind?: string; address?: string | null; bucket?: string | null; base_project_name?: string | null } | null;
    };
  if (!block || (kind !== 'project' && block.kind !== kind)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // ── Edit Types: removed types' rows go to the trash, each added type gets one empty row. ──
  if (body.types && typeof body.types === 'object') {
    const t = body.types as { add?: { type?: string; customTypeCode?: string | null }[]; remove?: string[] };
    const remove = [...new Set((t.remove ?? []).map(x => clean(x, 80)).filter(Boolean))];
    const add = (t.add ?? []).map(a => {
      const type = clean(a.type, 80);
      const std = BOARD_TYPES.find(b => b.toLowerCase() === type.toLowerCase());
      return std ? { type: std, code: null } : { type, code: customCode(type) };
    }).filter(a => a.type);
    if (add.some(a => a.code === "")) return NextResponse.json({ error: 'Name needs at least one letter or digit' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (q: any) => (kind === 'project' ? q.eq('project_id', id).eq('source', 'project') : q.eq('case_id', id));
    const { data: rows } = await scope(admin.from('production_items').select('id, type, sort_index').is('deleted_at', null)) as {
      data: { id: string; type: string; sort_index: number | null }[] | null;
    };
    const live = rows ?? [];
    const remaining = new Set(live.map(r => r.type).filter(x => !remove.includes(x)));
    for (const a of add) remaining.add(a.type);
    if (!remaining.size) return NextResponse.json({ error: 'Keep at least one type' }, { status: 400 });

    const trashIds = live.filter(r => remove.includes(r.type)).map(r => r.id);
    if (trashIds.length) {
      const { error } = await admin.from('production_items').update({ deleted_at: now(), updated_at: now() }).in('id', trashIds);
      if (error) return NextResponse.json({ error: 'Could not remove the types' }, { status: 500 });
    }
    let sort = live.reduce((m, r) => Math.max(m, (r.sort_index ?? 0) + 1), 0);
    const have = new Set(live.filter(r => !remove.includes(r.type)).map(r => r.type));
    const inserts = add.filter(a => !have.has(a.type)).map(a => ({
      project_id: kind === 'project' ? id : null, case_id: kind === 'project' ? null : id, source: kind,
      type: a.type, custom_type_code: a.code, sort_index: sort++, po_sign_status: 'NOT_SIGNED',
    }));
    if (inserts.length) {
      const { error } = await admin.from('production_items').insert(inserts);
      if (error) return NextResponse.json({ error: 'Could not add the types' }, { status: 500 });
    }
    await logAudit({
      actorId: user.id, action: 'production.types_changed', projectId: kind === 'project' ? id : undefined,
      resource: `${kind}:${id}`, newValue: { removed: remove, trashedRows: trashIds.length, added: inserts.map(i => i.type) },
    });
    return NextResponse.json({ ok: true, trashedRows: trashIds.length, added: inserts.length });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.isUrgent === 'boolean') update.is_urgent = body.isUrgent;

  if ('name' in body) {
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (kind === 'project') {
      const { address } = splitName(block.name);
      update.name = address ? `${name} - ${address}` : name;
    } else if (kind === 'missing_extra') update.base_project_name = name;
    else update.name = name;
  }
  if ('address' in body) {
    const address = clean(body.address);
    if (kind === 'project') {
      const { head } = splitName(block.name);
      update.name = address ? `${head || block.code} - ${address}` : (head || block.code);
      update.site_location = address || null;
    } else update.address = address || null;
  }
  if ('bucket' in body) {
    const bucket = String(body.bucket ?? '');
    if (!BUCKETS.has(bucket)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
    const current = kind === 'project' ? block.region : block.bucket;
    if (current === bucket) return NextResponse.json({ error: 'Project is already in this region' }, { status: 409 });
    update[kind === 'project' ? 'region' : 'bucket'] = bucket;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  update.updated_at = now();

  const { error } = await admin.from(table).update(update).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save the project' }, { status: 500 });
  await logAudit({
    actorId: user.id, action: 'production.block_updated', projectId: kind === 'project' ? id : undefined,
    resource: `${kind}:${id}`, newValue: update,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite(PROD_KEYS.deleteProjects);
  if (deny) return deny;
  const { id } = await params;
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

  const table = kind === 'project' ? 'projects' : 'production_cases';
  let q = admin.from(table).update({ deleted_at: now() }).eq('id', id).is('deleted_at', null);
  if (kind !== 'project') q = q.eq('kind', kind);
  const { data, error } = await q.select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not delete the project' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'production.block_trashed', projectId: kind === 'project' ? id : undefined, resource: `${kind}:${id}` });
  return NextResponse.json({ ok: true });
}
