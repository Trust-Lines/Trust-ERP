
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getAssignedRegions(admin: any, userId: string): Promise<string[]> {
  const { data } = await admin.from('profiles').select('assigned_regions').eq('id', userId).maybeSingle();
  const row = data as { assigned_regions: string[] | null } | null;
  return row?.assigned_regions ?? [];
}

export function regionAllows(assignedRegions: string[], recordRegion: string | null): boolean {
  if (assignedRegions.length === 0) return true;
  return recordRegion != null && assignedRegions.includes(recordRegion);
}
