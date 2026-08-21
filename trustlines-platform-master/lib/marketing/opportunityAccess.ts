import { NextResponse } from 'next/server';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';

/* eslint-disable @typescript-eslint/no-explicit-any */

const REGION_EXEMPT_ROLES = ['sales_marketing_manager', 'marketing_manager', 'ops_manager', 'general_manager'];

export async function canAccessOpportunity(
  admin: any, opportunityId: string, userId: string, role: string,
): Promise<boolean> {
  if (REGION_EXEMPT_ROLES.includes(role)) return true;

  const { data } = await admin.from('opportunities')
    .select('sales_owner_id, marketing_owner_id, region').eq('id', opportunityId).maybeSingle();
  const row = data as { sales_owner_id: string | null; marketing_owner_id: string | null; region: string | null } | null;
  if (!row) return false;

  const assignedRegions = await getAssignedRegions(admin, userId);
  if (assignedRegions.length > 0) return regionAllows(assignedRegions, row.region);

  if (row.sales_owner_id === userId || row.marketing_owner_id === userId) return true;

  const { data: task } = await admin.from('lead_tasks')
    .select('id').eq('opportunity_id', opportunityId).eq('assignee_id', userId).limit(1);
  return Array.isArray(task) && task.length > 0;
}

export async function assertOpportunityAccess(
  admin: any, opportunityId: string, userId: string, role: string,
): Promise<NextResponse | null> {
  const ok = await canAccessOpportunity(admin, opportunityId, userId, role);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
