import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';

export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('prospects')
    .select('source_raw_label').not('source_raw_label', 'is', null).limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options = [...new Set((data ?? []).map((r: { source_raw_label: string }) => r.source_raw_label.trim()).filter(Boolean))].sort();
  return NextResponse.json({ options });
}
