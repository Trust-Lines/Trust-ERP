import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { assigneeError, itApi } from '@/lib/it/server';
import { cleanItemInput } from '@/lib/it/validate';

// Items Library → Add Item (edit.it).
export async function POST(req: NextRequest) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const input = cleanItemInput(await req.json().catch(() => null));
  if (input.value === null) return NextResponse.json({ error: input.error }, { status: 400 });
  const bad = await assigneeError(ctx.admin, input.value);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await ctx.admin.from('it_items')
    .insert({ ...input.value, assigned_at: input.value.assignee_id ? now : null, created_by: ctx.userId })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const id = (data as { id: string }).id;

  await logAudit({ actorId: ctx.userId, action: 'it.item_created', resource: `it_item:${id}`, newValue: input.value });
  return NextResponse.json({ item: { id } }, { status: 201 });
}
