'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { UserRound, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { FORM_FIELD, FORM_TEXTAREA, FormActions, FormField, FormPanel, SECONDARY_BTN } from './itFormParts';

// IT → Subscriptions → New subscription and Edit, in the IT form system (itFormParts). The login
// password is write-only here: left empty when editing = unchanged. Only the card's last 4 digits.
// Users are people, not a number: staff picked from the system, or a typed name for someone with no
// account / email yet. The count on the card is how many are listed.

export interface ItSubscriptionFormValues {
  id?: string;
  service: string; loginEmail: string; logoUrl: string; brandColor: string;
  users: SubscriptionUser[]; cardLast4: string; startDate: string; dueDate: string; notes: string;
  active: boolean;
  hasPassword?: boolean;
}

/** personId null = a typed name (no account yet). */
export interface SubscriptionUser { personId: string | null; name: string }

export const EMPTY_SUBSCRIPTION: ItSubscriptionFormValues = {
  service: '', loginEmail: '', logoUrl: '', brandColor: '', users: [], cardLast4: '', startDate: '', dueDate: '', notes: '', active: true,
};

const userKey = (u: SubscriptionUser) => u.personId ?? `name:${u.name.toLowerCase()}`;
const sameUsers = (a: SubscriptionUser[], b: SubscriptionUser[]) =>
  a.length === b.length && a.every((u, i) => userKey(u) === userKey(b[i]));

export function ItSubscriptionFormDialog({ initial, people, onClose, onSaved }: {
  initial: ItSubscriptionFormValues;
  /** Active staff to pick users from. */
  people: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<ItSubscriptionFormValues>(initial);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [typedName, setTypedName] = useState('');
  const editing = !!initial.id;
  const picked = useMemo(() => new Set(f.users.map(userKey)), [f.users]);
  const pickable = useMemo(() => people.filter(p => !picked.has(p.id)).map(p => ({ value: p.id, label: p.name })), [people, picked]);
  const addUser = (u: SubscriptionUser) => { if (!picked.has(userKey(u))) setF(p => ({ ...p, users: [...p.users, u] })); };
  const removeUser = (key: string) => setF(p => ({ ...p, users: p.users.filter(u => userKey(u) !== key) }));
  function addTyped() {
    const name = typedName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    addUser({ personId: null, name: name.slice(0, 120) });
    setTypedName('');
  }
  const set = <K extends keyof ItSubscriptionFormValues>(k: K, v: ItSubscriptionFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id: _id, hasPassword: _h, active, users, ...fields } = f;
      // Users only when they changed (or on a new subscription with some), so other edits still work
      // before migration 160 is run.
      const sendUsers = editing ? !sameUsers(users, initial.users) : users.length > 0;
      const res = await fetch(editing ? `/api/it/subscriptions/${initial.id}` : '/api/it/subscriptions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields, ...(editing ? { active } : {}), ...(password ? { password } : {}),
          ...(sendUsers ? { users: users.map(u => (u.personId ? { personId: u.personId } : { name: u.name })) } : {}),
        }),
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField id="its-name" label="Service" required className="sm:col-span-2">
                <Input id="its-name" required maxLength={80} autoFocus className={FORM_FIELD} value={f.service} onChange={e => set('service', e.target.value)} placeholder="Adobe Creative Cloud" />
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
              <FormField id="its-logo" label="Logo link" hint="An https:// image link (optional)" className="sm:col-span-3">
                <Input id="its-logo" type="url" maxLength={500} className={FORM_FIELD} value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…/logo.png" />
              </FormField>
            </div>
          </FormPanel>

          <FormPanel id="its-users" title="Users" aside={`${f.users.length} user${f.users.length === 1 ? '' : 's'}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="its-user-pick" label="Add a staff member" hint="Shows on their IT staff page">
                <Combobox
                  key={f.users.length} id="its-user-pick" options={pickable} value={null} placeholder="Search people…" emptyText="No one left to add"
                  onValueChange={o => { if (o) addUser({ personId: o.value, name: o.label }); }} className={FORM_FIELD}
                />
              </FormField>
              <FormField id="its-user-name" label="Or type a name" hint="For someone with no account or email yet">
                <div className="flex gap-2">
                  <Input id="its-user-name" maxLength={120} className={FORM_FIELD} value={typedName} placeholder="Full name"
                    onChange={e => setTypedName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }} />
                  <button type="button" onClick={addTyped} disabled={!typedName.trim()} className={cn(SECONDARY_BTN, 'h-[42px] shrink-0 bg-white px-4 disabled:opacity-50 dark:bg-secondary-800')}>Add</button>
                </div>
              </FormField>
            </div>
            {f.users.length === 0 ? (
              <p className="m-0 text-[13px] text-ui-text-secondary">No users yet. Add the people who use this subscription.</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Users">
                {f.users.map(u => (
                  <li key={userKey(u)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary-100 bg-white pl-2.5 pr-1 text-[13px] font-medium text-secondary-700 dark:border-transparent dark:bg-secondary-800 dark:text-secondary-50">
                    <UserRound className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    {u.name}
                    {!u.personId && <span className="text-[11px] font-normal text-ui-text-secondary">(no account)</span>}
                    <button type="button" onClick={() => removeUser(userKey(u))} aria-label={`Remove ${u.name}`}
                      className="grid size-6 place-items-center rounded hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring">
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
