
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  classifyLead, CLASSIFICATION_TO_NEED, CLASSIFICATION_RULE_VERSION,
  type ClassificationResult,
} from './classification';
import type { ProjectType, ScopeType, LeadTiming, NeedClassification } from '@/types/database';

interface NeedRowForEngine {
  id: string;
  prospect_id: string;
  location_id: string | null;
  title: string;
  project_types: ProjectType[];
  scope_types: ScopeType[];
  has_active_project: boolean | null;
  deadline: string | null;
  expected_start_date: string | null;
  layout_available: boolean | null;
  timing: LeadTiming | null;
  target_contact_date: string | null;
  source: string | null;
}

export interface NeedSyncResult {
  classification: ClassificationResult;
  needClassification: NeedClassification;
  opportunity: Record<string, unknown> | null;
  opportunityAction: 'created' | 'updated' | 'put_on_hold' | 'none';
  potential: Record<string, unknown> | null;
  potentialAction: 'created' | 'updated' | 'converted' | 'none';
}

async function rollupProspectStatus(admin: any, prospectId: string): Promise<void> {
  const { data: needs } = await admin.from('prospect_needs')
    .select('classification').eq('prospect_id', prospectId).is('deleted_at', null);
  const classifications = ((needs ?? []) as { classification: NeedClassification }[]).map(n => n.classification);
  let status = 'captured';
  if (classifications.includes('opportunity')) status = 'opportunity_candidate';
  else if (classifications.includes('potential')) status = 'potential';
  else if (classifications.length > 0 && classifications.every(c => c === 'disqualified')) status = 'disqualified';
  await admin.from('prospects').update({ status }).eq('id', prospectId);
}

function titleFor(prospectDisplayName: string, need: NeedRowForEngine): string {
  return `${prospectDisplayName} — ${need.title}`;
}

export async function runClassificationForNeed(admin: any, needId: string, actorId: string): Promise<NeedSyncResult> {
  const { data: need } = await admin.from('prospect_needs')
    .select('id, prospect_id, location_id, title, project_types, scope_types, has_active_project, deadline, expected_start_date, layout_available, timing, target_contact_date, source')
    .eq('id', needId).maybeSingle();
  if (!need) throw new Error('Need not found for classification sync');
  const n = need as NeedRowForEngine;

  const { data: prospect } = await admin.from('prospects').select('display_name, owner_id, assigned_marketing_user_id').eq('id', n.prospect_id).maybeSingle();
  const displayName = prospect?.display_name ?? 'Lead';
  const ownerId = prospect?.assigned_marketing_user_id ?? prospect?.owner_id ?? actorId;

  const { data: primaryContactRow } = await admin.from('prospect_contacts')
    .select('id').eq('prospect_id', n.prospect_id).eq('is_primary', true).limit(1).maybeSingle();
  const primaryContactId: string | null = primaryContactRow?.id ?? null;

  const { data: docs } = await admin.from('prospect_need_documents').select('id').eq('need_id', needId).limit(1);
  const hasDocumentEvidence = Array.isArray(docs) && docs.length > 0;

  const classification = classifyLead({
    hasActiveProject: n.has_active_project,
    deadline: n.deadline,
    expectedStartDate: n.expected_start_date,
    projectTypes: n.project_types ?? [],
    locationCount: n.location_id ? 1 : null,
    futureExpansion: false,
    layoutAvailable: n.layout_available,
    timing: n.timing,
    hasDocumentEvidence,
  });
  const needClassification = CLASSIFICATION_TO_NEED[classification.classification];
  const contactDate = n.target_contact_date ?? classification.recommendedFollowUpDate;

  await admin.from('prospect_needs').update({
    classification: needClassification,
    classification_reasons: classification.reasons,
    classification_rule_version: CLASSIFICATION_RULE_VERSION,
    status: needClassification === 'disqualified' ? 'disqualified' : 'open',
  }).eq('id', needId);

  const { data: existingOpp } = await admin.from('opportunities')
    .select('id, stage, admin_corrected').eq('need_id', needId).eq('auto_managed', true).is('deleted_at', null)
    .not('stage', 'in', '(closed_won,closed_lost)').maybeSingle();
  const stageLocked = !!existingOpp?.admin_corrected;
  const { data: existingPotential } = await admin.from('prospect_potentials')
    .select('id, status').eq('need_id', needId).eq('auto_managed', true).is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)').maybeSingle();

  let opportunity: Record<string, unknown> | null = null;
  let opportunityAction: NeedSyncResult['opportunityAction'] = 'none';
  let potential: Record<string, unknown> | null = null;
  let potentialAction: NeedSyncResult['potentialAction'] = 'none';

  if (needClassification === 'opportunity') {
    if (existingOpp) {
      const nextStage = existingOpp.stage === 'on_hold' ? 'marketing_qualification' : existingOpp.stage;
      const update: Record<string, unknown> = {
        title: titleFor(displayName, n), project_types: n.project_types ?? [], scope_types: n.scope_types ?? [],
        deadline: n.deadline, source_label: n.source, classification_reasons: classification.reasons,
        classification_rule_version: CLASSIFICATION_RULE_VERSION, primary_contact_id: primaryContactId,
      };
      if (!stageLocked) update.stage = nextStage;
      const { data } = await admin.from('opportunities').update(update).eq('id', existingOpp.id).select().maybeSingle();
      opportunity = data; opportunityAction = 'updated';
    } else {
      const { data } = await admin.from('opportunities').insert({
        prospect_id: n.prospect_id, need_id: needId, title: titleFor(displayName, n),
        project_types: n.project_types ?? [], scope_types: n.scope_types ?? [], stage: 'new', source_label: n.source,
        marketing_owner_id: ownerId, deadline: n.deadline, auto_managed: true, primary_contact_id: primaryContactId,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        created_by: actorId,
      }).select().maybeSingle();
      opportunity = data; opportunityAction = 'created';
    }
    if (existingPotential) {
      const { data } = await admin.from('prospect_potentials').update({
        status: 'converted', converted_opportunity_id: opportunity?.id ?? null,
      }).eq('id', existingPotential.id).select().maybeSingle();
      potential = data; potentialAction = 'converted';
    }
  } else if (needClassification === 'potential') {
    if (existingPotential) {
      const { data } = await admin.from('prospect_potentials').update({
        title: titleFor(displayName, n), target_contact_date: contactDate,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        primary_contact_id: primaryContactId,
      }).eq('id', existingPotential.id).select().maybeSingle();
      potential = data; potentialAction = 'updated';
    } else {
      const { data } = await admin.from('prospect_potentials').insert({
        need_id: needId, prospect_id: n.prospect_id, title: titleFor(displayName, n),
        status: 'identified', target_contact_date: contactDate,
        assigned_to: ownerId, auto_managed: true, primary_contact_id: primaryContactId,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        created_by: actorId,
      }).select().maybeSingle();
      potential = data; potentialAction = 'created';
    }
    if (existingOpp && existingOpp.stage !== 'on_hold' && !stageLocked) {
      const { data } = await admin.from('opportunities').update({
        stage: 'on_hold',
        classification_reasons: [...classification.reasons, 'Put on hold: this Need no longer meets Opportunity Candidate criteria'],
        classification_rule_version: CLASSIFICATION_RULE_VERSION,
      }).eq('id', existingOpp.id).select().maybeSingle();
      opportunity = data; opportunityAction = 'put_on_hold';
    }
  } else if (existingOpp && existingOpp.stage !== 'on_hold' && !stageLocked) {
    const { data } = await admin.from('opportunities').update({
      stage: 'on_hold',
      classification_reasons: [...classification.reasons, 'Put on hold: this Need no longer meets Opportunity Candidate criteria'],
      classification_rule_version: CLASSIFICATION_RULE_VERSION,
    }).eq('id', existingOpp.id).select().maybeSingle();
    opportunity = data; opportunityAction = 'put_on_hold';
  }

  await rollupProspectStatus(admin, n.prospect_id);

  return { classification, needClassification, opportunity, opportunityAction, potential, potentialAction };
}
