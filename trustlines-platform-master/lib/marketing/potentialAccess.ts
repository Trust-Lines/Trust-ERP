import { NextResponse } from 'next/server';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';

/* eslint-disable @typescript-eslint/no-explicit-any */

const REGION_EXEMPT_ROLES = ['sales_marketing_manager', 'marketing_manager', 'ops_manager', 'general_manager'];

export async function canAccessPotential(
  admin: any, potentialId: string, userId: string, role: string,
): Promise<boolean> {
  if (REGION_EXEMPT_ROLES.includes(role)) return true;

  const { data } = await admin.from('prospect_potentials')
    .select('assigned_to, region').eq('id', potentialId).maybeSingle();
  const row = data as { assigned_to: string | null; region: string | null } | null;
  if (!row) return false;

  const assignedRegions = await getAssignedRegions(admin, userId);
  if (assignedRegions.length > 0) return regionAllows(assignedRegions, row.region);

  return row.assigned_to === userId;
}

export async function assertPotentialAccess(
  admin: any, potentialId: string, userId: string, role: string,
): Promise<NextResponse | null> {
  const ok = await canAccessPotential(admin, potentialId, userId, role);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
