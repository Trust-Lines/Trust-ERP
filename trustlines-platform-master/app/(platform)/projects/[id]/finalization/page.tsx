import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FinalizationClient } from '@/components/platform/projects/FinalizationClient';
import { FINALIZATION_READ_ROLES, FINALIZATION_WRITE_ROLES, defaultSiteChecklist } from '@/lib/finalization/config';
import { runPmFollowupReminders } from '@/lib/pm/followupReminders';

export default async function ProjectFinalizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!FINALIZATION_READ_ROLES.includes(role)) redirect('/projects');
  const canEdit = FINALIZATION_WRITE_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: project } = await admin.from('projects')
    .select('id, code, name, customer_id, tlines_pm_id').eq('id', id).maybeSingle();
  if (!project) notFound();
  if (role === 'tlines_pm' && project.tlines_pm_id !== user.id) redirect('/projects');

  await runPmFollowupReminders(admin, user.id);

  const crRes = await admin.from('change_requests')
    .select('id, project_id, customer_contact_id, title, description, category, status, budget_impact, currency, timeline_impact_days, decision_note, resolved_at, created_at, updated_at')
    .eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  const changeRequests = crRes.error ? [] : (crRes.data ?? []);
  const schemaError: string | null = crRes.error
    ? `Finalization tables are not ready (${crRes.error.message}). Run migration 055_finalization.sql.`
    : null;

  const srRes = await admin.from('site_readiness')
    .select('id, project_id, checklist, overall_status, target_ready_date, notes, created_at, updated_at')
    .eq('project_id', id).maybeSingle();
  const siteReadiness = srRes.error ? null : (srRes.data ?? null);

  let contacts: { id: string; name: string }[] = [];
  if (project.customer_id) {
    const cRes = await admin.from('customer_contacts')
      .select('id, name').eq('customer_id', project.customer_id).is('deleted_at', null).order('name');
    contacts = cRes.error ? [] : (cRes.data ?? []);
  }

  type Ev = { kind: string; at: string; title: string; detail?: string };
  const events: Ev[] = [];

  for (const cr of changeRequests as { title: string; status: string; created_at: string }[]) {
    events.push({ kind: 'change_request', at: cr.created_at, title: `Change request: ${cr.title}`, detail: cr.status.replace(/_/g, ' ') });
  }

  const stRes = await admin.from('stage_transitions')
    .select('from_stage, to_stage, created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(50);
  for (const s of ((stRes.error ? [] : stRes.data ?? []) as { from_stage: string; to_stage: string; created_at: string }[])) {
    events.push({ kind: 'stage', at: s.created_at, title: `Stage → ${s.to_stage.replace(/_/g, ' ')}`, detail: s.from_stage ? `from ${s.from_stage.replace(/_/g, ' ')}` : undefined });
  }

  if (project.customer_id) {
    const mRes = await admin.from('customer_meetings')
      .select('title, meeting_type, meeting_at, status').eq('customer_id', project.customer_id).is('deleted_at', null).order('meeting_at', { ascending: false }).limit(50);
    for (const m of ((mRes.error ? [] : mRes.data ?? []) as { title: string; meeting_type: string | null; meeting_at: string; status: string }[])) {
      events.push({ kind: 'meeting', at: m.meeting_at, title: `Meeting: ${m.title}`, detail: [m.meeting_type?.replace(/_/g, ' '), m.status].filter(Boolean).join(' · ') });
    }
    const fRes = await admin.from('customer_follow_ups')
      .select('note, due_date, status, created_at').eq('customer_id', project.customer_id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
    for (const f of ((fRes.error ? [] : fRes.data ?? []) as { note: string; due_date: string; status: string; created_at: string }[])) {
      events.push({ kind: 'follow_up', at: f.created_at, title: `Follow-up: ${f.note}`, detail: `due ${f.due_date} · ${f.status}` });
    }
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  const timeline = events.slice(0, 60);

  return (
    <div className="main-inner">
      <FinalizationClient
        projectId={id}
        projectCode={project.code}
        projectName={project.name}
        canEdit={canEdit}
        initialChangeRequests={changeRequests}
        initialSiteReadiness={siteReadiness}
        siteTemplate={defaultSiteChecklist()}
        contacts={contacts}
        timeline={timeline}
        schemaError={schemaError}
      />
    </div>
  );
}
