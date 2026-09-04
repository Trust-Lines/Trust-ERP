import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { sendEmail } from '@/lib/email/send';
import { logLeadActivity } from '@/lib/sales/activity';
import { scopeToCategories } from '@/lib/sales/scope';
import { PHASE1_STEPS } from '@/lib/workflow/steps';
import { getNextStage, STAGE_PHASE } from '@/lib/workflow/machine';
import { ensureDesignDropboxFolder } from '@/lib/sales/design';
import { appBaseUrl } from '@/lib/env/appUrl';

export interface DeliverResult {
  ok: boolean;
  projectId?: string;
  code?: string;
  nextStage?: string;
  alreadyDelivered?: boolean;
  error?: string;
  blocked?: 'BLOCK1_INCOMPLETE';
  customerMissing?: boolean;
}

export async function deliverLeadToTrust(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, leadId: string, actorId: string | null,
): Promise<DeliverResult> {
  const { data: intake } = await admin.from('lead_intake').select('*').eq('id', leadId).maybeSingle();
  if (!intake) return { ok: false, error: 'Intake not found' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = intake as any;

  if (!row.project_id) return { ok: false, blocked: 'BLOCK1_INCOMPLETE', error: 'Complete Block 1 (region, client, service, address) first.' };
  if (row.is_delivered) return { ok: true, projectId: row.project_id, alreadyDelivered: true, customerMissing: !row.customer_id };

  const customerMissing = !row.customer_id;

  const categories = scopeToCategories(row.scope_of_work);

  const { error: upErr } = await admin.from('projects').update({
    is_draft:              false,
    delivered_to_trust_at: new Date().toISOString(),
    region:                row.region,
    service_line:          row.service_line,
    site_location:         row.address,
    categories,
  }).eq('id', row.project_id);
  if (upErr) return { ok: false, error: upErr.message };

  if (row.customer_id) {
    const { error: custErr } = await admin.from('projects').update({ customer_id: row.customer_id }).eq('id', row.project_id);
    if (custErr) console.warn('[deliver] customer_id propagate skipped:', custErr.message);
  }

  const { data: planDocs } = await admin.from('lead_intake_documents')
    .select('id, dropbox_path, file_name').eq('lead_intake_id', row.id).eq('category', 'plan_layout');

  let planDocumentId: string | null = null;
  for (const [i, d] of ((planDocs ?? []) as { dropbox_path: string; file_name: string }[]).entries()) {
    const { data: doc } = await admin.from('documents').insert({
      project_id: row.project_id, doc_type: 'plan_layout', version: i + 1, status: 'approved',
      dropbox_path: d.dropbox_path, file_name: d.file_name, uploaded_by: actorId,
    }).select('id').single();
    if (doc && !planDocumentId) planDocumentId = (doc as { id: string }).id;
  }

  const doneKeys = new Set(['closed_deal', 'plan_layout']);
  const nowIso = new Date().toISOString();
  for (const key of doneKeys) {
    const { data: existing } = await admin.from('project_steps')
      .select('id').eq('project_id', row.project_id).eq('phase', 'phase1').eq('step_key', key).is('cat_group', null).maybeSingle();
    const payload = {
      status: 'done', completed_by: actorId, completed_at: nowIso,
      ...(key === 'plan_layout' && planDocumentId ? { document_id: planDocumentId } : {}),
    };
    if (existing) await admin.from('project_steps').update(payload).eq('id', (existing as { id: string }).id);
    else          await admin.from('project_steps').insert({ project_id: row.project_id, phase: 'phase1', step_key: key, cat_group: null, ...payload });
  }
  const nextStep  = PHASE1_STEPS.find(s => !doneKeys.has(s.key));
  const nextStage = getNextStage('closed_deal') ?? 'finalization';
  await admin.from('projects').update({ current_stage: nextStage, current_phase: STAGE_PHASE[nextStage] }).eq('id', row.project_id);

  await admin.from('lead_intake').update({ is_delivered: true }).eq('id', row.id);

  await ensureDesignDropboxFolder(admin, row.project_id);

  const { data: project } = await admin.from('projects').select('code, name').eq('id', row.project_id).single();
  const proj = (project as { code: string; name: string } | null) ?? { code: '', name: '' };
  const { data: recipients } = await admin.from('profiles')
    .select('id, full_name, email').in('role', ['ops_manager', 'general_manager']).eq('is_active', true);

  const appUrl = appBaseUrl();
  const link = `/projects/${row.project_id}`;
  for (const r of (recipients ?? []) as { id: string; full_name: string; email: string }[]) {
    await admin.from('notifications').insert({
      user_id: r.id, project_id: row.project_id, type: 'project.delivered',
      title: `New project delivered: ${proj.code}`,
      body: `${proj.name} was delivered to Trust-Lines.`, link,
    });
    try {
      await sendEmail(r.email, `New project delivered — ${proj.code}`,
        `<p>Hi ${r.full_name},</p><p><strong>${proj.name}</strong> (${proj.code}) has moved to Supply.</p><p><a href="${appUrl}${link}">Open the project →</a></p>`);
    } catch (e) { console.error('[deliver] email failed:', e instanceof Error ? e.message : e); }
  }

  await logAudit({ actorId, action: 'project.delivered_to_trust', projectId: row.project_id, newValue: { code: proj.code, nextStage, categories } });
  await logLeadActivity(admin, { leadIntakeId: leadId, actorId, kind: 'change', body: `moved to Supply as ${proj.code}` });

  await emitEvent(admin, {
    type: 'lead.closed_won',
    entityTable: 'lead_intake',
    entityId: row.id,
    projectId: row.project_id,
    leadId: row.id,
    actorId,
    payload: { projectCode: proj.code, categories },
  });

  return { ok: true, projectId: row.project_id, code: proj.code, nextStage, customerMissing };
}
