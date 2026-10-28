import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';
import { formatMoney, parseEstimate } from '@/lib/sales/documents';
import { contractContentHash, documentNumber } from '@/lib/sales/documentTokens';
import { COLS, dbFail, issueLink, TABLE, withTotals, type DocKind } from '@/lib/sales/documentsServer';
import { EmailError, sendDirectEmail } from '@/lib/email/sender';
import { isEmail } from '@/lib/email/compose';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

type Params = { params: Promise<{ kind: string; docId: string }> };

async function load(admin: any, kind: DocKind, id: string, userId: string, role: string, mode: 'read' | 'write' = 'write') {
  const { data: doc, error } = await admin.from(TABLE[kind]).select(COLS[kind]).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return { doc: null, deny: dbFail('load the document', error) };
  if (!doc) return { doc: null, deny: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const denied = await assertOpportunityAccess(admin, doc.opportunity_id, userId, role, mode);
  return denied ? { doc: null, deny: denied } : { doc, deny: null };
}

const kindOf = (k: string): DocKind | null => (k === 'estimate' || k === 'contract' ? k : null);

// Edit a draft. Once it's sent, the customer may already be reading it — revise instead.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { kind: k, docId } = await params;
  const kind = kindOf(k);
  if (!kind) return NextResponse.json({ error: 'Unknown document' }, { status: 404 });
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const { doc, deny: no } = await load(admin, kind, docId, user.id, role);
  if (no) return no;
  if (doc.status !== 'draft') return NextResponse.json({ error: 'Only a draft can be edited — make a new version instead.' }, { status: 409 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  let patch: Record<string, unknown>;
  if (kind === 'estimate') {
    const parsed = parseEstimate(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    patch = { ...withTotals(parsed.value) };
  } else {
    const terms = typeof body.terms === 'string' ? body.terms.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || !terms) return NextResponse.json({ error: 'The contract needs a title and its text' }, { status: 400 });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Enter the contract amount' }, { status: 400 });
    const email = typeof body.signer_email === 'string' ? body.signer_email.trim().toLowerCase() : '';
    if (email && !isEmail(email)) return NextResponse.json({ error: 'The signer’s email isn’t valid' }, { status: 400 });
    patch = {
      title: title.slice(0, 200), terms: terms.slice(0, 50_000), amount: Math.round(amount * 100) / 100,
      customer_name: typeof body.customer_name === 'string' ? body.customer_name.trim().slice(0, 200) || null : doc.customer_name,
      signer_name: typeof body.signer_name === 'string' ? body.signer_name.trim().slice(0, 200) || null : doc.signer_name,
      signer_email: email || null,
    };
  }
  const { data, error } = await admin.from(TABLE[kind]).update(patch).eq('id', docId).eq('status', 'draft').select(COLS[kind]).single();
  if (error) return dbFail('save', error);
  return NextResponse.json({ [kind]: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { kind: k, docId } = await params;
  const kind = kindOf(k);
  if (!kind) return NextResponse.json({ error: 'Unknown document' }, { status: 404 });
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const { doc, deny: no } = await load(admin, kind, docId, user.id, role);
  if (no) return no;
  if (doc.status !== 'draft') return NextResponse.json({ error: 'A sent document stays on record — cancel it instead.' }, { status: 409 });
  const { error } = await admin.from(TABLE[kind]).update({ deleted_at: new Date().toISOString() }).eq('id', docId);
  if (error) return dbFail('delete', error);
  await logAudit({ actorId: user.id, action: `sales_${kind}.deleted`, resource: `sales_${kind}:${docId}`, newValue: { number: doc.number } });
  return NextResponse.json({ ok: true });
}

// { action: 'send', email?: { to, message } } · 'revise' (estimate → new draft version) ·
// 'cancel' (contract, or an estimate that's no longer valid) · 'mark_accepted' | 'mark_rejected'
// (the customer answered by phone/email instead of on the page).
export async function POST(req: NextRequest, { params }: Params) {
  const { kind: k, docId } = await params;
  const kind = kindOf(k);
  if (!kind) return NextResponse.json({ error: 'Unknown document' }, { status: 404 });
  const { user, role, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;
  const { doc, deny: no } = await load(admin, kind, docId, user.id, role);
  if (no) return no;
  const body = await req.json().catch(() => ({})) as { action?: string; email?: { to?: string; message?: string } };

  try {
    if (body.action === 'send') {
      if (!['draft', 'sent'].includes(doc.status)) return NextResponse.json({ error: `This ${kind} is already ${doc.status}.` }, { status: 409 });
      if (kind === 'estimate' && !doc.line_items?.length) return NextResponse.json({ error: 'Add at least one line before sending' }, { status: 400 });
      const extra = kind === 'contract' ? { content_hash: contractContentHash(doc) } : {};
      const url = await issueLink(admin, kind, docId, extra);
      if (kind === 'estimate') {
        // Only one live estimate per opportunity: older sent ones are replaced by this one.
        await admin.from('sales_estimates').update({ status: 'superseded' }).eq('opportunity_id', doc.opportunity_id).eq('status', 'sent').neq('id', docId);
      }
      await logAudit({ actorId: user.id, action: `sales_${kind}.sent`, resource: `sales_${kind}:${docId}`, newValue: { number: doc.number } });

      // Optional: email the link from the salesperson's own mailbox, right now (one email, not automated).
      let emailed: string | null = null, emailError: string | null = null;
      if (body.email?.to) {
        const { data: opp } = await admin.from('opportunities').select('prospect_id').eq('id', doc.opportunity_id).maybeSingle();
        if (!opp?.prospect_id) emailError = 'This deal has no Contact to email — copy the link instead.';
        else {
          const amount = formatMoney(Number(kind === 'estimate' ? doc.total : doc.amount), doc.currency);
          const what = kind === 'estimate' ? `our estimate ${doc.number}` : `the contract ${doc.number}`;
          try {
            await sendDirectEmail(admin, user.id, {
              prospectId: opp.prospect_id, to: body.email.to,
              subject: kind === 'estimate' ? `Estimate ${doc.number} — ${doc.title}` : `Contract ${doc.number} — ${doc.title} — please review and sign`,
              body: `${body.email.message?.trim() || `Hello,\n\nPlease find ${what} for “${doc.title}” (${amount}).`}\n\n${kind === 'estimate' ? 'View and accept it here' : 'Review and sign it here'}: ${url}`,
            });
            emailed = body.email.to;
          } catch (e) {
            emailError = e instanceof EmailError ? e.message : 'The email could not be sent — copy the link instead.';
          }
        }
      }
      return NextResponse.json({ ok: true, url, emailed, emailError });
    }

    if (body.action === 'revise' && kind === 'estimate') {
      const { data: last } = await admin.from('sales_estimates').select('version').eq('opportunity_id', doc.opportunity_id).order('version', { ascending: false }).limit(1);
      const { data, error } = await admin.from('sales_estimates').insert({
        opportunity_id: doc.opportunity_id, number: documentNumber('EST'), version: (last?.[0]?.version ?? doc.version) + 1,
        title: doc.title, currency: doc.currency, line_items: doc.line_items, discount_pct: doc.discount_pct, tax_pct: doc.tax_pct,
        subtotal: doc.subtotal, total: doc.total, notes: doc.notes, valid_until: doc.valid_until, created_by: user.id,
      }).select(COLS.estimate).single();
      if (error) return dbFail('make a new version', error);
      return NextResponse.json({ estimate: data }, { status: 201 });
    }

    if (body.action === 'cancel') {
      const allowed = kind === 'contract' ? ['draft', 'sent'] : ['sent'];
      if (!allowed.includes(doc.status)) return NextResponse.json({ error: `A ${doc.status} ${kind} can’t be cancelled.` }, { status: 409 });
      const { error } = await admin.from(TABLE[kind]).update({ status: kind === 'contract' ? 'cancelled' : 'expired', token_hash: null }).eq('id', docId);
      if (error) return dbFail('cancel', error);
      await logAudit({ actorId: user.id, action: `sales_${kind}.cancelled`, resource: `sales_${kind}:${docId}` });
      return NextResponse.json({ ok: true });
    }

    if ((body.action === 'mark_accepted' || body.action === 'mark_rejected') && kind === 'estimate') {
      if (doc.status !== 'sent') return NextResponse.json({ error: 'Send the estimate first' }, { status: 409 });
      const { error } = await admin.from('sales_estimates').update({
        status: body.action === 'mark_accepted' ? 'accepted' : 'rejected', decided_at: new Date().toISOString(),
        decided_by_name: 'Recorded by sales', decision_note: typeof (body as { note?: string }).note === 'string' ? (body as { note?: string }).note : null,
      }).eq('id', docId).eq('status', 'sent');
      if (error) return dbFail('save the answer', error);
      await logAudit({ actorId: user.id, action: `sales_estimate.${body.action}`, resource: `sales_estimate:${docId}` });
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error('[sales docs]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
