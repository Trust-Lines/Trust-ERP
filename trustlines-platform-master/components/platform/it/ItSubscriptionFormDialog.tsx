'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Copy, Ellipsis, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { ModalPanel } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { cn } from '@/lib/utils';
import { copyText } from './itCardParts';

// Figma "New Subscription" → Edit Service (1141:19264, 1142:21218, 1142:20415): one white card —
// Service Info (name, logo link), Credentials (email, password, each with copy), Billing Info
// (amount, currency, monthly / yearly, card last 4), Additional Info (start, due, maximum users,
// notes) and Users: people from the system, typed names (no account yet) or teams with a head
// count, in a two-column list; "Add Users" opens a "Select or type.." slot. Delete / Save.
// The password is write-only: left empty when editing = unchanged (copy fetches the saved one).

export type Currency = 'USD' | 'EUR' | 'TRY' | 'GBP';
export type BillingCycle = 'monthly' | 'yearly';

export interface ItSubscriptionFormValues {
  id?: string;
  service: string; loginEmail: string; logoUrl: string;
  amount: string; currency: Currency | ''; billingCycle: BillingCycle | '';
  cardLast4: string; startDate: string; dueDate: string;
  /** Maximum users ("" = no limit). */
  seats: string;
  notes: string;
  users: SubscriptionUser[];
  active: boolean;
  hasPassword?: boolean;
}

/** personId null = a typed name (no account yet); teamSize set = a team with that many people. */
export interface SubscriptionUser { personId: string | null; name: string; role?: string | null; teamSize?: number | null }

export const EMPTY_SUBSCRIPTION: ItSubscriptionFormValues = {
  service: '', loginEmail: '', logoUrl: '', amount: '', currency: 'USD', billingCycle: 'monthly',
  cardLast4: '', startDate: '', dueDate: '', seats: '', notes: '', users: [], active: true,
};

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: '$ (USD)', symbol: '$' },
  { value: 'EUR', label: '€ (EUR)', symbol: '€' },
  { value: 'TRY', label: '₺ (TRY)', symbol: '₺' },
  { value: 'GBP', label: '£ (GBP)', symbol: '£' },
];
const CYCLE_OPTIONS = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }];

export const userKey = (u: SubscriptionUser) => u.personId ?? `name:${u.name.toLowerCase()}`;
const sameUsers = (a: SubscriptionUser[], b: SubscriptionUser[]) =>
  a.length === b.length && a.every((u, i) => userKey(u) === userKey(b[i]) && (u.teamSize ?? null) === (b[i].teamSize ?? null));

/** "Users (10)", "Users (1 Team)", "Users (3 · 1 Team)". */
export function usersHeading(users: SubscriptionUser[]) {
  const teams = users.filter(u => u.teamSize != null).length;
  const people = users.length - teams;
  const parts = [people || !teams ? String(people) : null, teams ? `${teams} Team${teams === 1 ? '' : 's'}` : null].filter(Boolean);
  return `Users (${parts.join(' · ')})`;
}

/** "2026-01-05" ↔ Date (local). */
const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`) : null);
const toIso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
/** "20 OCT 2023". */
export const formatDay = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;

const STRONG = 'text-secondary-700 dark:text-secondary-50';
const SECTION = 'flex flex-col gap-4 border-b border-dashed border-ui-divider pb-4';
const SECTION_TITLE = cn('m-0 text-[16px] font-semibold leading-4 tracking-[0.48px]', STRONG);
const LABEL = 'block text-[12px] font-medium leading-4 tracking-[0.36px] text-ui-body';
/** Figma "Input": 40px, input border, 6px radius, 14px semibold. */
const INPUT = cn(
  'h-10 w-full min-w-0 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-surface pl-[10px] pr-1.5 text-[14px] font-semibold outline-none',
  'placeholder:font-medium placeholder:text-primary-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:placeholder:text-primary-300',
  STRONG,
);
/** Grey dropdowns (currency, monthly / yearly). */
const GREY_SELECT = 'h-10 w-full rounded-[6px] border-[var(--ui-input-border)] bg-primary-50 pl-4 pr-2 text-[14px] font-semibold dark:bg-primary-700';

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

/** Input with the white copy chip at its end. */
function CopyInput({ onCopy, label, children }: { onCopy: () => void; label: string; children: ReactNode }) {
  return (
    <div className="relative flex items-center">
      {children}
      <button
        type="button" onClick={onCopy} aria-label={label} title={label}
        className={cn('absolute right-1.5 grid h-7 place-items-center rounded-[6px] bg-ui-surface px-2.5 hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring', STRONG)}
      >
        <Copy size={16} aria-hidden />
      </button>
    </div>
  );
}

const ROW_MENU = cn('grid size-[21px] shrink-0 place-items-center rounded-[3px] border border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring', STRONG);

function UserCard({ user, sizing, onSize, onSizing, onRemove }: {
  user: SubscriptionUser;
  sizing: boolean;
  onSize: (n: number) => void;
  onSizing: (on: boolean) => void;
  onRemove: () => void;
}) {
  const team = user.teamSize != null;
  const [size, setSize] = useState(String(user.teamSize ?? 1));
  const commit = () => {
    const n = Number(size);
    if (Number.isInteger(n) && n >= 1 && n <= 100000) onSize(n); else setSize(String(user.teamSize ?? 1));
    onSizing(false);
  };
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-[8px] border border-ui-divider bg-ui-surface p-2">
      {team ? (
        <span className="size-[35px] shrink-0 rounded-[3px] bg-primary-300 dark:bg-primary-500" aria-hidden />
      ) : (
        <Avatar size="md" name={user.name} userId={user.personId} className="size-[35px] rounded-[3px]" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-[14px] font-semibold leading-[17px]', STRONG)}>{user.name}</span>
        {team && sizing ? (
          <label className="flex items-center gap-1 text-[11px] font-medium text-ui-body">
            <span className="sr-only">People in {user.name}</span>
            <input
              type="number" min={1} max={100000} autoFocus value={size} onChange={e => setSize(e.target.value)}
              onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); setSize(String(user.teamSize ?? 1)); onSizing(false); } }}
              className={cn('h-5 w-16 rounded-[3px] border border-[var(--ui-input-border)] bg-ui-surface px-1 text-[11px] outline-none', STRONG)}
            />
            User
          </label>
        ) : (
          <span className="truncate text-[11px] font-medium leading-4 tracking-[0.33px] text-ui-body">
            {team ? `${user.teamSize} User${user.teamSize === 1 ? '' : 's'}` : user.personId ? (user.role ? roleLabel(user.role) : 'Staff') : 'No account yet'}
          </span>
        )}
      </span>
      <Menu>
        <MenuTrigger render={<button type="button" className={ROW_MENU} aria-label={`Actions for ${user.name}`} />}>
          <Ellipsis size={15} aria-hidden />
        </MenuTrigger>
        <MenuContent>
          {team && <MenuItem onClick={() => onSizing(true)}>Change team size</MenuItem>}
          <MenuItem onClick={onRemove}>Remove</MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

export function ItSubscriptionFormDialog({ initial, people, onClose, onSaved, onDelete }: {
  initial: ItSubscriptionFormValues;
  /** Active staff to pick users from. */
  people: { id: string; name: string; role?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
  /** Editing: Delete (the parent asks to confirm). */
  onDelete?: () => void;
}) {
  const [f, setF] = useState<ItSubscriptionFormValues>(initial);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [typed, setTyped] = useState('');
  const [sizing, setSizing] = useState<string | null>(null);
  const editing = !!initial.id;
  const set = <K extends keyof ItSubscriptionFormValues>(k: K, v: ItSubscriptionFormValues[K]) => setF(p => ({ ...p, [k]: v }));

  const picked = useMemo(() => new Set(f.users.map(userKey)), [f.users]);
  const options = useMemo(() => {
    const list = people.filter(p => !picked.has(p.id)).map(p => ({ value: p.id, label: p.name }));
    const t = typed.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (t && !picked.has(`name:${t.toLowerCase()}`)) {
      list.push({ value: `__name:${t}`, label: `Add “${t}” (no account yet)` });
      list.push({ value: `__team:${t}`, label: `Add “${t}” as a team` });
    }
    return list;
  }, [people, picked, typed]);

  useEffect(() => {
    if (adding) requestAnimationFrame(() => document.getElementById('its-add-user')?.focus());
  }, [adding]);

  function pick(value: string) {
    let u: SubscriptionUser | null = null;
    if (value.startsWith('__name:')) u = { personId: null, name: value.slice(7) };
    else if (value.startsWith('__team:')) u = { personId: null, name: value.slice(7), teamSize: 1 };
    else {
      const p = people.find(x => x.id === value);
      if (p) u = { personId: p.id, name: p.name, role: p.role ?? null };
    }
    if (!u || picked.has(userKey(u))) return;
    setF(p => ({ ...p, users: [...p.users, u] }));
    if (u.teamSize != null) setSizing(userKey(u));
    setTyped('');
    setAdding(false);
  }
  const removeUser = (key: string) => setF(p => ({ ...p, users: p.users.filter(u => userKey(u) !== key) }));
  const sizeUser = (key: string, n: number) => setF(p => ({ ...p, users: p.users.map(u => (userKey(u) === key ? { ...u, teamSize: n } : u)) }));

  async function copyPassword() {
    if (password) return copyText(password, 'Password');
    if (!editing || !initial.hasPassword) { toast.error('No password saved'); return; }
    const res = await fetch(`/api/it/subscriptions/${initial.id}/secret`, { cache: 'no-store' });
    const b = await res.json().catch(() => null) as { value?: string; error?: string } | null;
    if (!res.ok || typeof b?.value !== 'string') { toast.error(b?.error ?? 'Could not load the password'); return; }
    await copyText(b.value, 'Password');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { id: _id, hasPassword: _h, active, users, ...fields } = f;
      // Users only when they changed (or on a new subscription with some).
      const sendUsers = editing ? !sameUsers(users, initial.users) : users.length > 0;
      const res = await fetch(editing ? `/api/it/subscriptions/${initial.id}` : '/api/it/subscriptions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields, ...(editing ? { active } : {}), ...(password ? { password } : {}),
          ...(sendUsers ? {
            users: users.map(u => (u.personId ? { personId: u.personId } : { name: u.name, ...(u.teamSize != null ? { teamSize: u.teamSize } : {}) })),
          } : {}),
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

  const title = editing ? 'Edit Service' : 'New Service';
  return (
    <ModalPanel
      onOpenChange={o => { if (!o && !saving) onClose(); }}
      aria-label={title}
      containerClassName="items-start overflow-y-auto px-4 py-[4vh]"
    >
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="mx-auto flex w-[min(769px,100%)] flex-col gap-4 rounded-[16px] border border-ui-divider bg-ui-surface px-4 pb-4 pt-[14px] font-ui shadow-[0_12px_48px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn('m-0 text-[24px] font-semibold leading-5', STRONG)}>{title}</h2>
          <button
            type="button" onClick={onClose} disabled={saving} aria-label="Close"
            className={cn('grid size-[37px] place-items-center rounded-[8px] border border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring', STRONG)}
          >
            <X size={23} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <section className={SECTION} aria-labelledby="its-s-service">
          <div className="flex flex-col gap-2">
            <h3 id="its-s-service" className={SECTION_TITLE}>Service Info</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[189px_minmax(0,1fr)]">
              <Field id="its-name" label="Service Name">
                <input id="its-name" required maxLength={80} autoFocus className={INPUT} value={f.service} onChange={e => set('service', e.target.value)} placeholder="Claude" />
              </Field>
              <Field id="its-logo" label="Service Logo">
                <input id="its-logo" type="url" maxLength={500} className={INPUT} value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…/logo.svg" />
              </Field>
            </div>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="its-s-cred">
          <div className="flex flex-col gap-2">
            <h3 id="its-s-cred" className={SECTION_TITLE}>Credentials</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field id="its-email" label="Email Address">
                <CopyInput label="Copy email" onCopy={() => { if (f.loginEmail.trim()) void copyText(f.loginEmail.trim(), 'Email'); }}>
                  <input id="its-email" type="email" maxLength={254} className={cn(INPUT, 'pr-14')} value={f.loginEmail} onChange={e => set('loginEmail', e.target.value)} placeholder="example@trustlines.com" />
                </CopyInput>
              </Field>
              <Field id="its-password" label="Password">
                <CopyInput label="Copy password" onCopy={() => void copyPassword()}>
                  <input
                    id="its-password" type="password" autoComplete="new-password" maxLength={500} className={cn(INPUT, 'pr-14')} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder={editing && initial.hasPassword ? 'Saved. Type to replace.' : ''}
                  />
                </CopyInput>
              </Field>
            </div>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="its-s-billing">
          <div className="flex flex-col gap-2">
            <h3 id="its-s-billing" className={SECTION_TITLE}>Billing Info</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[270px_minmax(0,1fr)_minmax(0,1fr)_154px]">
              <Field id="its-amount" label="Billing Amount">
                <input id="its-amount" inputMode="decimal" maxLength={12} className={cn(INPUT, 'pl-2 tracking-[0.56px]')} value={f.amount}
                  onChange={e => set('amount', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="100" />
              </Field>
              <Field id="its-currency" label="Currency">
                <Select
                  id="its-currency" aria-label="Currency" value={f.currency || null} onValueChange={v => set('currency', (v ?? '') as Currency | '')}
                  options={CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
                  className={cn(GREY_SELECT, 'text-success-normal dark:text-success-normal')}
                />
              </Field>
              <Field id="its-cycle" label="Monthly/Yearly">
                <Select
                  id="its-cycle" aria-label="Monthly or yearly" value={f.billingCycle || null} onValueChange={v => set('billingCycle', (v ?? '') as BillingCycle | '')}
                  options={CYCLE_OPTIONS} className={cn(GREY_SELECT, STRONG)}
                />
              </Field>
              <Field id="its-card" label="Card (Last 4 digits)">
                <input id="its-card" maxLength={4} inputMode="numeric" pattern="[0-9]{4}" className={cn(INPUT, 'pl-2 tracking-[0.56px]')} value={f.cardLast4}
                  onChange={e => set('cardLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" />
              </Field>
            </div>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="its-s-more">
          <div className="flex flex-col gap-2">
            <h3 id="its-s-more" className={SECTION_TITLE}>Additional Info</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_122px]">
              <Field id="its-start" label="Start Date">
                <DatePicker id="its-start" aria-label="Start date" value={toDate(f.startDate)} onValueChange={d => set('startDate', toIso(d))}
                  formatValue={formatDay} placeholder="Select date" className={cn(INPUT, 'pl-2')} />
              </Field>
              <Field id="its-due" label="Due Date">
                <DatePicker id="its-due" aria-label="Due date" value={toDate(f.dueDate)} onValueChange={d => set('dueDate', toIso(d))}
                  formatValue={formatDay} placeholder="Select date" className={cn(INPUT, 'pl-2')} />
              </Field>
              <Field id="its-max" label="Maximum Users">
                <input id="its-max" type="number" min={0} max={100000} inputMode="numeric" className={cn(INPUT, 'pl-2')} value={f.seats}
                  onChange={e => set('seats', e.target.value.replace(/\D/g, ''))} placeholder="No limit" />
              </Field>
            </div>
            <Field id="its-notes" label="Notes">
              <textarea id="its-notes" maxLength={4000} className={cn(INPUT, 'h-[63px] resize-y py-1.5 pl-2')} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Type.." />
            </Field>
            {editing && (
              <label className="flex items-center gap-2 text-[13px] text-ui-body">
                <Checkbox checked={!f.active} onCheckedChange={v => set('active', !v)} />
                Cancelled (move to History)
              </label>
            )}
          </div>
        </section>

        <section className={SECTION} aria-labelledby="its-s-users">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="its-s-users" className={SECTION_TITLE}>{usersHeading(f.users)}</h3>
              <button
                type="button" onClick={() => setAdding(true)}
                className="inline-flex h-[23px] items-center gap-2 rounded-[3px] bg-accent-400 pl-2 pr-3 text-[10px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ui-focus-ring dark:text-primary-950"
              >
                <Plus size={11} strokeWidth={2.5} aria-hidden /> Add Users
              </button>
            </div>
            {f.users.length === 0 && !adding ? (
              <p className="m-0 rounded-[8px] border border-dashed border-ui-divider px-3 py-4 text-center text-[13px] text-ui-body">
                No users yet. Add people from the system, a name, or a team.
              </p>
            ) : (
              <ul className="m-0 grid max-h-[178px] list-none grid-cols-1 gap-2 overflow-y-auto p-0 pr-1 sm:grid-cols-2" aria-label="Users">
                {adding && (
                  <li className="flex min-w-0 items-center rounded-[8px] border border-accent-400 bg-ui-surface p-2">
                    <Combobox
                      id="its-add-user" aria-label="Select a person or type a name" options={options} value={null}
                      placeholder="Select or type.." emptyText="Type a name to add it"
                      onInputValueChange={setTyped}
                      onValueChange={o => { if (o) pick(o.value); }}
                      className={cn('h-[35px] w-full rounded-[6px] border-[var(--ui-input-border)] bg-primary-50 text-[14px] font-semibold dark:bg-primary-700', STRONG)}
                    />
                  </li>
                )}
                {f.users.map(u => (
                  <UserCard
                    key={userKey(u)} user={u} sizing={sizing === userKey(u)}
                    onSizing={on => setSizing(on ? userKey(u) : null)}
                    onSize={n => sizeUser(userKey(u), n)}
                    onRemove={() => removeUser(userKey(u))}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex gap-2">
          {editing && onDelete ? (
            <button type="button" onClick={onDelete} disabled={saving}
              className="h-[42px] flex-1 rounded-[6px] bg-[var(--status-t10-bg)] text-[14px] font-semibold text-[var(--status-t10-fg)] hover:opacity-90 disabled:opacity-60">
              Delete
            </button>
          ) : (
            <button type="button" onClick={onClose} disabled={saving}
              className={cn('h-[42px] flex-1 rounded-[6px] border border-[var(--ui-input-border)] text-[14px] font-semibold hover:bg-ui-hover-bg disabled:opacity-60', STRONG)}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving}
            className="h-[42px] flex-1 rounded-[6px] bg-secondary-700 text-[14px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalPanel>
  );
}
