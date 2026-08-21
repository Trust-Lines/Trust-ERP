
import { sendEmail } from '@/lib/email/send';
import { userCan } from '@/lib/permissions/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NotifyInput {
  userIds:   (string | null | undefined)[];
  projectId: string | null;
  type:      string;
  title:     string;
  body:      string;
  link:      string;
  actorId?:  string | null;
}

export function recipientsOf(userIds: NotifyInput['userIds'], actorId?: string | null): string[] {
  const set = new Set<string>();
  for (const id of userIds) if (id) set.add(id);
  if (actorId) set.delete(actorId);
  return [...set];
}

export async function notifyUsers(admin: any, p: NotifyInput): Promise<string[]> {
  const ids = recipientsOf(p.userIds, p.actorId);
  if (!ids.length) return [];
  try {
    await admin.from('notifications').insert(ids.map(uid => ({
      user_id: uid, project_id: p.projectId, type: p.type,
      title: p.title, body: p.body, link: p.link,
    })));
  } catch (e) {
    console.error(`[events] notify ${p.type} failed:`, e instanceof Error ? e.message : e);
  }
  return ids;
}

export async function emailUsersWithPerm(admin: any, p: {
  userIds: string[];
  permKey: string;
  subject: string;
  html: (name: string) => string;
}): Promise<void> {
  for (const uid of p.userIds) {
    try {
      if (!await userCan(admin, uid, p.permKey)) continue;
      const { data } = await admin.from('profiles').select('full_name, email').eq('id', uid).single() as {
        data: { full_name: string; email: string } | null;
      };
      if (!data?.email) continue;
      await sendEmail(data.email, p.subject, p.html(data.full_name));
    } catch (e) {
      console.error('[events] email failed:', e instanceof Error ? e.message : e);
    }
  }
}

export async function usersWithRoles(admin: any, roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  try {
    const { data, error } = await admin.from('profiles')
      .select('id').in('role', roles).eq('is_active', true).limit(50) as {
        data: { id: string }[] | null; error: { message: string } | null;
      };
    if (error) { console.error('[events] role lookup failed:', error.message); return []; }
    return (data ?? []).map(r => r.id);
  } catch (e) {
    console.error('[events] role lookup threw:', e instanceof Error ? e.message : e);
    return [];
  }
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
