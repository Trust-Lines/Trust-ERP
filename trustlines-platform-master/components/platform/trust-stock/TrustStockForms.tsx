'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { StockPfSign, StockSendStatus, TrustStockItem } from './types';
import { newId } from './store';

// Dialogs behind "New Stock" and a stock's "Add line" / a line's row. No backend yet — the page
// keeps what is saved here in this tab (store.ts), and each dialog says so.

const NOT_SAVED = 'Kept on this device until Trust Stock saving is connected.';

export const TYPES = ['Millwork', 'Ceiling', 'Lighting', 'Furniture', 'Other'];
export const PF_SIGN: { value: StockPfSign; label: string }[] = [
  { value: 'signed', label: 'Signed' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_signed', label: 'Not signed' },
];
export const SEND_STATUS: { value: StockSendStatus; label: string }[] = [
  { value: 'sent', label: 'Sent' },
  { value: 'not_sent', label: 'Not sent' },
];

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-ui-heading">{label}</label>
      {children(id)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 p-0 text-[13px] font-semibold text-ui-heading">{title}</legend>
      {children}
    </fieldset>
  );
}

// ── New stock ──────────────────────────────────────────────────────────────────────────────
export function NewStockDialog({ open, onOpenChange, existing, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; existing: string[]; onCreate: (code: string) => void;
}) {
  const formId = useId();
  const [code, setCode] = useState('');
  const clean = code.trim().toUpperCase();
  const taken = existing.some(c => c.toUpperCase() === clean);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!clean || taken) return;
    onCreate(clean);
    setCode('');
    onOpenChange(false);
  };
  return (
    <Modal open={open} onOpenChange={o => { onOpenChange(o); if (!o) setCode(''); }}>
      <ModalContent
        size="sm"
        title="New stock"
        description="Start a stock batch, then add its PF lines."
        footer={<>
          <p className="m-0 mr-auto text-[11px] text-ui-text-secondary">{NOT_SAVED}</p>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} disabled={!clean || taken}>Create</Button>
        </>}
      >
        <form id={formId} onSubmit={submit}>
          <Field label="Stock code">{id => (
            <>
              <Input id={id} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. TR-04" required autoFocus aria-invalid={taken || undefined} />
              {taken && <p className="m-0 text-[11px] text-error-normal">That stock already exists.</p>}
            </>
          )}</Field>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ── Add / edit a line ──────────────────────────────────────────────────────────────────────
const blank = (): TrustStockItem => ({
  id: newId(), type: 'Millwork', pfCode: '', vendor: '', orderNo: '', pfSign: 'pending', status: 'not_sent',
  std: null, rtr: null, rto: null, pfUsd: 0, pfTl: 0, invUsd: 0, invTl: 0, paymentRule: null,
  paid1Usd: 0, paid1UsdDate: null, paid2Usd: 0, paid2UsdDate: null, paid1Tl: 0, paid1TlDate: null,
  paid2Tl: 0, paid2TlDate: null, notOrderedUsd: 0, notOrderedTl: 0,
});

export function StockItemDialog({ open, onOpenChange, stockCode, item, onSave, onRemove }: {
  open: boolean; onOpenChange: (open: boolean) => void; stockCode: string;
  /** null = new line. */
  item: TrustStockItem | null;
  onSave: (item: TrustStockItem) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        className="max-w-[880px]"
        title={item ? `Edit line · STOCK ${stockCode}` : `Add line · STOCK ${stockCode}`}
        description="PF line and its accounting."
      >
        {/* Keyed so a different line (or a new one) starts from its own values. */}
        {open && <ItemForm key={item?.id ?? 'new'} item={item} onDone={() => onOpenChange(false)} onSave={onSave} onRemove={onRemove} />}
      </ModalContent>
    </Modal>
  );
}

function ItemForm({ item, onDone, onSave, onRemove }: {
  item: TrustStockItem | null; onDone: () => void; onSave: (item: TrustStockItem) => void; onRemove?: (id: string) => void;
}) {
  const [v, setV] = useState<TrustStockItem>(() => item ?? blank());
  const put = <K extends keyof TrustStockItem>(k: K, val: TrustStockItem[K]) => setV(prev => ({ ...prev, [k]: val }));
  const text = (k: 'pfCode' | 'vendor' | 'orderNo') => (id: string) =>
    <Input id={id} value={v[k]} onChange={e => put(k, e.target.value)} />;
  const date = (k: 'std' | 'rtr' | 'rto' | 'paid1UsdDate' | 'paid2UsdDate' | 'paid1TlDate' | 'paid2TlDate') => (id: string) =>
    <Input id={id} type="date" value={v[k] ?? ''} onChange={e => put(k, e.target.value || null)} />;
  const money = (k: 'pfUsd' | 'pfTl' | 'invUsd' | 'invTl' | 'paid1Usd' | 'paid2Usd' | 'paid1Tl' | 'paid2Tl' | 'notOrderedUsd' | 'notOrderedTl') => (id: string) =>
    <Input id={id} type="number" inputMode="decimal" step="0.01" min="0" value={v[k] === 0 ? '' : v[k]} placeholder="0.00" onChange={e => put(k, Number(e.target.value) || 0)} />;
  const canSave = !!v.pfCode.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ ...v, pfCode: v.pfCode.trim(), vendor: v.vendor.trim(), orderNo: v.orderNo.trim() });
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Section title="Line">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Type">{id => <Select id={id} value={v.type} onValueChange={x => x && put('type', x)} options={TYPES.map(t => ({ value: t, label: t }))} />}</Field>
          <Field label="PF Code">{text('pfCode')}</Field>
          <Field label="Order#">{text('orderNo')}</Field>
          <div className="col-span-2 sm:col-span-1"><Field label="Vendor">{text('vendor')}</Field></div>
          <Field label="PF Sign Status">{id => <Select id={id} value={v.pfSign} onValueChange={x => x && put('pfSign', x as StockPfSign)} options={PF_SIGN} />}</Field>
          <Field label="Status">{id => <Select id={id} value={v.status} onValueChange={x => x && put('status', x as StockSendStatus)} options={SEND_STATUS} />}</Field>
        </div>
      </Section>
      <Section title="Dates">
        <div className="grid grid-cols-3 gap-3">
          <Field label="STD">{date('std')}</Field>
          <Field label="RTR">{date('rtr')}</Field>
          <Field label="RTO">{date('rto')}</Field>
        </div>
      </Section>
      <Section title="PF & invoice">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="PF / USD">{money('pfUsd')}</Field>
          <Field label="PF / TL">{money('pfTl')}</Field>
          <Field label="INV / USD">{money('invUsd')}</Field>
          <Field label="INV / TL">{money('invTl')}</Field>
          <Field label="Payment Rule (%)">{id => (
            <Input id={id} type="number" inputMode="decimal" step="0.1" min="0" max="100" value={v.paymentRule ?? ''}
              onChange={e => put('paymentRule', e.target.value === '' ? null : Number(e.target.value))} />
          )}</Field>
        </div>
      </Section>
      <Section title="Payments">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="1st paid / USD">{money('paid1Usd')}</Field>
          <Field label="Date">{date('paid1UsdDate')}</Field>
          <Field label="2nd paid / USD">{money('paid2Usd')}</Field>
          <Field label="Date">{date('paid2UsdDate')}</Field>
          <Field label="1st paid / TL">{money('paid1Tl')}</Field>
          <Field label="Date">{date('paid1TlDate')}</Field>
          <Field label="2nd paid / TL">{money('paid2Tl')}</Field>
          <Field label="Date">{date('paid2TlDate')}</Field>
          <Field label="Not ordered / USD">{money('notOrderedUsd')}</Field>
          <Field label="Not ordered / TL">{money('notOrderedTl')}</Field>
        </div>
        <p className="m-0 text-[11px] text-ui-text-secondary">Remaining is PF minus what is paid; Invoice uses the INV amounts.</p>
      </Section>

      <div className="-mx-5 flex flex-wrap items-center justify-end gap-2 border-t border-ui-divider px-5 pt-4">
        <p className="m-0 mr-auto text-[11px] text-ui-text-secondary">{NOT_SAVED}</p>
        {item && onRemove && (
          <Button type="button" variant="ghost" className="text-error-normal" onClick={() => { onRemove(item.id); onDone(); }}>Remove line</Button>
        )}
        <Button type="button" variant="secondary" className={modalSecondaryButtonClass} onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!canSave}>{item ? 'Save' : 'Add line'}</Button>
      </div>
    </form>
  );
}
