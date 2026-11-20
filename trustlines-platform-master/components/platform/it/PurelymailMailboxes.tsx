'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, KeyRound, Mail, Plus, RefreshCw, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { FIELD, MUTED, STRONG } from './itCardParts';

// IT → Mails: the company's Purelymail mailboxes (live, /api/it/mails/purelymail). People with
// IT edit rights (edit.it) can open a new mailbox and change a mailbox's password. Passwords go
// straight to Purelymail — never stored by us, and Purelymail can't show an existing one, so a
// new password is shown in the dialog to copy before it's closed.

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; addresses: string[] }
  | { kind: 'not_configured' }
  | { kind: 'error'; message: string };

const MIN_PASSWORD = 12;
const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Purelymail refused the API key. Check PURELYMAIL_API_KEY on the server.',
  unavailable: 'Purelymail could not be reached or did not answer in time. Try again.',
  not_configured: 'Purelymail isn’t connected yet (PURELYMAIL_API_KEY is missing on the server).',
};

/** Error text for a failed call to our Purelymail routes. */
async function failureText(res: Response): Promise<string> {
  const b = await res.json().catch(() => null) as { code?: string; providerCode?: string; error?: string } | null;
  if (res.status === 401 || res.status === 403) return 'You don’t have permission to do this.';
  if (b?.error) return b.error;
  if (b?.code === 'rejected') return `Purelymail refused it${b.providerCode ? ` (${b.providerCode})` : ''} — e.g. the address is taken or the password is too weak.`;
  return ERROR_TEXT[b?.code ?? ''] ?? ERROR_TEXT.unavailable;
}

/** 16 random characters from an unambiguous set (no 0/O, 1/l/I), crypto-strong. */
function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*-_';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success('Password copied'); } catch { toast.error('Could not copy'); }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input id={id} type={shown ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={e => onChange(e.target.value)}
          className="h-10 flex-1 font-mono text-[14px]" />
        <Button type="button" variant="ghost" size="icon-md" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(s => !s)}>
          {shown ? <EyeOff /> : <Eye />}
        </Button>
        <Button type="button" variant="ghost" size="icon-md" aria-label="Copy password" disabled={!value} onClick={copy}><Copy /></Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[12px]', value && value.length < MIN_PASSWORD ? 'text-error-normal' : MUTED)}>At least {MIN_PASSWORD} characters.</span>
        <button type="button" onClick={() => { onChange(generatePassword()); setShown(true); }}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-ui-link">
          <Wand2 size={14} aria-hidden /> Generate
        </button>
      </div>
    </div>
  );
}

function NewMailboxDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [domains, setDomains] = useState<string[] | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUserName(''); setPassword(''); setRecovery(''); setCreated(null); setBusy(false);
    setDomains(null); setDomainError(null);
    (async () => {
      const res = await fetch('/api/it/mails/purelymail/domains', { cache: 'no-store' }).catch(() => null);
      if (!res) { setDomainError(ERROR_TEXT.unavailable); return; }
      if (!res.ok) { setDomainError(await failureText(res)); return; }
      const b = await res.json() as { domains: string[] };
      setDomains(b.domains);
      setDomain(b.domains[0] ?? '');
    })();
  }, [open]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/it/mails/purelymail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, domainName: domain, password, recoveryEmail: recovery || undefined }),
      });
      if (!res.ok) { toast.error(await failureText(res)); return; }
      const b = await res.json() as { address: string };
      setCreated(b.address);
      toast.success(`${b.address} is ready`);
      onCreated();
    } catch {
      toast.error(ERROR_TEXT.unavailable);
    } finally { setBusy(false); }
  }

  const valid = !!userName.trim() && !!domain && password.length >= MIN_PASSWORD;
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={created ? 'Mailbox created' : 'New mailbox'} footer={created ? (
        <ModalClose render={<Button />}>Done</ModalClose>
      ) : (
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={!valid || busy} onClick={submit}><Plus /> Create mailbox</Button>
        </>
      )}>
        {created ? (
          <div className="flex flex-col gap-3 text-[14px] text-ui-body">
            <p className="m-0"><b className={STRONG}>{created}</b> is open on Purelymail.</p>
            <p className="m-0">Copy the password now and give it to its owner — it isn’t saved anywhere and can’t be shown again.</p>
            <PasswordInput id="pm-created-pw" value={password} onChange={() => {}} />
          </div>
        ) : domainError ? (
          <p role="alert" className="m-0 text-[14px] text-error-normal">{domainError}</p>
        ) : domains === null ? (
          <p role="status" className={cn('m-0 text-[14px]', MUTED)}>Loading domains…</p>
        ) : domains.length === 0 ? (
          <p className="m-0 text-[14px] text-ui-body">The Purelymail account has no domain of its own yet — add one on Purelymail first.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Address" htmlFor="pm-user" className="[&>label]:text-[14px]">
              <div className="flex items-center gap-2">
                <Input id="pm-user" value={userName} onChange={e => setUserName(e.target.value.replace(/\s/g, ''))} placeholder="name" autoComplete="off" className="h-10 flex-1 text-[14px]" />
                <span className="text-[14px] text-ui-body">@</span>
                <Select aria-label="Domain" value={domain} onValueChange={v => setDomain(v ?? '')} options={domains.map(d => ({ value: d, label: d }))} className="h-10 w-auto min-w-[160px] text-[14px]" />
              </div>
            </Field>
            <Field label="Password" htmlFor="pm-pw" className="[&>label]:text-[14px]">
              <PasswordInput id="pm-pw" value={password} onChange={setPassword} />
            </Field>
            <Field label="Recovery email (optional)" htmlFor="pm-rec" className="[&>label]:text-[14px]">
              <Input id="pm-rec" type="email" value={recovery} onChange={e => setRecovery(e.target.value)} placeholder="Lets the owner reset a forgotten password" className="h-10 text-[14px]" />
            </Field>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}

function ChangePasswordDialog({ address, onOpenChange }: { address: string | null; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { if (address) { setPassword(''); setBusy(false); setDone(false); } }, [address]);

  async function submit() {
    if (!address) return;
    setBusy(true);
    try {
      const res = await fetch('/api/it/mails/purelymail/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, newPassword: password }),
      });
      if (!res.ok) { toast.error(await failureText(res)); return; }
      setDone(true);
      toast.success('Password changed');
    } catch {
      toast.error(ERROR_TEXT.unavailable);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={!!address} onOpenChange={onOpenChange}>
      <ModalContent title="Change password" description={address ?? undefined} footer={done ? (
        <ModalClose render={<Button />}>Done</ModalClose>
      ) : (
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={password.length < MIN_PASSWORD || busy} onClick={submit}><KeyRound /> Change password</Button>
        </>
      )}>
        <div className="flex flex-col gap-3 text-[14px] text-ui-body">
          {done
            ? <p className="m-0">Changed. Copy it now and give it to the mailbox owner — it isn’t saved anywhere. Their mail apps will ask for the new password.</p>
            : <p className="m-0">The old password stops working right away; mail apps signed in with it will ask for the new one.</p>}
          <Field label="New password" htmlFor="pm-new-pw" className="[&>label]:text-[14px]">
            <PasswordInput id="pm-new-pw" value={password} onChange={done ? () => {} : setPassword} />
          </Field>
        </div>
      </ModalContent>
    </Modal>
  );
}

export function PurelymailMailboxes({ canEdit = false }: { canEdit?: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/it/mails/purelymail', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json().catch(() => null) as { mailboxes?: { address: string }[] } | null;
        if (Array.isArray(body?.mailboxes)) { setState({ kind: 'ok', addresses: body.mailboxes.map(m => m.address) }); return; }
      }
      if (res.status === 503) { setState({ kind: 'not_configured' }); return; }
      setState({ kind: 'error', message: res.status === 401 || res.status === 403 ? 'You don’t have access to IT mailboxes.' : await failureText(res) });
    } catch {
      setState({ kind: 'error', message: ERROR_TEXT.unavailable });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connected = state.kind === 'ok';
  return (
    <section aria-labelledby="purelymail-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-solid border-primary-100 pt-6 dark:border-primary-600">
        <div className="flex flex-col gap-1">
          <h2 id="purelymail-heading" className={cn('m-0 flex items-center gap-2 text-[18px] font-semibold leading-[1.35]', STRONG)}>
            Purelymail
            {connected && (
              <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
                <span className="sr-only">Mailboxes: </span>{state.addresses.length}
              </span>
            )}
          </h2>
          <p className="m-0 text-[13px] text-ui-body">Mailboxes on the company’s Purelymail account, read live.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button" onClick={() => void load()} disabled={state.kind === 'loading'}
            className={cn(FIELD, 'inline-flex items-center gap-2 font-medium transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ui-hover-bg')}
          >
            <RefreshCw size={16} aria-hidden className={state.kind === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </button>
          {canEdit && connected && <Button variant="accent" onClick={() => setCreating(true)}><Plus /> New mailbox</Button>}
        </div>
      </div>

      {state.kind === 'loading' ? (
        <p role="status" className={cn('m-0 text-[13px]', MUTED)}>Loading mailboxes…</p>
      ) : state.kind === 'not_configured' ? (
        <div role="note" className="rounded-md border border-dashed border-primary-300 px-4 py-3 text-[13px] text-ui-body dark:border-primary-600">
          Purelymail isn’t connected yet. Add <code className="font-mono">PURELYMAIL_API_KEY</code> to the server’s environment, then refresh.
        </div>
      ) : state.kind === 'error' ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {state.message}
        </div>
      ) : state.addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-10 text-center dark:border-primary-600">
          <p className={cn('m-0 text-[15px] font-semibold', STRONG)}>No mailboxes on Purelymail</p>
          <p className="m-0 text-[13px] text-ui-body">The account is connected but has no mailboxes yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th scope="col" className="h-10 px-4 text-left text-[12px] font-semibold text-ui-body">Address</th>
                {canEdit && <th scope="col" className="h-10 w-[180px] px-4"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {state.addresses.map(a => (
                <tr key={a} className="border-b border-ui-divider last:border-b-0">
                  <td className={cn('h-11 px-4 text-[13px]', STRONG)}>
                    <span className="inline-flex items-center gap-2"><Mail size={16} aria-hidden className={MUTED} />{a}</span>
                  </td>
                  {canEdit && (
                    <td className="h-11 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setChanging(a)} aria-label={`Change password of ${a}`}><KeyRound /> Change password</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && <NewMailboxDialog open={creating} onOpenChange={setCreating} onCreated={() => void load()} />}
      {canEdit && <ChangePasswordDialog address={changing} onOpenChange={o => { if (!o) setChanging(null); }} />}
    </section>
  );
}
