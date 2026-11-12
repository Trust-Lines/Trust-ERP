'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// The "New Stock" dialog. Lines are edited in place on the sheet (StockGrid). No backend yet — the
// page keeps what is saved here in this tab (store.ts), and the dialog says so.

const NOT_SAVED = 'Kept on this device until Trust Stock saving is connected.';


function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-ui-heading">{label}</label>
      {children(id)}
    </div>
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
        description="Start a stock batch; its PF lines come from Upload PF PDF."
        footer={<>
          <p className="m-0 mr-auto text-[11px] text-ui-text-secondary">{NOT_SAVED}</p>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button type="submit" form={formId} disabled={!clean || taken}>Create</Button>
        </>}
      >
        <form id={formId} onSubmit={submit}>
          <Field label="Stock code">{id => (
            <>
              <Input id={id} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. TR-04" required autoFocus aria-invalid={taken || undefined} className="h-10 text-[14px]" />
              {taken && <p className="m-0 text-[11px] text-error-normal">That stock already exists.</p>}
            </>
          )}</Field>
        </form>
      </ModalContent>
    </Modal>
  );
}
