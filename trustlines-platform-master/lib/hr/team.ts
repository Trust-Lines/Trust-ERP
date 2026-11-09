import { HR_ADMIN_ROLES } from './requests';

export interface TeamMember { id: string; full_name: string; role: string | null; manager_id: string | null; is_active: boolean }

/** The people an actor manages: everyone (active) for ops / GM, else their direct reports. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function teamOf(admin: any, actor: { id: string; role: string | null }): Promise<TeamMember[]> {
  let q = admin.from('profiles').select('id, full_name, role, manager_id, is_active').eq('is_active', true);
  if (!HR_ADMIN_ROLES.includes(actor.role ?? '')) q = q.eq('manager_id', actor.id);
  const { data } = await q.neq('id', actor.id).order('full_name').limit(1000);
  return (data ?? []) as TeamMember[];
}
