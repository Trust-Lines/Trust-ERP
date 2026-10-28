import { NextRequest, NextResponse } from 'next/server';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyLeadWatchers } from '@/lib/sales/notify';
import { notifyDesignerOfDealNote } from '@/lib/sales/designNotify';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';

type Params = { params: Promise<{ jobId: string }> };

// The Design workspace "Notes" + "Activity" tabs. Notes are the deal's OWN notes — the same rows
// the CRM shows (need_notes for an Opportunity, lead_activity comments for a lead intake) — so
// Sales writes in the CRM, the designer reads and answers here, nothing is copied.

interface NoteOut { id: string; author_id: string | null; author_name: string | null; body: string; created_at: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
async function namesFor(admin: any, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map();
  const { data } = await admin.from('profiles').select('id, full_name').in('id', unique);
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  let notes: NoteOut[] = [];
  if (job!.opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('need_id').eq('id', job!.opportunity_id).maybeSingle();
    if (opp?.need_id) {
      const { data } = await admin.from('need_notes')
        .select('id, author_id, author_name, body, source_created_at, created_at').eq('need_id', opp.need_id)
        .order('created_at', { ascending: true }).limit(300);
      notes = ((data ?? []) as any[]).map(n => ({
        id: n.id, author_id: n.author_id, author_name: n.author_name, body: n.body ?? '', created_at: n.source_created_at ?? n.created_at,
      }));
    }
  }

  // lead_activity: comments are a lead's notes; every row is the Activity tab.
  let aq = admin.from('lead_activity').select('id, actor_id, kind, body, created_at').order('created_at', { ascending: false }).limit(200);
  aq = job!.opportunity_id ? aq.eq('opportunity_id', job!.opportunity_id) : aq.eq('lead_intake_id', job!.lead_intake_id);
  const { data: actRows } = await aq;
  const acts = (actRows ?? []) as { id: string; actor_id: string | null; kind: string; body: string | null; created_at: string }[];
  const names = await namesFor(admin, [...acts.map(a => a.actor_id), ...notes.map(n => n.author_id)]);
  if (!job!.opportunity_id) {
    notes = acts.filter(a => a.kind === 'comment').reverse().map(a => ({
      id: a.id, author_id: a.actor_id, author_name: a.actor_id ? names.get(a.actor_id) ?? null : null, body: a.body ?? '', created_at: a.created_at,
    }));
  }
  for (const n of notes) if (!n.author_name && n.author_id) n.author_name = names.get(n.author_id) ?? null;
  const activity = acts.map(a => ({ ...a, actor_name: a.actor_id ? names.get(a.actor_id) ?? 'Someone' : 'System' }));

  return NextResponse.json({ notes, activity, me: user.id });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const { body } = await req.json().catch(() => ({})) as { body?: string };
  const text = String(body ?? '').trim().slice(0, 5000);
  if (!text) return NextResponse.json({ error: 'Write something first' }, { status: 400 });

  const { data: me } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const { data: jobRow } = await admin.from('sales_design_jobs').select('title').eq('id', jobId).maybeSingle();
  const title = jobRow?.title ?? 'a design job';
  let note: NoteOut;

  if (job!.opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('need_id').eq('id', job!.opportunity_id).maybeSingle();
    if (!opp?.need_id) return NextResponse.json({ error: 'This deal has no linked Need to keep notes on' }, { status: 409 });
    const now = new Date().toISOString();
    const { data, error } = await admin.from('need_notes').insert({
      need_id: opp.need_id, author_id: user.id, author_name: me?.full_name ?? null, body: text, source_created_at: now,
    }).select('id, created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    note = { id: data.id, author_id: user.id, author_name: me?.full_name ?? null, body: text, created_at: now };
  } else {
    await logLeadActivity(admin, { leadIntakeId: job!.lead_intake_id!, actorId: user.id, kind: 'comment', body: text });
    note = { id: `local-${Date.now()}`, author_id: user.id, author_name: me?.full_name ?? null, body: text, created_at: new Date().toISOString() };
  }

  // The designer writing → Sales (owner + watchers). Sales writing here → the designer.
  if (job!.assigned_designer_id === user.id) {
    await notifyLeadWatchers(admin, {
      leadId: job!.lead_intake_id ?? undefined, opportunityId: job!.opportunity_id ?? undefined,
      actorId: user.id, title: `Designer note on ${title}`, body: text.slice(0, 140),
    });
  } else {
    await notifyDesignerOfDealNote(admin, { opportunityId: job!.opportunity_id, leadIntakeId: job!.lead_intake_id, actorId: user.id, body: text });
  }
  return NextResponse.json({ note }, { status: 201 });
}
