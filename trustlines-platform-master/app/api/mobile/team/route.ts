import { NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';

// Mobile "Ekip rehberi" (057/058): the same people and gate as the web Team page (page.team).
export async function GET() {
  const { admin, deny } = await requireApiPage('page.team');
  if (deny) return deny;
  const { data, error } = await admin.from('profiles')
    .select('id, full_name, email, role, office, department, is_active')
    .order('full_name').limit(1000);
  if (error) return NextResponse.json({ error: 'Could not load the team' }, { status: 500 });
  return NextResponse.json({ people: data ?? [] });
}
