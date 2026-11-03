import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { PROJECT_FINANCE_READ_ROLES, loadProjectFinance } from '@/lib/finance/projectTotals';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole([...PROJECT_FINANCE_READ_ROLES]);
  if (deny) return deny;
  return NextResponse.json({ finance: await loadProjectFinance(admin, id) });
}
