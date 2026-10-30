import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireTlinesDashboard } from '@/lib/keyClients/access';

type Params = { params: Promise<{ id: string }> };

// Manual decisions that beat the name match (lib/keyClients/match.ts):
// POST { opportunityId | potentialId | prospectId, mode: 'include' | 'exclude', note? } — e.g. include
//   "Frontier Town Gateway" (a TA site) or exclude a look-alike name. Re-posting changes the mode.
// DELETE ?linkId=… — back to matching by name.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'Only managers can change the key client list' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const opportunityId = typeof b.opportunityId === 'string' && b.opportunityId ? b.opportunityId : null;
  const potentialId = typeof b.potentialId === 'string' && b.potentialId ? b.potentialId : null;
  const prospectId = typeof b.prospectId === 'string' && b.prospectId ? b.prospectId : null;
  if ([opportunityId, potentialId, prospectId].filter(Boolean).length !== 1) {
    return NextResponse.json({ error: 'Give exactly one of opportunityId, potentialId or prospectId' }, { status: 400 });
  }
  const mode = b.mode === 'exclude' ? 'exclude' : 'include';

  const { data: client } = await admin.from('key_clients').select('id, name').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Key client not found' }, { status: 404 });
  const [table, targetId, what] = opportunityId ? ['opportunities', opportunityId, 'Opportunity']
    : potentialId ? ['prospect_potentials', potentialId, 'Potential'] : ['prospects', prospectId, 'Contact'];
  const target = await admin.from(table).select('id').eq('id', targetId).is('deleted_at', null).maybeSingle();
  if (!target.data) return NextResponse.json({ error: `${what} not found` }, { status: 404 });

  // One decision per (client, target): replace an earlier one.
  let del = admin.from('key_client_links').delete().eq('key_client_id', id);
  del = opportunityId ? del.eq('opportunity_id', opportunityId) : potentialId ? del.eq('potential_id', potentialId) : del.eq('prospect_id', prospectId);
  await del;
  const { data, error } = await admin.from('key_client_links').insert({
    key_client_id: id, opportunity_id: opportunityId, potential_id: potentialId, prospect_id: prospectId, mode,
    note: String(b.note ?? '').trim().slice(0, 500) || null, created_by: user.id,
  }).select('id, key_client_id, opportunity_id, potential_id, prospect_id, mode, note').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: `key_client.${mode}`, resource: `key_client:${id}`, newValue: { client: client.name, opportunityId, potentialId, prospectId } });
  return NextResponse.json({ link: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'Only managers can change the key client list' }, { status: 403 });
  const linkId = req.nextUrl.searchParams.get('linkId');
  if (!linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });
  const { data, error } = await admin.from('key_client_links').delete().eq('id', linkId).eq('key_client_id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'key_client.link_removed', resource: `key_client:${id}`, oldValue: { linkId } });
  return NextResponse.json({ ok: true });
}
