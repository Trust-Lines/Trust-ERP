import { NextResponse } from 'next/server';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';

/* eslint-disable @typescript-eslint/no-explicit-any */

// 🔴 2026-09-15: this app-level check — NOT the RLS policy — is the real authorization
// gate on every /api/marketing/prospects/[id]/... route, because they all read/write
// through the admin/service-role client (which bypasses RLS entirely). Before this fix it
// was pure ownership with no region concept at all, so a marketing_pr who could now see a
// Prospect in Lead Cloud's list (via the RLS fix in migrations 108/109) still got
// "Couldn't load this Prospect/Potential" opening it — the list read and the detail read
// were gated by two different, out-of-sync rules.
//
// `mode` matters: the user's explicit 2026-09-15 decision ("no region assigned → see
// everything") was about VISIBILITY, not edit rights — a marketing_pr with no region
// should be able to open/read any Prospect, but should NOT suddenly be able to edit or
// delete ones they don't own just because they have no region set. So only `mode: 'read'`
// gets the "no region → unrestricted" relaxation; `mode: 'write'` (the default, used by
// every PATCH/POST/DELETE call site) keeps the original ownership-only rule, matching
// what the RLS write policies (prospects_update_own etc.) still enforce underneath.
export async function canAccessProspect(
  admin: any,
  prospectId: string,
  userId: string,
  role: string,
  mode: 'read' | 'write' = 'write',
): Promise<boolean> {
  if (MARKETING_MANAGE_ROLES.includes(role)) return true;
  if (role !== 'marketing_pr') return false;

  const assignedRegions = await getAssignedRegions(admin, userId);
  if (assignedRegions.length > 0) {
    const { data } = await admin.from('prospects').select('region').eq('id', prospectId).maybeSingle();
    const row = data as { region: string | null } | null;
    if (!row) return false;
    return regionAllows(assignedRegions, row.region);
  }

  if (mode === 'read') return true;

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
  mode: 'read' | 'write' = 'write',
): Promise<NextResponse | null> {
  const ok = await canAccessProspect(admin, prospectId, userId, role, mode);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
