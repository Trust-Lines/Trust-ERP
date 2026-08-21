import { NextResponse } from 'next/server';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';


const FULL_ACCESS_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];


export async function canAccessLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  leadId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (FULL_ACCESS_ROLES.includes(role)) return true;

  const { data } = await admin.from('lead_intake')
    .select('created_by, assignee_id, region').eq('id', leadId).maybeSingle();

  const row = data as { created_by: string | null; assignee_id: string | null; region: string | null } | null;






  if (!row) return true;

  const assignedRegions = await getAssignedRegions(admin, userId);
  if (assignedRegions.length > 0) return regionAllows(assignedRegions, row.region);

  if (row.created_by === userId || row.assignee_id === userId) return true;


  const { data: task } = await admin.from('lead_tasks')
    .select('id').eq('lead_intake_id', leadId).eq('assignee_id', userId).limit(1);
  return Array.isArray(task) && task.length > 0;
}


export async function assertLeadAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  leadId: string,
  userId: string,
  role: string,
): Promise<NextResponse | null> {
  const ok = await canAccessLead(admin, leadId, userId, role);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
