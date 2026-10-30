import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';
import { defaultContractTerms, parseEstimate } from '@/lib/sales/documents';
import { documentNumber } from '@/lib/sales/documentTokens';
import { CONTRACT_COLS, dbFail, ESTIMATE_COLS, notReady, withTotals } from '@/lib/sales/documentsServer';

type Params = { params: Promise<{ id: string }> };

// Estimates + contracts of one Opportunity (the deal panel's "Estimate & Contract" card).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const [est, ctr] = await Promise.all([
    admin.from('sales_estimates').select(ESTIMATE_COLS).eq('opportunity_id', id).is('deleted_at', null).order('version', { ascending: false }),
    admin.from('sales_contracts').select(CONTRACT_COLS).eq('opportunity_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
  ]);
  if (est.error) return notReady(est.error) ? NextResponse.json({ notReady: true, estimates: [], contracts: [] }) : dbFail('load the estimates', est.error);
  if (ctr.error) return dbFail('load the contracts', ctr.error);
  // Default recipient for "Send": the deal's primary contact, else the Contact's main address.
  const { data: opp } = await admin.from('opportunities').select('prospect_id, primary_contact_id').eq('id', id).maybeSingle();
  const { data: pc } = opp?.primary_contact_id ? await admin.from('prospect_contacts').select('email').eq('id', opp.primary_contact_id).maybeSingle() : { data: null };
  const { data: pr } = !pc?.email && opp?.prospect_id ? await admin.from('prospects').select('main_email').eq('id', opp.prospect_id).maybeSingle() : { data: null };
  return NextResponse.json({ estimates: est.data ?? [], contracts: ctr.data ?? [], contactEmail: pc?.email ?? pr?.main_email ?? null });
}

// { type: 'estimate', ...fields } — a new estimate (next version number).
// { type: 'contract', estimateId } — a contract drafted from an accepted estimate.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.type === 'contract') {
    const { data: est } = await admin.from('sales_estimates').select('id, number, title, currency, total, status, valid_until')
      .eq('id', String(body.estimateId ?? '')).eq('opportunity_id', id).is('deleted_at', null).maybeSingle();
    if (!est) return NextResponse.json({ error: 'Pick the estimate the contract is based on' }, { status: 400 });
    if (est.status !== 'accepted') return NextResponse.json({ error: 'The contract is drafted from an accepted estimate' }, { status: 409 });
    const { data: opp } = await admin.from('opportunities').select('prospect_id, primary_contact_id').eq('id', id).maybeSingle();
    const { data: prospect } = opp?.prospect_id ? await admin.from('prospects').select('display_name, main_email').eq('id', opp.prospect_id).maybeSingle() : { data: null };
    const { data: contact } = opp?.primary_contact_id ? await admin.from('prospect_contacts').select('name, email').eq('id', opp.primary_contact_id).maybeSingle() : { data: null };
    const customer = prospect?.display_name ?? '';
    const { data, error } = await admin.from('sales_contracts').insert({
      opportunity_id: id, estimate_id: est.id, number: documentNumber('CTR'), title: est.title, currency: est.currency, amount: est.total,
      terms: defaultContractTerms({ customer, title: est.title, estimateNumber: est.number, amount: Number(est.total), currency: est.currency }),
      customer_name: customer || null, signer_name: contact?.name ?? null, signer_email: contact?.email ?? prospect?.main_email ?? null,
      created_by: user.id,
    }).select(CONTRACT_COLS).single();
    if (error) return dbFail('create the contract', error);
    await logAudit({ actorId: user.id, action: 'sales_contract.created', resource: `sales_contract:${data.id}`, newValue: { opportunity: id, estimate: est.number } });
    return NextResponse.json({ contract: data }, { status: 201 });
  }

  const parsed = parseEstimate(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data: last } = await admin.from('sales_estimates').select('version').eq('opportunity_id', id).order('version', { ascending: false }).limit(1);
  const version = ((last?.[0]?.version as number | undefined) ?? 0) + 1;
  const { data, error } = await admin.from('sales_estimates')
    .insert({ ...withTotals(parsed.value), opportunity_id: id, number: documentNumber('EST'), version, created_by: user.id })
    .select(ESTIMATE_COLS).single();
  if (error) return dbFail('create the estimate', error);
  await logAudit({ actorId: user.id, action: 'sales_estimate.created', resource: `sales_estimate:${data.id}`, newValue: { opportunity: id, total: data.total } });
  return NextResponse.json({ estimate: data }, { status: 201 });
}
