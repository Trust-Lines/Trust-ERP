import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';

// Every event/campaign an import may be filed under. The normal campaigns list only shows a Marketing
// PR the campaigns they own or created — so one made by someone else (or whose owner no longer
// exists, like NACS 2026) never appeared and a PR could not pick it. Importing needs the full list.
export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { data, error } = await admin.from('marketing_campaigns')
    .select('id, name, status').is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}
