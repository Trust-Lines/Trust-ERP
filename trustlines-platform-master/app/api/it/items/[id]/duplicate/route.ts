import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi, ITEM_COLS, type ItemRow } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { duplicateRows, MAX_DUPLICATES } from '@/lib/it/duplicateItem';

// Item → Duplicate (edit.it): `count` copies of an item — same name, type, office, notes, specs and
// photo (the same Dropbox file; a new photo on a copy is a new file, so nothing is shared after that).
// Every copy starts available with nobody holding it, no set, no remote address and no phone number.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as { count?: unknown } | null;
  const count = Number(body?.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > MAX_DUPLICATES) {
    return NextResponse.json({ error: `Choose between 1 and ${MAX_DUPLICATES} copies` }, { status: 400 });
  }

  const { data: source } = await ctx.admin.from('it_items').select(ITEM_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = duplicateRows(source as ItemRow, count, ctx.userId, new Date().toISOString());
  const { data, error } = await ctx.admin.from('it_items').insert(rows).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = ((data ?? []) as { id: string }[]).map(r => r.id);

  await logAudit({ actorId: ctx.userId, action: 'it.item_duplicated', resource: `it_item:${id}`, newValue: { copies: ids } });
  return NextResponse.json({ ids }, { status: 201 });
}
