import { createAdminClient } from '@/lib/supabase/admin';

interface AuditParams {
  actorId:    string | null;
  action:     string;
  projectId?: string | null;
  resource?:  string | null;
  oldValue?:  unknown;
  newValue?:  unknown;
}

export async function logAudit(p: AuditParams): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    await admin.from('audit_log').insert({
      actor_id:   p.actorId,
      action:     p.action,
      project_id: p.projectId ?? null,
      resource:   p.resource  ?? null,
      old_value:  p.oldValue  != null ? p.oldValue  : null,
      new_value:  p.newValue  != null ? p.newValue  : null,
    });
  } catch (e) {
    console.error('[audit] log failed:', e);
  }
}
