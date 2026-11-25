import { NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { loadAssignmentHistory } from '@/lib/it/assignments';

// A phone line's assignment history for its pop-up on IT → Phone Numbers (page.it): who held it and
// on which company phone, newest first.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('manage');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const spells = await loadAssignmentHistory(ctx.admin, 'phone_line', id);
  return NextResponse.json({ spells }, { headers: { 'Cache-Control': 'private, no-store' } });
}
