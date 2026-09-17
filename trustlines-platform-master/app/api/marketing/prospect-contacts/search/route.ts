import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';

// Contact search across ALL Contacts (not scoped to one prospect) — used to let a Potential/
// Opportunity get re-linked to the real person, once found, instead of staying stuck on
// whatever placeholder contact it was created with (e.g. a ClickUp deal task with no linked
// Contact at all — see clickup-import-potentials-only.mts's --allow-fallback).
const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_READ_ROLES];

export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const safe = q.replace(/[%,()\\]/g, '\\$&');
  const { data, error } = await admin
    .from('prospect_contacts')
    .select('id, name, prospect_id, prospects!inner(display_name)')
    .ilike('name', `%${safe}%`)
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((c: { id: string; name: string; prospect_id: string; prospects: { display_name: string } | { display_name: string }[] }) => ({
    id: c.id,
    name: c.name,
    prospectId: c.prospect_id,
    companyName: Array.isArray(c.prospects) ? c.prospects[0]?.display_name : c.prospects?.display_name,
  }));
  return NextResponse.json({ results });
}
