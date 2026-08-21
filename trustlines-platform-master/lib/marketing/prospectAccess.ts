import { NextResponse } from 'next/server';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function canAccessProspect(
  admin: any,
  prospectId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (MARKETING_MANAGE_ROLES.includes(role)) return true;
  if (role !== 'marketing_pr') return false;

  const { data } = await admin.from('prospects')
    .select('created_by, assigned_marketing_user_id, owner_id').eq('id', prospectId).maybeSingle();
  const row = data as { created_by: string | null; assigned_marketing_user_id: string | null; owner_id: string | null } | null;
  if (!row) return false;
  return row.created_by === userId || row.assigned_marketing_user_id === userId || row.owner_id === userId;
}

export async function assertProspectAccess(
  admin: any,
  prospectId: string,
  userId: string,
  role: string,
): Promise<NextResponse | null> {
  const ok = await canAccessProspect(admin, prospectId, userId, role);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
