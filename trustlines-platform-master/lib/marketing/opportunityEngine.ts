
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  classifyLead, CLASSIFICATION_TO_NEED, CLASSIFICATION_RULE_VERSION,
  PROJECT_TYPE_LABEL, TIMING_LABEL,
  type ClassificationResult,
} from './classification';
import type { ProjectType, ScopeType, LeadTiming, NeedClassification } from '@/types/database';

interface NeedRowForEngine {
  id: string;
  prospect_id: string;
  location_id: string | null;
  title: string;
  description: string | null;
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

// Direct instruction (2026-09-18): a Need with a real address on its Location should title
// the Potential/Opportunity BY that address ("Salem, 4601 Silverton RD NE, OR"), matching how
// the ClickUp-imported historical data always looked — not "ContactName — Need title", which
// is what every one of these showed regardless of whether an address existed.
function titleFor(prospectDisplayName: string, need: NeedRowForEngine, locationAddress: string | null): string {
  return locationAddress || `${prospectDisplayName} — ${need.title}`;
}

// 🔴 2026-09-17: the Opportunity branch below already copies `project_types` straight from
// the Need onto the Opportunity row — the Potential branch never did the equivalent, so
// every auto-created Potential (survey submissions especially, which have no other path to
// set this) showed a blank "Project Type" field in the UI even though the real answer was
// sitting right there on the Need. Potentials don't have their own typed project_types
// column (only the free-text `project_type_raw` ClickUp-import column), so this renders the
// same list Opportunities store structurally into that field's label text.
function projectTypeRawFor(types: ProjectType[]): string | null {
  if (!types.length) return null;
  return types.map(t => PROJECT_TYPE_LABEL[t] ?? t).join(', ');
}

// Timing has nowhere to live as its own column on `prospect_potentials` OR `opportunities`
// (only `prospect_needs.timing` does) — folded into notes/description as a labeled first
// line, ahead of the Need's own description (the composed challenges/contact-preference/
// store-status text the public survey already writes — see
// lib/marketing/campaignSubmission.ts). Set at creation time only, so a later manual edit
// is never clobbered by a reclassification re-run.
function composedNotes(need: NeedRowForEngine): string | null {
  const lines = [
    need.timing ? `Timing: ${TIMING_LABEL[need.timing]}` : null,
    need.description?.trim() || null,
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

export async function runClassificationForNeed(admin: any, needId: string, actorId: string): Promise<NeedSyncResult> {
  const { data: need } = await admin.from('prospect_needs')
    .select('id, prospect_id, location_id, title, description, project_types, scope_types, has_active_project, deadline, expected_start_date, layout_available, timing, target_contact_date, source')
    .eq('id', needId).maybeSingle();
  if (!need) throw new Error('Need not found for classification sync');
  const n = need as NeedRowForEngine;

  const { data: prospect } = await admin.from('prospects').select('display_name, owner_id, assigned_marketing_user_id').eq('id', n.prospect_id).maybeSingle();
  const displayName = prospect?.display_name ?? 'Lead';
  // 🔴 2026-09-18: used to fall back to `actorId` when the Contact itself has no
  // owner/assignee — for a human clicking "Add Potential" that's a reasonable default (assign
  // to whoever's doing the work), but this same function also runs from the public-survey
  // automation with actorId = the campaign's owner/creator account, auto-"assigning" every
  // survey-sourced Potential to that one account regardless of who should actually work it
  // (direct report: "surveyden gelenler assign oluyor otomatik Hamza adına, o olmaz"). No
  // fallback to actorId — stays unassigned until a human explicitly picks someone, same as
  // Contacts.
  const ownerId = prospect?.assigned_marketing_user_id ?? prospect?.owner_id ?? null;

  const { data: primaryContactRow } = await admin.from('prospect_contacts')
    .select('id').eq('prospect_id', n.prospect_id).eq('is_primary', true).limit(1).maybeSingle();
  const primaryContactId: string | null = primaryContactRow?.id ?? null;

  let locationAddress: string | null = null;
  if (n.location_id) {
    const { data: loc } = await admin.from('prospect_locations')
      .select('city, address_line_1, state').eq('id', n.location_id).maybeSingle();
    if (loc) locationAddress = [loc.city, loc.address_line_1, loc.state].filter(Boolean).join(', ') || null;
  }

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
        title: titleFor(displayName, n, locationAddress), project_types: n.project_types ?? [], scope_types: n.scope_types ?? [],
        deadline: n.deadline, source_label: n.source, classification_reasons: classification.reasons,
        classification_rule_version: CLASSIFICATION_RULE_VERSION, primary_contact_id: primaryContactId,
      };
      if (!stageLocked) update.stage = nextStage;
      const { data } = await admin.from('opportunities').update(update).eq('id', existingOpp.id).select().maybeSingle();
      opportunity = data; opportunityAction = 'updated';
    } else {
      // 🔴 2026-09-17: goes straight to Sales, not just visible-but-unhanded — direct
      // product decision ("bence otomatik gitmeli Sales'e"). Document evidence attached is
      // the one real signal this is ready; nobody should have to remember to click a
      // button to send it. Manual "Hand off to Sales" stays available (Contact detail page)
      // for the one case this doesn't cover: an Opportunity Sales already returned to
      // Marketing, which needs a human to re-send once whatever was wrong is fixed.
      const { data } = await admin.from('opportunities').insert({
        prospect_id: n.prospect_id, need_id: needId, title: titleFor(displayName, n, locationAddress),
        project_types: n.project_types ?? [], scope_types: n.scope_types ?? [], stage: 'sales_handoff',
        sales_handoff_at: new Date().toISOString(), source_label: n.source,
        marketing_owner_id: ownerId, deadline: n.deadline, auto_managed: true, primary_contact_id: primaryContactId,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        description: composedNotes(n),
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
        title: titleFor(displayName, n, locationAddress), target_contact_date: contactDate,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        primary_contact_id: primaryContactId, project_type_raw: projectTypeRawFor(n.project_types ?? []),
      }).eq('id', existingPotential.id).select().maybeSingle();
      potential = data; potentialAction = 'updated';
    } else {
      const { data } = await admin.from('prospect_potentials').insert({
        need_id: needId, prospect_id: n.prospect_id, title: titleFor(displayName, n, locationAddress),
        status: 'identified', target_contact_date: contactDate,
        assigned_to: ownerId, auto_managed: true, primary_contact_id: primaryContactId,
        classification_reasons: classification.reasons, classification_rule_version: CLASSIFICATION_RULE_VERSION,
        project_type_raw: projectTypeRawFor(n.project_types ?? []), notes: composedNotes(n),
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
