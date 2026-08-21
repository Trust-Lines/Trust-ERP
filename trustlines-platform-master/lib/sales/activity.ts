// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logLeadActivity(admin: any, p: {
  leadIntakeId?: string;
  opportunityId?: string;
  actorId: string | null;
  kind: 'comment' | 'change';
  body: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!p.leadIntakeId && !p.opportunityId) {
    console.error('[lead_activity] log failed: neither leadIntakeId nor opportunityId given');
    return;
  }
  try {
    await admin.from('lead_activity').insert({
      lead_intake_id: p.leadIntakeId ?? null,
      opportunity_id: p.opportunityId ?? null,
      actor_id: p.actorId,
      kind: p.kind,
      body: p.body,
      meta: p.meta ?? {},
    });
  } catch (e) {
    console.error('[lead_activity] log failed:', e instanceof Error ? e.message : e);
  }
}
