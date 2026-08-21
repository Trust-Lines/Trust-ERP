// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyLeadWatchers(admin: any, p: {
  leadId?: string;
  opportunityId?: string;
  actorId: string;
  title: string;
  body: string;
  projectId?: string | null;
}): Promise<void> {
  try {
    const ids = new Set<string>();
    let link: string;
    let type: string;

    if (p.leadId) {
      const [watchersRes, intakeRes] = await Promise.all([
        admin.from('lead_watchers').select('user_id').eq('lead_intake_id', p.leadId),
        admin.from('lead_intake').select('assignee_id').eq('id', p.leadId).single(),
      ]);
      for (const w of (watchersRes.data ?? []) as { user_id: string }[]) ids.add(w.user_id);
      const asg = (intakeRes.data as { assignee_id?: string } | null)?.assignee_id;
      if (asg) ids.add(asg);
      link = `/leads/${p.leadId}`;
      type = 'lead';
    } else if (p.opportunityId) {
      const [watchersRes, oppRes] = await Promise.all([
        admin.from('lead_watchers').select('user_id').eq('opportunity_id', p.opportunityId),
        admin.from('opportunities').select('prospect_id, sales_owner_id, marketing_owner_id').eq('id', p.opportunityId).single(),
      ]);
      for (const w of (watchersRes.data ?? []) as { user_id: string }[]) ids.add(w.user_id);
      const opp = oppRes.data as { prospect_id?: string; sales_owner_id?: string | null; marketing_owner_id?: string | null } | null;
      if (opp?.sales_owner_id) ids.add(opp.sales_owner_id);
      if (opp?.marketing_owner_id) ids.add(opp.marketing_owner_id);
      link = opp?.prospect_id ? `/marketing/prospects/${opp.prospect_id}?tab=opportunities` : '/marketing/opportunities';
      type = 'opportunity';
    } else {
      return;
    }

    ids.delete(p.actorId);
    if (ids.size === 0) return;

    const rows = [...ids].map(uid => ({
      user_id: uid, project_id: p.projectId ?? null, type,
      title: p.title, body: p.body, link,
    }));
    await admin.from('notifications').insert(rows);
  } catch (e) {
    console.error('[notify] watchers failed:', e instanceof Error ? e.message : e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyUser(admin: any, p: {
  userId: string; title: string; body: string;
  leadId?: string; opportunityId?: string;
}): Promise<void> {
  try {
    let link = '/dashboard';
    let type = 'lead';
    if (p.leadId) {
      link = `/leads/${p.leadId}`;
    } else if (p.opportunityId) {
      const { data: opp } = await admin.from('opportunities').select('prospect_id').eq('id', p.opportunityId).maybeSingle();
      link = opp?.prospect_id ? `/marketing/prospects/${opp.prospect_id}?tab=opportunities` : '/marketing/opportunities';
      type = 'opportunity';
    }
    await admin.from('notifications').insert({
      user_id: p.userId, project_id: null, type,
      title: p.title, body: p.body, link,
    });
  } catch (e) {
    console.error('[notify] user failed:', e instanceof Error ? e.message : e);
  }
}
