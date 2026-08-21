import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, deny } = await requireRole(['sales_marketing_manager', 'ops_manager', 'general_manager']);
  if (deny) return deny;

  const { data: row } = await admin.from('lead_intake').select('deleted_at').eq('id', id).maybeSingle();
  if (!row || !(row as { deleted_at: string | null }).deleted_at) {
    return NextResponse.json({ error: 'Lead is not in the trash' }, { status: 400 });
  }

  const { error } = await admin.from('lead_intake').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
