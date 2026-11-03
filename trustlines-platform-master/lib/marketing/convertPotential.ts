// Marketing → "Convert to Opportunity": a Potential that's ready becomes an Opportunity handed to
// Sales (stage sales_handoff — it shows up on Sales → Handoffs to Accept). The automatic path
// (lib/marketing/opportunityEngine: a document on the Need) only covers Potentials the engine
// made; this is the button for every other one, ClickUp's included. Idempotent: a Potential
// already converted returns its Opportunity.
import { logAudit } from '@/lib/audit/log';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ConvertError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const CLOSED = ['converted', 'lost', 'cancelled'];

export async function convertPotentialToOpportunity(admin: any, potentialId: string, actorId: string): Promise<{ opportunity: Record<string, any>; alreadyConverted: boolean }> {
  const { data: p } = await admin.from('prospect_potentials').select('*').eq('id', potentialId).is('deleted_at', null).maybeSingle();
  if (!p) throw new ConvertError('Not found', 404);

  if (p.converted_opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('*').eq('id', p.converted_opportunity_id).maybeSingle();
    if (opp) return { opportunity: opp, alreadyConverted: true };
  }
  if (CLOSED.includes(p.status) && p.status !== 'converted') throw new ConvertError(`This Potential is ${p.status} — reopen it before converting`, 409);
  if (!p.need_id) throw new ConvertError('This Potential has no Need to carry over — add one on the Contact first', 409);

  // The Need may already have an open Opportunity (e.g. made by hand) — link that one instead.
  const { data: existing } = await admin.from('opportunities').select('*').eq('need_id', p.need_id).is('deleted_at', null)
    .not('stage', 'in', '(closed_won,closed_lost)').limit(1).maybeSingle();

  let opportunity = existing;
  if (!opportunity) {
    const { data, error } = await admin.from('opportunities').insert({
      prospect_id: p.prospect_id, need_id: p.need_id, title: p.title,
      stage: 'sales_handoff', sales_handoff_at: new Date().toISOString(),
      marketing_owner_id: p.assigned_to ?? actorId, auto_managed: false,
      region: p.region, state: p.state, formatted_address: p.formatted_address, brand: p.brand,
      primary_contact_id: p.primary_contact_id, external_project_code: p.external_project_code,
      estimated_value: p.estimated_value, currency: p.currency ?? undefined, deadline: p.due_date,
      deposit: p.deposit, payment_raw: p.payment_raw, targeted: p.targeted,
      business_types: p.business_types, industry_raw: p.industry_raw, project_type_raw: p.project_type_raw,
      request_raw: p.request_raw, to_do_raw: p.to_do_raw, direct_contact_raw: p.direct_contact_raw,
      source_raw_label: p.source_raw_label, tags: p.tags, description: p.notes,
      classification_reasons: ['Converted from a Potential by Marketing'],
      created_by: actorId,
    }).select('*').single();
    if (error) throw new ConvertError(`Could not open the Opportunity: ${error.message}`, 500);
    opportunity = data;
  }

  await admin.from('prospect_potentials').update({ status: 'converted', converted_opportunity_id: opportunity.id }).eq('id', potentialId);
  await admin.from('prospect_needs').update({ classification: 'opportunity' }).eq('id', p.need_id);
  await logAudit({ actorId, action: 'potential.converted_to_opportunity', resource: `potential:${potentialId}`, newValue: { opportunity_id: opportunity.id, linked_existing: !!existing } });
  return { opportunity, alreadyConverted: false };
}
