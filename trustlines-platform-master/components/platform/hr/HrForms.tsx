'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { HrAbsenceReason, HrEventKind, HrOrder, HrUnavailable } from './types';
import type { HrLocalEvent } from './HrData';
import { KIND_LABEL, KIND_ORDER, dayKey } from './tones';

// Form dialogs behind the HR board's header buttons (Create event, New Order, Add). There is no
// HR backend yet, so the page decides what "save" does (HrData keeps entries in this tab).

const NOT_SAVED = 'Kept on this device until HR saving is connected.';

function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-ui-heading">{label}</label>
      {children(id)}
      {hint && <p className="m-0 text-[11px] text-ui-text-secondary">{hint}</p>}
    </div>
  );
}

function FormDialog({ open, onOpenChange, title, description, submitLabel, canSubmit, onSubmit, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  submitLabel: string; canSubmit: boolean; onSubmit: () => void; children: ReactNode;
}) {
  const formId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit();
    onOpenChange(false);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={title}
        description={description}
        footer={<>
          <p className="m-0 mr-auto text-[11px] text-ui-text-secondary">{NOT_SAVED}</p>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} disabled={!canSubmit}>{submitLabel}</Button>
        </>}
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">{children}</form>
      </ModalContent>
    </Modal>
  );
}

// ── Create event ───────────────────────────────────────────────────────────────────────────
export function CreateEventDialog({ open, onOpenChange, defaultDate, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; defaultDate: Date; onCreate: (e: Omit<HrLocalEvent, 'id'>) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<HrEventKind>('reminder');
  const [date, setDate] = useState(() => dayKey(defaultDate));
  const [time, setTime] = useState('');
  const [detail, setDetail] = useState('');
  const reset = () => { setLabel(''); setKind('reminder'); setDate(dayKey(defaultDate)); setTime(''); setDetail(''); };

  return (
    <FormDialog
      open={open}
      onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}
      title="Create event"
      description="Add a reminder, delivery, birthday or day off to the HR calendar."
      submitLabel="Create event"
      canSubmit={!!label.trim() && !!date}
      onSubmit={() => onCreate({ label: label.trim(), kind, date, time: time || null, detail: detail.trim() || null })}
    >
      <Field label="Title">{id => <Input id={id} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Team meeting" required autoFocus />}</Field>
      <Field label="Type">{id => (
        <Select id={id} value={kind} onValueChange={v => v && setKind(v as HrEventKind)}
          options={KIND_ORDER.map(k => ({ value: k, label: KIND_LABEL[k] }))} />
      )}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{id => <Input id={id} type="date" value={date} onChange={e => setDate(e.target.value)} required />}</Field>
        <Field label="Time" hint="Leave empty for all day.">{id => <Input id={id} type="time" value={time} onChange={e => setTime(e.target.value)} />}</Field>
      </div>
      <Field label="Notes">{id => <Textarea id={id} value={detail} onChange={e => setDetail(e.target.value)} rows={3} />}</Field>
    </FormDialog>
  );
}

// ── New order ──────────────────────────────────────────────────────────────────────────────
export function NewOrderDialog({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreate: (o: Omit<HrOrder, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [dueDate, setDueDate] = useState('');
  const reset = () => { setName(''); setReference(''); setDueDate(''); };

  return (
    <FormDialog
      open={open}
      onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}
      title="New order"
      description="Track an order and its delivery date."
      submitLabel="Add order"
      canSubmit={!!name.trim() && !!dueDate}
      onSubmit={() => onCreate({ name: name.trim(), reference: reference.trim() || null, dueDate })}
    >
      <Field label="Item name">{id => <Input id={id} value={name} onChange={e => setName(e.target.value)} required autoFocus />}</Field>
      <Field label="Reference">{id => <Input id={id} value={reference} onChange={e => setReference(e.target.value)} placeholder="#SE89846" />}</Field>
      <Field label="Delivery date">{id => <Input id={id} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />}</Field>
    </FormDialog>
  );
}

// ── Unavailable staff ──────────────────────────────────────────────────────────────────────
const REASONS: { value: HrAbsenceReason; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'vacation', label: 'Vacation' },
];

export function AddUnavailableDialog({ open, onOpenChange, defaultDate, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; defaultDate: Date; onCreate: (u: Omit<HrUnavailable, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [reason, setReason] = useState<HrAbsenceReason>('sick');
  const [date, setDate] = useState(() => dayKey(defaultDate));
  const reset = () => { setName(''); setRole(''); setReason('sick'); setDate(dayKey(defaultDate)); };

  return (
    <FormDialog
      open={open}
      onOpenChange={o => { onOpenChange(o); if (!o) reset(); }}
      title="Add unavailable staff"
      description="Mark someone as off sick or on vacation."
      submitLabel="Add"
      canSubmit={!!name.trim() && !!date}
      onSubmit={() => onCreate({ name: name.trim(), role: role.trim() || null, reason, date })}
    >
      <Field label="Name">{id => <Input id={id} value={name} onChange={e => setName(e.target.value)} required autoFocus />}</Field>
      <Field label="Role">{id => <Input id={id} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. General Manager" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reason">{id => (
          <Select id={id} value={reason} onValueChange={v => v && setReason(v as HrAbsenceReason)} options={REASONS} />
        )}</Field>
        <Field label="Date">{id => <Input id={id} type="date" value={date} onChange={e => setDate(e.target.value)} required />}</Field>
      </div>
    </FormDialog>
  );
}
