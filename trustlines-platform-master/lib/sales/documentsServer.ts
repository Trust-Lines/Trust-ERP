import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/lib/env/appUrl';
import { logLeadActivity } from '@/lib/sales/activity';
import { notifyUser } from '@/lib/sales/notify';
import { estimateTotals, formatMoney, type LineItem } from '@/lib/sales/documents';
import { contractContentHash, hashToken, isPublicToken, newPublicToken } from '@/lib/sales/documentTokens';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Server side of estimates and contracts: loading, sending (secure link), and what happens when
// the customer accepts, rejects or signs on the public page.

export const ESTIMATE_COLS = 'id, opportunity_id, number, version, title, currency, line_items, discount_pct, tax_pct, subtotal, total, notes, valid_until, status, sent_at, viewed_at, decided_at, decided_by_name, decision_note, created_by, created_at, updated_at';
export const CONTRACT_COLS = 'id, opportunity_id, estimate_id, number, title, currency, amount, terms, customer_name, signer_name, signer_email, status, sent_at, viewed_at, signed_at, signed_name, signed_title, signed_ip, declined_reason, created_by, created_at, updated_at';

export type DocKind = 'estimate' | 'contract';
export const TABLE: Record<DocKind, string> = { estimate: 'sales_estimates', contract: 'sales_contracts' };
export const COLS: Record<DocKind, string> = { estimate: ESTIMATE_COLS, contract: CONTRACT_COLS };
export const PUBLIC_PATH: Record<DocKind, string> = { estimate: 'quote', contract: 'contract' };

export const notReady = (e: { message: string; code?: string }) => e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message);

export function dbFail(where: string, e: { message: string; code?: string }) {
  console.error(`[sales docs] ${where}:`, e.message);
  if (notReady(e)) return NextResponse.json({ error: 'Estimates & contracts aren’t set up yet (migration 131).' }, { status: 503 });
  if (e.code === '23505') return NextResponse.json({ error: 'Please try again' }, { status: 409 });
  return NextResponse.json({ error: `Could not ${where}` }, { status: 500 });
}

/** Recomputed on the server every time — the totals the customer sees never come from the browser. */
export function withTotals<T extends { line_items: LineItem[]; discount_pct: number; tax_pct: number }>(e: T) {
  const t = estimateTotals(e.line_items, e.discount_pct, e.tax_pct);
  return { ...e, subtotal: t.subtotal, total: t.total };
}

/** Creates a fresh secure link (the previous one stops working) and returns its address once. */
export async function issueLink(admin: any, kind: DocKind, id: string, extra: Record<string, unknown>) {
  const token = newPublicToken();
  const { error } = await admin.from(TABLE[kind]).update({ token_hash: hashToken(token), sent_at: new Date().toISOString(), status: 'sent', ...extra }).eq('id', id);
  if (error) throw new Error(error.message);
  return `${appBaseUrl()}/${PUBLIC_PATH[kind]}/${token}`;
}

/** The opportunity context the public page shows (company name, who's handling it). */
async function oppContext(admin: any, opportunityId: string) {
  const { data: opp } = await admin.from('opportunities').select('id, title, prospect_id, sales_owner_id, customer_id').eq('id', opportunityId).maybeSingle();
  let company: string | null = null;
  if (opp?.prospect_id) {
    const { data: p } = await admin.from('prospects').select('display_name').eq('id', opp.prospect_id).maybeSingle();
    company = p?.display_name ?? null;
  }
  let owner: { full_name: string | null; email: string | null } | null = null;
  if (opp?.sales_owner_id) {
    const { data: o } = await admin.from('profiles').select('full_name, email').eq('id', opp.sales_owner_id).maybeSingle();
    owner = o ?? null;
  }
  return { opp, company, owner };
}

/** Public: the document behind a link, or null. Marks it viewed the first time. */
export async function loadPublic(admin: any, kind: DocKind, token: string) {
  if (!isPublicToken(token)) return null;
  const { data: doc } = await admin.from(TABLE[kind]).select(`${COLS[kind]}, token_hash`).eq('token_hash', hashToken(token)).is('deleted_at', null).maybeSingle();
  if (!doc || !['sent', 'accepted', 'rejected', 'signed', 'declined', 'expired'].includes(doc.status)) return null;
  if (!doc.viewed_at) await admin.from(TABLE[kind]).update({ viewed_at: new Date().toISOString() }).eq('id', doc.id);
  const ctx = await oppContext(admin, doc.opportunity_id);
  let expired = false;
  if (kind === 'estimate' && doc.status === 'sent' && doc.valid_until && doc.valid_until < new Date().toISOString().slice(0, 10)) expired = true;
  // Never on the public page: the link hash, who created it, the signer's IP.
  const { token_hash: _omit, created_by: _c, signed_ip: _ip, ...safe } = doc;
  void _omit; void _c; void _ip;
  return { doc: safe, company: ctx.company, owner: ctx.owner, expired, opp: ctx.opp };
}

async function tellOwner(admin: any, opp: { id: string; sales_owner_id: string | null } | null, title: string, body: string) {
  if (!opp) return;
  await logLeadActivity(admin, { opportunityId: opp.id, actorId: null, kind: 'change', body: `${title} — ${body}` });
  if (opp.sales_owner_id) await notifyUser(admin, { userId: opp.sales_owner_id, title, body, opportunityId: opp.id });
}

export class PublicActionError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Customer accepts or rejects an estimate. */
export async function decideEstimate(admin: any, token: string, decision: 'accepted' | 'rejected', name: string, note: string | null) {
  const p = await loadPublic(admin, 'estimate', token);
  if (!p) throw new PublicActionError('This link isn’t valid any more', 404);
  if (p.doc.status !== 'sent') throw new PublicActionError(`This estimate was already ${p.doc.status}.`, 409);
  if (p.expired) throw new PublicActionError('This estimate has expired — please ask us for an updated one.', 410);
  const { data, error } = await admin.from('sales_estimates').update({
    status: decision, decided_at: new Date().toISOString(), decided_by_name: name, decision_note: note,
  }).eq('id', p.doc.id).eq('status', 'sent').select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PublicActionError('This estimate was already answered.', 409);
  await tellOwner(admin, p.opp, decision === 'accepted' ? `Estimate ${p.doc.number} accepted` : `Estimate ${p.doc.number} rejected`,
    `${name}${p.company ? ` (${p.company})` : ''} ${decision} “${p.doc.title}” — ${formatMoney(Number(p.doc.total), p.doc.currency)}${note ? `. Note: ${note}` : ''}`);
}

/** Customer signs (or declines) a contract. The signed text must be exactly what was sent. */
export async function signContract(admin: any, token: string, s: { name: string; title: string | null; ip: string | null; userAgent: string | null }) {
  const p = await loadPublic(admin, 'contract', token);
  if (!p) throw new PublicActionError('This link isn’t valid any more', 404);
  if (p.doc.status !== 'sent') throw new PublicActionError(`This contract is already ${p.doc.status}.`, 409);
  const { data: stored } = await admin.from('sales_contracts').select('content_hash').eq('id', p.doc.id).maybeSingle();
  if (!stored?.content_hash || stored.content_hash !== contractContentHash(p.doc)) {
    throw new PublicActionError('This contract changed after it was sent — please ask us for the current version.', 409);
  }
  const { data, error } = await admin.from('sales_contracts').update({
    status: 'signed', signed_at: new Date().toISOString(), signed_name: s.name, signed_title: s.title,
    signed_ip: s.ip?.slice(0, 64) ?? null, signed_user_agent: s.userAgent?.slice(0, 300) ?? null,
  }).eq('id', p.doc.id).eq('status', 'sent').select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PublicActionError('This contract was already answered.', 409);
  await tellOwner(admin, p.opp, `Contract ${p.doc.number} signed`,
    `${s.name}${s.title ? `, ${s.title}` : ''}${p.company ? ` (${p.company})` : ''} signed “${p.doc.title}” — ${formatMoney(Number(p.doc.amount), p.doc.currency)}. Close the deal as Won when ready.`);
  if (p.opp) await admin.from('opportunities').update({ next_action: 'Contract signed — Close Won', next_action_date: new Date().toISOString().slice(0, 10) }).eq('id', p.opp.id);
}

export async function declineContract(admin: any, token: string, reason: string) {
  const p = await loadPublic(admin, 'contract', token);
  if (!p) throw new PublicActionError('This link isn’t valid any more', 404);
  if (p.doc.status !== 'sent') throw new PublicActionError(`This contract is already ${p.doc.status}.`, 409);
  await admin.from('sales_contracts').update({ status: 'declined', declined_reason: reason }).eq('id', p.doc.id).eq('status', 'sent');
  await tellOwner(admin, p.opp, `Contract ${p.doc.number} declined`, `${p.company ?? 'The customer'} declined “${p.doc.title}”. Reason: ${reason}`);
}
