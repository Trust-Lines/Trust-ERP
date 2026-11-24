import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { GROUP_COOKIE, groupTokenOk } from '@/lib/it/groupLock';
import { cleanSetLabel, MAX_GROUP_ITEMS } from '@/lib/it/groups';

// Item grouping (sets): edit.it plus the unlocked group cookie (POST ./unlock) on every call.
//   GET    — the items that can be picked (light columns)
//   POST   { anchorId, itemIds, setLabel? } — put items in the anchor's set (a new name renames it)
//   DELETE { itemId } — take one item out of its set

async function guard(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return { ctx: null, deny };
  if (!groupTokenOk(req.cookies.get(GROUP_COOKIE)?.value, ctx.userId)) {
    return { ctx: null, deny: NextResponse.json({ error: 'Grouping is locked. Enter the password.', locked: true }, { status: 423 }) };
  }
  return { ctx, deny: null };
}

export async function GET(req: NextRequest) {
  const { ctx, deny } = await guard(req);
  if (deny) return deny;
  const { data, error } = await ctx.admin.from('it_items').select('id, name, category, set_label, location')
    .is('deleted_at', null).order('name').limit(2000);
  if (error) return NextResponse.json({ error: 'Could not load items' }, { status: 500 });
  return NextResponse.json({
    items: ((data ?? []) as { id: string; name: string; category: string; set_label: string | null; location: string | null }[])
      .map(r => ({ id: r.id, name: r.name, category: r.category, setLabel: r.set_label, location: r.location })),
  });
}

export async function POST(req: NextRequest) {
  const { ctx, deny } = await guard(req);
  if (deny) return deny;
  const b = await req.json().catch(() => null) as { anchorId?: unknown; itemIds?: unknown; setLabel?: unknown } | null;
  if (!isUuid(b?.anchorId)) return NextResponse.json({ error: 'Choose the item to group with' }, { status: 400 });
  const anchorId = b!.anchorId as string;
  const ids = Array.isArray(b?.itemIds)
    ? [...new Set((b!.itemIds as unknown[]).filter(isUuid) as string[])].filter(id => id !== anchorId)
    : [];
  if (ids.length > MAX_GROUP_ITEMS) return NextResponse.json({ error: `At most ${MAX_GROUP_ITEMS} items at a time` }, { status: 400 });

  const { data: anchor } = await ctx.admin.from('it_items').select('id, name, set_label').eq('id', anchorId).is('deleted_at', null).maybeSingle();
  const a = anchor as { id: string; name: string; set_label: string | null } | null;
  if (!a) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const given = cleanSetLabel(b?.setLabel);
  if (given.error !== undefined) return NextResponse.json({ error: given.error }, { status: 400 });
  const label = given.value ?? a.set_label;
  if (!label) return NextResponse.json({ error: 'Name the set (e.g. "PC 1")' }, { status: 400 });
  if (!ids.length && label === a.set_label) return NextResponse.json({ error: 'Choose at least one item' }, { status: 400 });

  if (ids.length) {
    const { data: found } = await ctx.admin.from('it_items').select('id').in('id', ids).is('deleted_at', null);
    if ((found ?? []).length !== ids.length) return NextResponse.json({ error: 'Some items no longer exist. Reload and try again.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  // A new name for an existing set renames every item in it.
  if (a.set_label && label !== a.set_label) {
    const { error } = await ctx.admin.from('it_items').update({ set_label: label, updated_at: now }).eq('set_label', a.set_label).is('deleted_at', null);
    if (error) return NextResponse.json({ error: 'Could not rename the set' }, { status: 500 });
  }
  const { error } = await ctx.admin.from('it_items').update({ set_label: label, updated_at: now }).in('id', [anchorId, ...ids]).is('deleted_at', null);
  if (error) return NextResponse.json({ error: 'Could not group the items' }, { status: 500 });

  await logAudit({
    actorId: ctx.userId, action: 'it.items_grouped', resource: `it_item:${anchorId}`,
    oldValue: { set_label: a.set_label }, newValue: { set_label: label, item_ids: ids },
  });
  return NextResponse.json({ ok: true, setLabel: label });
}

export async function DELETE(req: NextRequest) {
  const { ctx, deny } = await guard(req);
  if (deny) return deny;
  const b = await req.json().catch(() => null) as { itemId?: unknown } | null;
  if (!isUuid(b?.itemId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const id = b!.itemId as string;
  const { data } = await ctx.admin.from('it_items').select('id, set_label').eq('id', id).is('deleted_at', null).maybeSingle();
  const row = data as { id: string; set_label: string | null } | null;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!row.set_label) return NextResponse.json({ ok: true });

  const { error } = await ctx.admin.from('it_items').update({ set_label: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not remove the item from the set' }, { status: 500 });
  await logAudit({ actorId: ctx.userId, action: 'it.item_ungrouped', resource: `it_item:${id}`, oldValue: { set_label: row.set_label } });
  return NextResponse.json({ ok: true });
}
