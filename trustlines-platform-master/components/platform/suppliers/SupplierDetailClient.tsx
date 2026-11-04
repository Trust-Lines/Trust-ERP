'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Factory, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier, SupplierInvoice, SupplierPayment } from '@/types/database';
import type { CurrencyTotals } from '@/lib/suppliers/config';
import { CURRENCIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/suppliers/config';
import { Select } from '@/components/platform/shared/Select';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { statusLabel } from '@/lib/status/tags';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { VendorWork } from '@/lib/suppliers/trustWork';

interface Props {
  supplier: Supplier;
  initialInvoices: SupplierInvoice[];
  initialPayments: SupplierPayment[];
  totals: CurrencyTotals;
  projects: { id: string; code: string; name: string }[];
  canEdit: boolean;
  /** Its work in the Trust System (lib/suppliers/trustWork); workError = why Trust couldn't be read. */
  work: VendorWork;
  workError: string | null;
}

// Figma "Supplier detail" (node 427:16507). Delete (soft T10) and Deactivate / Reactivate sit in
// the heading; the per-row edit pencils have no UI feature here, so invoices and payments keep
// add + delete. The Trust System work history (PR #70) sits under the profile.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'flex flex-col gap-5 rounded-[8px] border border-ui-divider px-5 pb-5 pt-4';
const CARD_TITLE = cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING);
const FIELD = 'h-10 w-full min-w-0 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const FORM_LABEL = 'flex min-w-0 flex-col gap-1 text-[12px] font-medium text-ui-body';
const ACCENT_BTN = 'gap-2 bg-ui-btn-accent pl-3.5 pr-6 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent';
const TONE_BTN = 'h-10 gap-2 border pl-3.5 pr-6 text-[13px] font-medium hover:opacity-85';
// Figma row delete: 32px, T10 fill + border.
const ROW_DELETE = 'size-8 rounded-[6px] border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)] hover:bg-[var(--status-t10-bg)] hover:opacity-85 dark:border-[var(--status-t10-fg)] dark:bg-[var(--status-t10-bg)]';
const AMOUNT = 'inline-flex items-center rounded-[4px] bg-[var(--status-t6-bg)] py-1 pl-2 pr-2.5 text-[16px] font-medium leading-4 tabular-nums text-[var(--status-t9-fg)]';
// Invoice settlement keeps its own colour in the row's meta line.
const INVOICE_STATUS_TONE: Record<string, string> = { unpaid: 't10', partial: 't7', paid: 't9' };

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "2026-10-26" → "26/10/2026" (the design's day-first date), no timezone shift. */
const dayFirst = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : iso;
};

export function SupplierDetailClient({ supplier, initialInvoices, initialPayments, totals, projects, canEdit, work, workError }: Props) {
  const router = useRouter();
  const projById = new Map(projects.map(p => [p.id, p]));
  const activeCurrencies = CURRENCIES.filter(c => totals[c].invoiced !== 0 || totals[c].paid !== 0);
  const [toggling, setToggling] = useState(false);
  const [confirming, setConfirming] = useState<'deactivate' | 'delete' | null>(null);

  // Reactivating needs no question; deactivating asks in the confirm popup first.
  function toggleActive() {
    if (supplier.is_active) setConfirming('deactivate');
    else void setActive(true);
  }

  // Soft toggle only (is_active) — invoices, payments and history are kept.
  // Called from the confirm popup too; throwing keeps the popup open so the user can retry.
  async function setActive(activate: boolean) {
    setToggling(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: activate }),
    });
    const body = await res.json().catch(() => ({}));
    setToggling(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to update supplier'); throw new Error('update failed'); }
    toast.success(activate ? 'Supplier reactivated' : 'Supplier deactivated'); router.refresh();
  }

  // Deleted when nothing points at it; otherwise the API sets it inactive and says what's linked.
  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function remove() {
    setToggling(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setToggling(false);
    if (!res.ok) { toast.error(body.error ?? 'Could not delete the supplier'); throw new Error('delete failed'); }
    if (body.deleted) { toast.success(`${supplier.name} deleted`); router.push('/suppliers'); router.refresh(); return; }
    toast.info(`Set inactive instead — linked to ${(body.linked ?? []).join(', ')}`); router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/suppliers" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit no-underline' })}>
        <ArrowLeft /> All suppliers
      </Link>

      {/* ── Page heading ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{supplier.name}</h1>
          <div className="flex items-center gap-[5px] text-[13px] leading-[1.35] text-ui-body">
            <span>{supplier.code ?? '—'}</span><span>·</span><span>{supplier.country}</span>
            <StatusBadge
              group="record_state" status={supplier.is_active ? 'active' : 'inactive'} showIcon={false}
              className="ml-1 h-5 rounded-[4px] border border-current px-2 text-[12px] uppercase leading-4"
            />
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="secondary" className="gap-2 text-[13px] font-medium" onClick={toggleActive} disabled={toggling}>
              <Power className="size-4" /> {supplier.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
            {/* Figma Delete: soft T10 fill. */}
            <Button
              onClick={() => setConfirming('delete')} disabled={toggling}
              className={cn(TONE_BTN, 'border-[var(--status-t10-bg)] bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)] hover:bg-[var(--status-t10-bg)] dark:border-[var(--status-t10-bg)] dark:bg-[var(--status-t10-bg)] dark:text-[var(--status-t10-fg)]')}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* ── Balances + profile ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <section className={cn(CARD, 'w-full shrink-0 bg-ui-surface lg:w-[325px]')}>
          <div className="flex flex-col gap-4">
            <h2 className={CARD_TITLE}>Invoices/Payments</h2>
            <div className="h-px w-full bg-ui-divider" />
          </div>
          {activeCurrencies.length === 0 ? (
            <p className={cn('m-0 my-auto py-10 text-center text-[16px] font-medium leading-[1.35]', HEADING)}>No invoices or payments yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {activeCurrencies.map(c => {
                const t = totals[c];
                return (
                  <div key={c} className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium leading-4 text-ui-body">Balance ({c})</span>
                    <span
                      className="text-[22px] font-semibold tabular-nums"
                      style={{ color: t.balance > 0.005 ? 'var(--status-t7-fg)' : 'var(--status-t9-fg)' }}
                    >
                      {fmt(t.balance)}
                    </span>
                    <div className="flex justify-between text-[12px] text-ui-text-secondary">
                      <span>Invoiced {fmt(t.invoiced)}</span>
                      <span>Paid {fmt(t.paid)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <ProfileCard supplier={supplier} canEdit={canEdit} onSaved={() => router.refresh()} />
      </div>

      <WorkSection work={work} error={workError} />

      {/* ── Invoices + payments ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <InvoicesSection
          supplierId={supplier.id} invoices={initialInvoices} projById={projById}
          canEdit={canEdit} onChange={() => router.refresh()}
        />
        <PaymentsSection
          supplierId={supplier.id} payments={initialPayments} invoices={initialInvoices}
          projById={projById} canEdit={canEdit} onChange={() => router.refresh()}
        />
      </div>

      <ConfirmModal
        open={confirming === 'deactivate'} onOpenChange={o => { if (!o) setConfirming(null); }}
        title={`Deactivate ${supplier.name}?`}
        description="It will no longer be offered as a vendor. Invoices, payments and history are kept, and you can reactivate it any time."
        confirmLabel="Deactivate"
        onConfirm={() => setActive(false)}
      />
      <ConfirmModal
        open={confirming === 'delete'} onOpenChange={o => { if (!o) setConfirming(null); }} tone="destructive"
        title={`Delete ${supplier.name}?`}
        description="If invoices, payments or production items point at it, it is set inactive instead so they keep their supplier."
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h2 className={CARD_TITLE}>{title}</h2>
        {action}
      </div>
      <div className="h-px w-full bg-ui-divider" />
    </div>
  );
}

function ProfileCard({ supplier, canEdit, onSaved }: { supplier: Supplier; canEdit: boolean; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: supplier.name ?? '', country: supplier.country ?? '',
    email: supplier.email ?? '', phone: supplier.phone ?? '', address: supplier.address ?? '',
    tax_office: supplier.tax_office ?? '', tax_number: supplier.tax_number ?? '',
    payment_terms: supplier.payment_terms ?? '', notes: supplier.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to save'); return; }
    toast.success('Supplier updated'); setEdit(false); onSaved();
  }

  const Row = ({ label, value }: { label: string; value: string | null }) => (
    <div className="flex flex-col">
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      <span className={cn('whitespace-pre-wrap break-words text-[14px] font-medium leading-[1.5]', HEADING)}>{value || '-'}</span>
    </div>
  );

  return (
    <section className={cn(CARD, 'min-w-0 flex-1 bg-ui-page-bg')}>
      <CardHeader
        title="Profile"
        action={canEdit && !edit && (
          <Button size="md" className="gap-2 pl-[34px] pr-11 text-[13px] font-medium" onClick={() => setEdit(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      />
      {!edit ? (
        <div className="flex flex-col gap-4">
          <Row label="Email" value={supplier.email} />
          <Row label="Phone" value={supplier.phone} />
          <Row label="Address" value={supplier.address} />
          <Row label="Tax Office" value={supplier.tax_office} />
          <Row label="Tax #" value={supplier.tax_number} />
          <Row label="Payment terms" value={supplier.payment_terms} />
          <Row label="Notes" value={supplier.notes} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {([['name', 'Name'], ['country', 'Country'], ['email', 'Email'], ['phone', 'Phone'], ['tax_office', 'Tax office'], ['tax_number', 'Tax number'], ['payment_terms', 'Payment terms']] as const).map(([k, label]) => (
            <label key={k} className={FORM_LABEL}>
              {label}
              <input className={FIELD} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
          <label className={cn(FORM_LABEL, 'md:col-span-2')}>
            Address
            <input className={FIELD} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
          </label>
          <label className={cn(FORM_LABEL, 'md:col-span-2')}>
            Notes
            <textarea className={cn(FIELD, 'h-auto min-h-[72px] resize-y py-2')} rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <Button size="md" onClick={save} loading={saving}>Save</Button>
            <Button size="md" variant="secondary" onClick={() => setEdit(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** One invoice / payment line: title + amount chip, meta line, delete. */
function LedgerRow({ title, titleClass, amount, meta, onDelete, deleteLabel }: {
  title: React.ReactNode; titleClass: string; amount: string; meta: React.ReactNode; onDelete?: () => void; deleteLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-ui-divider px-1 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('truncate leading-[1.4]', titleClass)}>{title}</span>
          <span className={AMOUNT}>{amount}</span>
        </div>
        <p className="m-0 truncate text-[11px] leading-[1.4] text-ui-text-secondary">{meta}</p>
      </div>
      {onDelete && (
        <Button variant="ghost" size="icon" className={ROW_DELETE} onClick={onDelete} title={deleteLabel} aria-label={deleteLabel}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

function InvoicesSection({ supplierId, invoices, projById, canEdit, onChange }: {
  supplierId: string; invoices: SupplierInvoice[]; projById: Map<string, { code: string; name: string }>;
  canEdit: boolean; onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ invoice_number: '', invoice_date: '', currency: 'USD', amount: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<SupplierInvoice | null>(null);

  async function add() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplierId}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, amount: Number(f.amount) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Invoice added'); setAdding(false);
    setF({ invoice_number: '', invoice_date: '', currency: 'USD', amount: '', description: '' });
    onChange();
  }

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function remove(invId: string) {
    const res = await fetch(`/api/suppliers/${supplierId}/invoices/${invId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); throw new Error('delete failed'); }
    toast.success('Invoice deleted'); onChange();
  }

  return (
    <section className={cn(CARD, 'bg-ui-page-bg')}>
      <CardHeader
        title={`Invoices (${invoices.length})`}
        action={canEdit && <Button size="md" className={ACCENT_BTN} onClick={() => setAdding(v => !v)} aria-expanded={adding}><Plus className="size-4" /> Add Invoice</Button>}
      />

      {adding && canEdit && (
        <div className="grid grid-cols-2 items-end gap-2 rounded-[6px] border border-ui-divider bg-ui-surface p-3 md:grid-cols-[1fr_1fr_90px_1fr_2fr_auto]">
          <label className={FORM_LABEL}>Invoice #<input className={FIELD} value={f.invoice_number} onChange={e => setF({ ...f, invoice_number: e.target.value })} /></label>
          <label className={FORM_LABEL}>Date<input className={FIELD} type="date" value={f.invoice_date} onChange={e => setF({ ...f, invoice_date: e.target.value })} /></label>
          <label className={FORM_LABEL}>Cur.<Select className={FIELD} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
          <label className={FORM_LABEL}>Amount<input className={FIELD} type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label className={FORM_LABEL}>Description<input className={FIELD} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
          <Button size="md" onClick={add} loading={saving}>Save</Button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">No invoices recorded.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {invoices.map(inv => {
            const p = inv.project_id ? projById.get(inv.project_id) : null;
            return (
              <LedgerRow
                key={inv.id}
                title={inv.invoice_number ? `#${inv.invoice_number}` : '—'}
                titleClass={cn('text-[16px] font-semibold', HEADING)}
                amount={`${fmt(Number(inv.amount))} ${inv.currency}`}
                meta={<>
                  {[dayFirst(inv.invoice_date), inv.description].filter(Boolean).join('  ·  ') || '—'}
                  {p && <>{'  ·  '}<Link href={`/projects/${inv.project_id}`} className="text-inherit underline-offset-2 hover:underline">{p.code}</Link></>}
                  {'  ·  '}<span style={{ color: `var(--status-${INVOICE_STATUS_TONE[inv.status] ?? 't0'}-fg)` }}>{statusLabel(inv.status)}</span>
                </>}
                onDelete={canEdit ? () => setRemoving(inv) : undefined}
                deleteLabel="Delete invoice"
              />
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title="Delete this invoice?"
        description={removing
          ? `${removing.invoice_number ? `#${removing.invoice_number}` : 'No number'} · ${fmt(Number(removing.amount))} ${removing.currency}${removing.invoice_date ? ` · ${dayFirst(removing.invoice_date)}` : ''}. This can't be undone.`
          : undefined}
        confirmLabel="Delete"
        onConfirm={async () => { if (removing) await remove(removing.id); }}
      />
    </section>
  );
}

function PaymentsSection({ supplierId, payments, invoices, projById, canEdit, onChange }: {
  supplierId: string; payments: SupplierPayment[]; invoices: SupplierInvoice[];
  projById: Map<string, { code: string; name: string }>; canEdit: boolean; onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ amount: '', currency: 'USD', method: 'bank_transfer', paid_at: '', invoice_id: '', reference: '' });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<SupplierPayment | null>(null);

  async function add() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const payload = { ...f, amount: Number(f.amount), invoice_id: f.invoice_id || null };
    const res = await fetch(`/api/suppliers/${supplierId}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Payment recorded'); setAdding(false);
    setF({ amount: '', currency: 'USD', method: 'bank_transfer', paid_at: '', invoice_id: '', reference: '' });
    onChange();
  }

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function remove(payId: string) {
    const res = await fetch(`/api/suppliers/${supplierId}/payments/${payId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); throw new Error('delete failed'); }
    toast.success('Payment deleted'); onChange();
  }

  const invLabel = (inv: SupplierInvoice) => `${inv.invoice_number || inv.id.slice(0, 8)} · ${fmt(Number(inv.amount))} ${inv.currency}`;
  const invById = new Map(invoices.map(i => [i.id, i]));

  return (
    <section className={cn(CARD, 'bg-ui-page-bg')}>
      <CardHeader
        title={`Payments (${payments.length})`}
        action={canEdit && <Button size="md" className={ACCENT_BTN} onClick={() => setAdding(v => !v)} aria-expanded={adding}><Plus className="size-4" /> Add payment</Button>}
      />

      {adding && canEdit && (
        <div className="grid grid-cols-2 items-end gap-2 rounded-[6px] border border-ui-divider bg-ui-surface p-3 md:grid-cols-[1fr_80px_1fr_1fr_1.4fr_auto]">
          <label className={FORM_LABEL}>Amount<input className={FIELD} type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label className={FORM_LABEL}>Cur.<Select className={FIELD} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
          <label className={FORM_LABEL}>Method<Select className={FIELD} value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select></label>
          <label className={FORM_LABEL}>Date<input className={FIELD} type="date" value={f.paid_at} onChange={e => setF({ ...f, paid_at: e.target.value })} /></label>
          <label className={FORM_LABEL}>Against invoice<Select className={FIELD} value={f.invoice_id} onChange={e => setF({ ...f, invoice_id: e.target.value })}><option value="">On account</option>{invoices.map(inv => <option key={inv.id} value={inv.id}>{invLabel(inv)}</option>)}</Select></label>
          <Button size="md" onClick={add} loading={saving}>Save</Button>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">No payments recorded.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {payments.map(pay => {
            const p = pay.project_id ? projById.get(pay.project_id) : null;
            const inv = pay.invoice_id ? invById.get(pay.invoice_id) : null;
            return (
              <LedgerRow
                key={pay.id}
                title={PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
                titleClass="text-[14px] font-normal text-ui-body"
                amount={`${fmt(Number(pay.amount))} ${pay.currency}`}
                meta={<>
                  {[inv ? `Invoice ${inv.invoice_number || inv.id.slice(0, 8)}` : 'On Account', dayFirst(pay.paid_at), pay.reference].filter(Boolean).join('  ·  ')}
                  {p && <>{'  ·  '}<Link href={`/projects/${pay.project_id}`} className="text-inherit underline-offset-2 hover:underline">{p.code}</Link></>}
                </>}
                onDelete={canEdit ? () => setRemoving(pay) : undefined}
                deleteLabel="Delete payment"
              />
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title="Delete this payment?"
        description={removing
          ? `${PAYMENT_METHOD_LABELS[removing.method] ?? removing.method} · ${fmt(Number(removing.amount))} ${removing.currency}${removing.paid_at ? ` · ${dayFirst(removing.paid_at)}` : ''}. This can't be undone.`
          : undefined}
        confirmLabel="Delete"
        onConfirm={async () => { if (removing) await remove(removing.id); }}
      />
    </section>
  );
}

// What we've worked on with this supplier in the Trust System (PR #70): every project type given
// to it, when, and what was paid. PF amounts are what we owe it; paid = the item's paid USD/TL fields.
function WorkSection({ work, error }: { work: VendorWork; error: string | null }) {
  const d = (v: string | null) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-US') : '—');
  const money = (usd: number, tl: number) => [usd && `$${fmt(usd)}`, tl && `${fmt(tl)} TL`].filter(Boolean).join(' · ') || '—';
  const label = (s: string | null) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—');
  const t = work.totals;
  const owed = t.dueUsd > 0.005 || t.dueTl > 0.005;
  const stats: [string, string][] = [
    ['Projects', String(work.projects)],
    ['Jobs', String(work.rows.length)],
    ['Worked with', work.firstAt ? `${d(work.firstAt)} – ${d(work.lastAt)}` : '—'],
    ['Total PF', money(t.pfUsd, t.pfTl)],
    ['Paid', money(t.paidUsd, t.paidTl)],
    ['Still to pay', money(t.dueUsd, t.dueTl)],
  ];
  const TH = 'border-b border-ui-divider px-2.5 pb-2 text-left text-[12px] font-semibold whitespace-nowrap text-ui-body';
  const TD = 'px-2.5 py-2 text-[13px] whitespace-nowrap text-ui-body';
  const NUM = 'text-right tabular-nums';

  return (
    <section className={cn(CARD, 'bg-ui-page-bg')}>
      <CardHeader title="Work with this supplier" />
      <p className="-mt-3 m-0 flex items-center gap-1.5 text-[12px] text-ui-text-secondary"><Factory size={14} aria-hidden /> From the Trust System Production board</p>
      {error && <p className="m-0 text-[13px] text-[var(--status-t10-fg)]">Trust System couldn’t be read: {error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-[8px] bg-ui-surface px-3 py-2.5">
            <div className="text-[12px] font-medium text-ui-body">{k}</div>
            <div
              className={cn('mt-0.5 text-[16px] font-semibold tabular-nums', HEADING)}
              style={k === 'Still to pay' && owed ? { color: 'var(--status-t7-fg)' } : undefined}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      {work.rows.length === 0 ? (
        !error && <EmptyState size="sm" icon={<Factory />} title="No work with this supplier in the Trust System yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                {['Project', 'Type', 'PF code', 'Status', 'Started', 'Ready', 'Sent', 'Last payment'].map(h => <th key={h} className={TH}>{h}</th>)}
                {['PF', 'Paid', 'Still to pay'].map(h => <th key={h} className={cn(TH, 'text-right')}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {work.rows.map((r, i) => (
                <tr key={i} className="border-b border-ui-divider last:border-b-0">
                  <td className={cn(TD, 'min-w-[200px] whitespace-normal')}>
                    <span className={cn('font-semibold', HEADING)}>#{r.projectNo}</span> {r.projectName}
                    {r.projectDone && <StatusBadge group="production" status="completed" label="Done" size="sm" className="ml-1.5 align-middle" />}
                  </td>
                  <td className={TD}>{label(r.type)}</td>
                  <td className={TD}>{r.pfCode ?? '—'}</td>
                  <td className={TD}>{label(r.status)}</td>
                  <td className={TD}>{d(r.startedAt)}</td>
                  <td className={TD}>{d(r.readyAt)}</td>
                  <td className={TD}>{d(r.sentAt)}</td>
                  <td className={TD}>{d(r.lastPaidAt)}</td>
                  <td className={cn(TD, NUM)}>{money(r.pfUsd, r.pfTl)}</td>
                  <td className={cn(TD, NUM)}>{money(r.paidUsd, r.paidTl)}</td>
                  <td className={cn(TD, NUM)}>{money(r.pfUsd - r.paidUsd, r.pfTl - r.paidTl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
