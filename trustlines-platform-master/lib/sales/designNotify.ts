// Notifies the designer of a deal's open design job when Sales writes a note on that deal —
// so a note written in the CRM reaches the Design workspace. Never throws.

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function notifyDesignerOfDealNote(admin: any, p: {
  opportunityId?: string | null; leadIntakeId?: string | null; actorId: string; body: string;
}): Promise<void> {
  try {
    if (!p.opportunityId && !p.leadIntakeId) return;
    let q = admin.from('sales_design_jobs').select('id, title, assigned_designer_id')
      .is('deleted_at', null).not('status', 'in', '(completed,cancelled)');
    q = p.opportunityId ? q.eq('opportunity_id', p.opportunityId) : q.eq('lead_intake_id', p.leadIntakeId);
    const { data } = await q;
    const rows = ((data ?? []) as { id: string; title: string; assigned_designer_id: string | null }[])
      .filter(j => j.assigned_designer_id && j.assigned_designer_id !== p.actorId)
      .map(j => ({
        user_id: j.assigned_designer_id, project_id: null, type: 'design',
        title: `New note on ${j.title}`, body: p.body.slice(0, 140), link: `/design?job=${j.id}`,
      }));
    if (rows.length) await admin.from('notifications').insert(rows);
  } catch (e) {
    console.error('[design notify] failed:', e instanceof Error ? e.message : e);
  }
}
