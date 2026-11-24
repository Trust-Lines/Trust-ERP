'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FORM_FIELD, FORM_TEXTAREA, FormActions, FormField, FormPanel } from './itFormParts';

// IT → Subscriptions → New subscription and Edit, in the IT form system (itFormParts). The login
// password is write-only here: left empty when editing = unchanged. Only the card's last 4 digits.

export interface ItSubscriptionFormValues {
  id?: string;
  service: string; loginEmail: string; logoUrl: string; brandColor: string;
  seats: string; cardLast4: string; startDate: string; dueDate: string; notes: string;
  active: boolean;
  hasPassword?: boolean;
}

export const EMPTY_SUBSCRIPTION: ItSubscriptionFormValues = {
  service: '', loginEmail: '', logoUrl: '', brandColor: '', seats: '', cardLast4: '', startDate: '', dueDate: '', notes: '', active: true,
};

export function ItSubscriptionFormDialog({ initial, onClose, onSaved }: {
  initial: ItSubscriptionFormValues;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<ItSubscriptionFormValues>(initial);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;
  const set = <K extends keyof ItSubscriptionFormValues>(k: K, v: ItSubscriptionFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id: _id, hasPassword: _h, active, ...fields } = f;
      const res = await fetch(editing ? `/api/it/subscriptions/${initial.id}` : '/api/it/subscriptions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, ...(editing ? { active } : {}), ...(password ? { password } : {}) }),
      });
      const body = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      toast.success(editing ? 'Subscription updated' : 'Subscription added');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the subscription');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <ModalContent size="xl" title={editing ? 'Edit Subscription' : 'New Subscription'} description="A company software subscription.">
        <form onSubmit={submit} className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-1">
          <FormPanel id="its-service" title="Service">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField id="its-name" label="Service" required className="sm:col-span-2">
                <Input id="its-name" required maxLength={80} autoFocus className={FORM_FIELD} value={f.service} onChange={e => set('service', e.target.value)} placeholder="Adobe Creative Cloud" />
              </FormField>
              <FormField id="its-seats" label="Users">
                <Input id="its-seats" type="number" min={0} max={100000} inputMode="numeric" className={FORM_FIELD} value={f.seats} onChange={e => set('seats', e.target.value)} placeholder="5" />
              </FormField>
              <FormField id="its-color" label="Brand colour">
                <div className="flex items-center gap-2">
                  <input
                    type="color" aria-label="Pick brand colour" value={/^#[0-9a-f]{6}$/i.test(f.brandColor) ? f.brandColor : '#2b3d55'}
                    onChange={e => set('brandColor', e.target.value.toUpperCase())}
                    className="h-[42px] w-12 shrink-0 cursor-pointer rounded-md border border-primary-100 bg-white p-1 dark:border-transparent dark:bg-secondary-800"
                  />
                  <Input id="its-color" maxLength={7} className={FORM_FIELD} value={f.brandColor} onChange={e => set('brandColor', e.target.value)} placeholder="#DA1F26" />
                </div>
              </FormField>
              <FormField id="its-logo" label="Logo link" hint="An https:// image link (optional)" className="sm:col-span-2 lg:col-span-4">
                <Input id="its-logo" type="url" maxLength={500} className={FORM_FIELD} value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…/logo.png" />
              </FormField>
            </div>
          </FormPanel>

          <FormPanel id="its-login" title="Login" aside="Password stored encrypted">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="its-email" label="Login email">
                <Input id="its-email" type="email" maxLength={254} className={FORM_FIELD} value={f.loginEmail} onChange={e => set('loginEmail', e.target.value)} placeholder="it@trust-lines.com" />
              </FormField>
              <FormField id="its-password" label="Password">
                <Input id="its-password" type="password" autoComplete="new-password" maxLength={500} className={FORM_FIELD} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder={editing && initial.hasPassword ? 'Saved. Type to replace.' : ''} />
              </FormField>
            </div>
          </FormPanel>

          <FormPanel id="its-billing" title="Billing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField id="its-card" label="Card (last 4 digits)">
                <Input id="its-card" maxLength={4} inputMode="numeric" pattern="[0-9]{4}" className={FORM_FIELD} value={f.cardLast4}
                  onChange={e => set('cardLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4242" />
              </FormField>
              <FormField id="its-start" label="Start date">
                <Input id="its-start" type="date" className={FORM_FIELD} value={f.startDate} onChange={e => set('startDate', e.target.value)} />
              </FormField>
              <FormField id="its-due" label="Due date" hint="Shown in red within 30 days">
                <Input id="its-due" type="date" className={FORM_FIELD} value={f.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </FormField>
            </div>
            <FormField id="its-notes" label="Notes">
              <Textarea id="its-notes" maxLength={4000} rows={2} className={FORM_TEXTAREA} value={f.notes} onChange={e => set('notes', e.target.value)} />
            </FormField>
            {editing && (
              <label className="flex items-center gap-2 text-[13px] text-ui-body">
                <Checkbox checked={!f.active} onCheckedChange={v => set('active', !v)} />
                Cancelled (move to History)
              </label>
            )}
          </FormPanel>

          <FormActions saving={saving} onCancel={onClose} submitLabel={editing ? 'Save' : 'Add Subscription'} />
        </form>
      </ModalContent>
    </Modal>
  );
}
