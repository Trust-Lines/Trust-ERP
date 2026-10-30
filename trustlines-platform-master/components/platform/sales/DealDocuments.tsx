'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, FilePlus2, FileSignature, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { CURRENCIES, estimateTotals, formatMoney, lineTotal, type LineItem } from '@/lib/sales/documents';

// Deal panel → "Estimate & Contract": the two Sales steps between Design and Closed Deal.
// Draft an estimate → send the customer a secure link → they accept it → draft the contract
// from it → send → they sign it online. Every step is also visible to the salesperson here.

interface Estimate {
  id: string; number: string; version: number; title: string; currency: string; line_items: LineItem[];
  discount_pct: number; tax_pct: number; subtotal: number; total: number; notes: string | null; valid_until: string | null;
  status: string; sent_at: string | null; viewed_at: string | null; decided_at: string | null; decided_by_name: string | null; decision_note: string | null;
}
interface Contract {
  id: string; estimate_id: string | null; number: string; title: string; currency: string; amount: number; terms: string;
  customer_name: string | null; signer_name: string | null; signer_email: string | null; status: string;
  sent_at: string | null; viewed_at: string | null; signed_at: string | null; signed_name: string | null; signed_title: string | null; declined_reason: string | null;
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const when = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : null);
const field = 'flex flex-col gap-1 text-[12px] font-medium text-ui-body';

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Something went wrong');
  return b as T;
}

export function DealDocuments({ opportunityId, dealTitle, defaultCurrency, canEdit = true }: {
  opportunityId: string; dealTitle: string; defaultCurrency?: string | null; canEdit?: boolean;
}) {
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notReady, setNotReady] = useState(false);
  const [hidden, setHidden] = useState(false); // not a Sales role: the card isn't theirs
  const [editEstimate, setEditEstimate] = useState<Estimate | 'new' | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [sending, setSending] = useState<{ kind: 'estimate' | 'contract'; doc: Estimate | Contract } | null>(null);
  const [link, setLink] = useState<{ url: string; label: string } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; label: string; run: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/opportunities/${opportunityId}/documents`);
    if (res.status === 401 || res.status === 403) { setHidden(true); return; }
    const b = await res.json().catch(() => ({})) as { estimates?: Estimate[]; contracts?: Contract[]; notReady?: boolean; contactEmail?: string | null; error?: string };
    if (!res.ok) { toast.error(b.error ?? 'Could not load estimates'); setEstimates([]); return; }
    setNotReady(!!b.notReady); setEstimates(b.estimates ?? []); setContracts(b.contracts ?? []); setContactEmail(b.contactEmail ?? null);
  }, [opportunityId]);
  useEffect(() => { load(); }, [load]);

  const act = (kind: 'estimate' | 'contract', id: string, action: string, ok: string) => async () => {
    try { await call(`/api/sales/documents/${kind}/${id}`, 'POST', { action }); toast.success(ok); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); throw e; }
  };
  const remove = (kind: 'estimate' | 'contract', id: string) => async () => {
    try { await call(`/api/sales/documents/${kind}/${id}`, 'DELETE'); toast.success('Draft deleted'); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); throw e; }
  };
  async function draftContract(est: Estimate) {
    try {
      const b = await call<{ contract: Contract }>(`/api/sales/opportunities/${opportunityId}/documents`, 'POST', { type: 'contract', estimateId: est.id });
      await load(); setEditContract(b.contract);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  }

  if (hidden) return <p className="m-0 text-[12px] text-ui-text-secondary">Estimates and contracts are handled by Sales.</p>;
  if (notReady) return <p className="m-0 text-[12px] text-ui-text-secondary">Estimates & contracts need migration 131 to be applied.</p>;
  if (estimates === null) return <p className="m-0 text-[12px] text-ui-text-secondary">Loading…</p>;
  const signed = contracts.find(c => c.status === 'signed');

  return (
    <div className="flex flex-col gap-4">
      {signed && (
        <div role="status" className="rounded-[6px] bg-success-light px-3 py-2 text-[12px] text-success-dark">
          Contract {signed.number} signed by {signed.signed_name}{signed.signed_at ? ` on ${when(signed.signed_at)}` : ''} — you can close the deal as Won.
        </div>
      )}

      {/* Estimates */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ui-text-secondary">Estimates</span>
          {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditEstimate('new')}><Plus /> New estimate</Button>}
        </div>
        {estimates.length === 0 ? <p className="m-0 text-[12px] text-ui-text-secondary">No estimate yet — price the design for the customer.</p> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {estimates.map(e => (
              <li key={e.id} className="rounded-[8px] border border-ui-divider p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ui-heading">{e.number}</span>
                  <span className="text-[11px] text-ui-text-secondary">v{e.version}</span>
                  <StatusBadge group="sales_estimate" status={e.status} size="sm" />
                  <span className="ml-auto text-[13px] font-semibold tabular-nums">{formatMoney(Number(e.total), e.currency)}</span>
                </div>
                <div className="mt-1 text-[12px] text-ui-text-secondary">
                  {e.title}
                  {e.sent_at && ` · sent ${when(e.sent_at)}`}{e.viewed_at && ' · viewed'}
                  {e.decided_at && ` · ${e.status} ${when(e.decided_at)}${e.decided_by_name ? ` by ${e.decided_by_name}` : ''}`}
                  {e.valid_until && e.status === 'sent' && ` · valid until ${DAY.format(new Date(`${e.valid_until}T00:00:00`))}`}
                </div>
                {e.decision_note && <div className="mt-1 text-[12px] italic text-ui-body">“{e.decision_note}”</div>}
                {canEdit && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.status === 'draft' && <>
                      <Button size="xs" variant="secondary" onClick={() => setEditEstimate(e)}><Pencil /> Edit</Button>
                      <Button size="xs" onClick={() => setSending({ kind: 'estimate', doc: e })}><Send /> Send</Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirm({ title: `Delete draft ${e.number}?`, label: 'Delete', run: remove('estimate', e.id) })}><Trash2 /></Button>
                    </>}
                    {e.status === 'sent' && <>
                      <Button size="xs" variant="secondary" onClick={() => setSending({ kind: 'estimate', doc: e })}><Send /> Resend / new link</Button>
                      <Button size="xs" variant="secondary" onClick={() => setConfirm({ title: 'Record that the customer accepted?', label: 'Mark accepted', run: act('estimate', e.id, 'mark_accepted', 'Marked accepted') })}>Mark accepted</Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirm({ title: 'Record that the customer rejected it?', label: 'Mark rejected', run: act('estimate', e.id, 'mark_rejected', 'Marked rejected') })}>Mark rejected</Button>
                    </>}
                    {['sent', 'rejected', 'expired', 'accepted', 'superseded'].includes(e.status) && (
                      <Button size="xs" variant="ghost" onClick={() => act('estimate', e.id, 'revise', 'New draft version created')().catch(() => {})}><FilePlus2 /> New version</Button>
                    )}
                    {e.status === 'accepted' && !contracts.some(c => c.estimate_id === e.id && c.status !== 'cancelled') && (
                      <Button size="xs" onClick={() => draftContract(e)}><FileSignature /> Draft contract</Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Contracts */}
      {contracts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ui-text-secondary">Contracts</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {contracts.map(c => (
              <li key={c.id} className="rounded-[8px] border border-ui-divider p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ui-heading">{c.number}</span>
                  <StatusBadge group="sales_contract" status={c.status} size="sm" />
                  <span className="ml-auto text-[13px] font-semibold tabular-nums">{formatMoney(Number(c.amount), c.currency)}</span>
                </div>
                <div className="mt-1 text-[12px] text-ui-text-secondary">
                  {c.title}{c.signer_name ? ` · signer ${c.signer_name}` : ''}
                  {c.sent_at && ` · sent ${when(c.sent_at)}`}{c.viewed_at && ' · viewed'}
                  {c.signed_at && ` · signed ${when(c.signed_at)} by ${c.signed_name}${c.signed_title ? `, ${c.signed_title}` : ''}`}
                </div>
                {c.declined_reason && <div className="mt-1 text-[12px] italic text-error-dark">Declined: “{c.declined_reason}”</div>}
                {canEdit && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.status === 'draft' && <>
                      <Button size="xs" variant="secondary" onClick={() => setEditContract(c)}><Pencil /> Edit</Button>
                      <Button size="xs" onClick={() => setSending({ kind: 'contract', doc: c })}><Send /> Send for signature</Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirm({ title: `Delete draft ${c.number}?`, label: 'Delete', run: remove('contract', c.id) })}><Trash2 /></Button>
                    </>}
                    {c.status === 'sent' && <>
                      <Button size="xs" variant="secondary" onClick={() => setSending({ kind: 'contract', doc: c })}><Send /> Resend / new link</Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirm({ title: `Cancel ${c.number}?`, label: 'Cancel contract', run: act('contract', c.id, 'cancel', 'Contract cancelled — the link no longer works') })}><X /> Cancel</Button>
                    </>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editEstimate && (
        <EstimateEditor opportunityId={opportunityId} estimate={editEstimate === 'new' ? null : editEstimate}
          defaults={{ title: dealTitle, currency: defaultCurrency && (CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : 'USD' }}
          onClose={() => setEditEstimate(null)} onSaved={() => { setEditEstimate(null); load(); }} />
      )}
      {editContract && <ContractEditor contract={editContract} onClose={() => setEditContract(null)} onSaved={() => { setEditContract(null); load(); }} />}
      {sending && (
        <SendDialog kind={sending.kind} doc={sending.doc} defaultTo={(sending.kind === 'contract' ? (sending.doc as Contract).signer_email : null) ?? contactEmail ?? ''}
          onClose={() => setSending(null)}
          onSent={url => { setLink({ url, label: sending.doc.number }); setSending(null); load(); }} />
      )}
      <Modal open={!!link} onOpenChange={o => { if (!o) setLink(null); }}>
        {link && (
          <ModalContent title={`Link for ${link.label}`} description="Shown once — copy it now. Sending again makes a new link and the old one stops working.">
            <div className="flex gap-2">
              <Input readOnly value={link.url} onFocus={e => e.currentTarget.select()} aria-label="Customer link" />
              <Button onClick={() => { navigator.clipboard.writeText(link.url).then(() => toast.success('Copied')); }}><Copy /> Copy</Button>
            </div>
          </ModalContent>
        )}
      </Modal>
      <ConfirmModal open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }} title={confirm?.title ?? ''}
        confirmLabel={confirm?.label ?? 'Confirm'} onConfirm={async () => { await confirm?.run(); setConfirm(null); }} />
    </div>
  );
}

function EstimateEditor({ opportunityId, estimate, defaults, onClose, onSaved }: {
  opportunityId: string; estimate: Estimate | null; defaults: { title: string; currency: string }; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(estimate?.title ?? defaults.title);
  const [currency, setCurrency] = useState(estimate?.currency ?? defaults.currency);
  const [items, setItems] = useState<{ description: string; quantity: string; unit: string; unit_price: string }[]>(
    estimate?.line_items.length ? estimate.line_items.map(i => ({ description: i.description, quantity: String(i.quantity), unit: i.unit ?? '', unit_price: String(i.unit_price) }))
      : [{ description: '', quantity: '1', unit: '', unit_price: '' }],
  );
  const [discount, setDiscount] = useState(String(estimate?.discount_pct ?? 0));
  const [tax, setTax] = useState(String(estimate?.tax_pct ?? 0));
  const [notes, setNotes] = useState(estimate?.notes ?? '');
  const [validUntil, setValidUntil] = useState(estimate?.valid_until ?? '');
  const [saving, setSaving] = useState(false);

  const parsed: LineItem[] = items.map(i => ({ description: i.description, quantity: Number(i.quantity) || 0, unit: i.unit || null, unit_price: Number(i.unit_price) || 0 }));
  const totals = useMemo(() => estimateTotals(parsed, Number(discount) || 0, Number(tax) || 0), [parsed, discount, tax]);
  const setItem = (idx: number, patch: Partial<(typeof items)[number]>) => setItems(list => list.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  async function save() {
    setSaving(true);
    try {
      const body = { title, currency, line_items: items, discount_pct: discount, tax_pct: tax, notes, valid_until: validUntil };
      if (estimate) await call(`/api/sales/documents/estimate/${estimate.id}`, 'PATCH', body);
      else await call(`/api/sales/opportunities/${opportunityId}/documents`, 'POST', { type: 'estimate', ...body });
      toast.success('Estimate saved'); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); } finally { setSaving(false); }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="lg" title={estimate ? `Edit ${estimate.number}` : 'New estimate'} description="The customer sees these lines, the totals and the notes."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} onClick={save}>Save draft</Button></>}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_160px]">
            <label className={field}>Title<Input value={title} onChange={e => setTitle(e.target.value)} /></label>
            <div className={field}>Currency<Select aria-label="Currency" value={currency} options={CURRENCIES.map(c => ({ value: c, label: c }))} onValueChange={v => setCurrency(v ?? 'USD')} /></div>
            <label className={field}>Valid until<Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead><tr className="text-left text-ui-text-secondary"><th className="pb-1 font-medium">Item</th><th className="w-[70px] pb-1 font-medium">Qty</th><th className="w-[70px] pb-1 font-medium">Unit</th><th className="w-[110px] pb-1 font-medium">Unit price</th><th className="w-[100px] pb-1 text-right font-medium">Total</th><th className="w-[32px]" /></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-2"><Input value={it.description} placeholder="e.g. Millwork — checkout counter" onChange={e => setItem(idx, { description: e.target.value })} /></td>
                    <td className="py-1 pr-2"><Input type="number" min={0} step="any" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} /></td>
                    <td className="py-1 pr-2"><Input value={it.unit} placeholder="pcs" onChange={e => setItem(idx, { unit: e.target.value })} /></td>
                    <td className="py-1 pr-2"><Input type="number" min={0} step="any" value={it.unit_price} onChange={e => setItem(idx, { unit_price: e.target.value })} /></td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(lineTotal(parsed[idx]), currency)}</td>
                    <td className="py-1 pl-1"><Button size="icon-xs" variant="ghost" aria-label="Remove line" onClick={() => setItems(l => l.length > 1 ? l.filter((_, i) => i !== idx) : l)}><X /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button size="xs" variant="ghost" className="mt-1" onClick={() => setItems(l => [...l, { description: '', quantity: '1', unit: '', unit_price: '' }])}><Plus /> Add line</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
            <label className={field}>Notes for the customer<Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scope, exclusions, payment terms…" /></label>
            <div className="flex flex-col gap-2 rounded-[8px] bg-ui-hover-bg p-3 text-[12px]">
              <div className="grid grid-cols-2 gap-2">
                <label className={field}>Discount %<Input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(e.target.value)} /></label>
                <label className={field}>Tax %<Input type="number" min={0} max={100} value={tax} onChange={e => setTax(e.target.value)} /></label>
              </div>
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{formatMoney(totals.discount, currency)}</span></div>}
              {totals.tax > 0 && <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{formatMoney(totals.tax, currency)}</span></div>}
              <div className="flex justify-between border-t border-ui-divider pt-2 text-[14px] font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(totals.total, currency)}</span></div>
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function ContractEditor({ contract, onClose, onSaved }: { contract: Contract; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: contract.title, customer_name: contract.customer_name ?? '', signer_name: contract.signer_name ?? '',
    signer_email: contract.signer_email ?? '', amount: String(contract.amount), terms: contract.terms,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  async function save() {
    setSaving(true);
    try { await call(`/api/sales/documents/contract/${contract.id}`, 'PATCH', f); toast.success('Contract saved'); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); } finally { setSaving(false); }
  }
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="lg" title={`Contract ${contract.number}`} description="Edit the text before sending — once sent, the customer signs exactly this version."
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={saving} onClick={save}>Save draft</Button></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={field}>Title<Input value={f.title} onChange={set('title')} /></label>
            <label className={field}>Amount ({contract.currency})<Input type="number" min={0} step="any" value={f.amount} onChange={set('amount')} /></label>
            <label className={field}>Customer (company)<Input value={f.customer_name} onChange={set('customer_name')} /></label>
            <label className={field}>Signer name<Input value={f.signer_name} onChange={set('signer_name')} /></label>
            <label className={`${field} sm:col-span-2`}>Signer email<Input type="email" value={f.signer_email} onChange={set('signer_email')} /></label>
          </div>
          <label className={field}>Contract text<Textarea rows={16} className="font-mono text-[12px]" value={f.terms} onChange={set('terms')} /></label>
        </div>
      </ModalContent>
    </Modal>
  );
}

function SendDialog({ kind, doc, defaultTo, onClose, onSent }: {
  kind: 'estimate' | 'contract'; doc: Estimate | Contract; defaultTo: string; onClose: () => void; onSent: (url: string) => void;
}) {
  const [byEmail, setByEmail] = useState(!!defaultTo);
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const r = await call<{ url: string; emailed: string | null; emailError: string | null }>(`/api/sales/documents/${kind}/${doc.id}`, 'POST', {
        action: 'send', ...(byEmail && to ? { email: { to, message } } : {}),
      });
      if (r.emailed) toast.success(`Sent to ${r.emailed} from your mailbox`);
      else if (r.emailError) toast.warning(`Link created, but the email wasn’t sent: ${r.emailError}`, { duration: 10_000 });
      onSent(r.url);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(false); }
  }
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent title={`Send ${doc.number}`} description={kind === 'estimate' ? 'The customer opens a secure link to view and accept the estimate.' : 'The customer opens a secure link to read and sign the contract.'}
        footer={<><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button loading={busy} onClick={send}><Send /> {byEmail ? 'Send' : 'Create link'}</Button></>}>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-[12px] text-ui-body">
            <input type="checkbox" checked={byEmail} onChange={e => setByEmail(e.target.checked)} /> Email the link now from my mailbox
          </label>
          {byEmail && <>
            <label className={field}>To<Input type="email" value={to} onChange={e => setTo(e.target.value)} /></label>
            <label className={field}>Message (optional)<Textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hello, please find our estimate…" /></label>
          </>}
          {doc.status === 'sent' && <p className="m-0 text-[11px] text-warning-dark">Sending again makes a new link; the one sent before stops working.</p>}
        </div>
      </ModalContent>
    </Modal>
  );
}
