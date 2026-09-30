import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { findProspectDuplicates } from '@/lib/marketing/duplicates';

type Params = { params: Promise<{ id: string }> };

// Advisory only: existing Contacts that look like this website lead (same company / person / email / phone).
export async function GET(_req: NextRequest, { params }: Params) {
  const { admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const { data: lead } = await admin.from('web_leads').select('name, company, email, phone').eq('id', id).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const duplicates = await findProspectDuplicates(admin, {
    organizationName: lead.company, personName: lead.company ? null : lead.name, email: lead.email, phone: lead.phone,
  });
  return NextResponse.json({ duplicates });
}
