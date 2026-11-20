'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownUp, Ellipsis, KeyRound, Mail, Plus, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { FIELD, MUTED, STRONG, tabClass } from './itCardParts';
import { ERROR_TEXT, MIN_PASSWORD, PANEL_TABLE, PasswordInput, TD, TH, failureText, pmOp, runChange } from './purelymail/shared';
import { MailboxManageDialog } from './purelymail/MailboxManageDialog';
import { RoutingTab } from './purelymail/RoutingTab';
import { DomainsTab, type PmDomain } from './purelymail/DomainsTab';

// IT → Mails → Purelymail: the company's mail account, managed from here so nobody needs to open
// Purelymail. Mailboxes (search / sort / domain filter; new, manage, change password, delete),
// routing rules and domains, plus the account credit. Reading needs page.it, changes edit.it —
// both checked again on the server before Purelymail is called. Passwords are never stored.

type ListState = { kind: 'loading' } | { kind: 'ok'; addresses: string[] } | { kind: 'not_configured' } | { kind: 'error'; message: string };
type Tab = 'mailboxes' | 'routing' | 'domains';
type Sort = 'az' | 'za' | 'domain';
const SORT_OPTIONS = [{ value: 'az', label: 'A → Z' }, { value: 'za', label: 'Z → A' }, { value: 'domain', label: 'By domain' }];
const domainOf = (a: string) => a.slice(a.lastIndexOf('@') + 1);

function NewMailboxDialog({ open, domains, onOpenChange, onCreated }: { open: boolean; domains: string[]; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [userName, setUserName] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  useEffect(() => { if (open) { setUserName(''); setPassword(''); setRecovery(''); setCreated(null); setBusy(false); setDomain(domains[0] ?? ''); } }, [open, domains]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/it/mails/purelymail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, domainName: domain, password, recoveryEmail: recovery || undefined }),
      });
      if (!res.ok) { toast.error(await failureText(res)); return; }
      const b = await res.json() as { address: string };
      setCreated(b.address); toast.success(`${b.address} is ready`); onCreated();
    } catch { toast.error(ERROR_TEXT.unavailable); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={created ? 'Mailbox created' : 'New mailbox'} footer={created ? <ModalClose render={<Button />}>Done</ModalClose> : (
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={busy || !userName.trim() || !domain || password.length < MIN_PASSWORD} onClick={submit}><Plus /> Create mailbox</Button>
        </>
      )}>
        {created ? (
          <div className="flex flex-col gap-3 text-[14px] text-ui-body">
            <p className="m-0"><b className={STRONG}>{created}</b> is open on Purelymail.</p>
            <p className="m-0">Copy the password now and give it to its owner — it isn’t saved anywhere and can’t be shown again.</p>
            <PasswordInput id="pm-created-pw" value={password} readOnly />
          </div>
        ) : domains.length === 0 ? (
          <p className="m-0 text-[14px] text-ui-body">Add a domain first (Domains tab).</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Address" htmlFor="pm-user" className="[&>label]:text-[14px]">
              <div className="flex items-center gap-2">
                <Input id="pm-user" value={userName} onChange={e => setUserName(e.target.value.replace(/\s/g, ''))} placeholder="name" autoComplete="off" className="h-10 flex-1 text-[14px]" />
                <span className="text-[14px] text-ui-body">@</span>
                <Select aria-label="Domain" value={domain} onValueChange={v => setDomain(v ?? '')} options={domains.map(d => ({ value: d, label: d }))} className="h-10 w-auto min-w-[160px] text-[14px]" />
              </div>
            </Field>
            <Field label="Password" htmlFor="pm-pw" className="[&>label]:text-[14px]"><PasswordInput id="pm-pw" value={password} onChange={setPassword} /></Field>
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
      const res = await fetch('/api/it/mails/purelymail/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, newPassword: password }) });
      if (!res.ok) { toast.error(await failureText(res)); return; }
      setDone(true); toast.success('Password changed');
    } catch { toast.error(ERROR_TEXT.unavailable); } finally { setBusy(false); }
  }
  return (
    <Modal open={!!address} onOpenChange={onOpenChange}>
      <ModalContent title="Change password" description={address ?? undefined} footer={done ? <ModalClose render={<Button />}>Done</ModalClose> : (
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={password.length < MIN_PASSWORD || busy} onClick={submit}><KeyRound /> Change password</Button>
        </>
      )}>
        <div className="flex flex-col gap-3 text-[14px] text-ui-body">
          <p className="m-0">{done ? 'Changed. Copy it now and give it to the owner — it isn’t saved anywhere.' : 'The old password stops working right away; mail apps will ask for the new one.'}</p>
          <Field label="New password" htmlFor="pm-new-pw" className="[&>label]:text-[14px]">
            <PasswordInput id="pm-new-pw" value={password} onChange={setPassword} readOnly={done} />
          </Field>
        </div>
      </ModalContent>
    </Modal>
  );
}

export function PurelymailMailboxes({ canEdit = false, openNew = 0 }: {
  canEdit?: boolean;
  /** Bumped by the page's 'New Email' button: open New mailbox. */
  openNew?: number;
}) {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [domains, setDomains] = useState<PmDomain[] | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [credit, setCredit] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('mailboxes');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('az');
  const [domainFilter, setDomainFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const loadList = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/it/mails/purelymail', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json().catch(() => null) as { mailboxes?: { address: string }[] } | null;
        if (Array.isArray(body?.mailboxes)) { setState({ kind: 'ok', addresses: body.mailboxes.map(m => m.address) }); return true; }
      }
      if (res.status === 503) { setState({ kind: 'not_configured' }); return false; }
      setState({ kind: 'error', message: res.status === 401 || res.status === 403 ? 'You don’t have access to IT mailboxes.' : await failureText(res) });
    } catch { setState({ kind: 'error', message: ERROR_TEXT.unavailable }); }
    return false;
  }, []);
  const loadDomains = useCallback(async () => {
    setDomainError(null);
    try { setDomains((await pmOp<{ domains: PmDomain[] }>('listDomains')).domains); } catch (e) { setDomainError(e instanceof Error ? e.message : 'Could not load'); setDomains([]); }
  }, []);
  const loadAll = useCallback(async () => {
    if (!(await loadList())) return;
    void loadDomains();
    pmOp<{ credit: string | null }>('checkAccountCredit').then(r => setCredit(r.credit)).catch(() => setCredit(null));
  }, [loadList, loadDomains]);
  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!openNew || !canEdit) return;
    if (state.kind === 'ok') { setTab('mailboxes'); setCreating(true); }
    else if (state.kind === 'not_configured') toast.error(ERROR_TEXT.not_configured);
  }, [openNew]);

  const ownDomains = useMemo(() => (domains ?? []).filter(d => !d.isShared).map(d => d.name), [domains]);
  const addresses = useMemo(() => (state.kind === 'ok' ? state.addresses : []), [state]);
  const filterOptions = useMemo(() => {
    const names = [...new Set([...ownDomains, ...addresses.map(domainOf)])].sort();
    return [{ value: '', label: 'All domains' }, ...names.map(n => ({ value: n, label: n }))];
  }, [ownDomains, addresses]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return addresses
      .filter(a => (!domainFilter || domainOf(a) === domainFilter) && (!q || a.toLowerCase().includes(q)))
      .sort((a, b) => sort === 'za' ? b.localeCompare(a) : sort === 'domain' ? domainOf(a).localeCompare(domainOf(b)) || a.localeCompare(b) : a.localeCompare(b));
  }, [addresses, query, domainFilter, sort]);

  const connected = state.kind === 'ok';
  return (
    <section aria-labelledby="purelymail-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-solid border-primary-100 pt-6 dark:border-primary-600">
        <div className="flex flex-col gap-1">
          <h2 id="purelymail-heading" className={cn('m-0 flex items-center gap-2 text-[18px] font-semibold leading-[1.35]', STRONG)}>
            Purelymail
            {connected && (
              <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
                <span className="sr-only">Mailboxes: </span>{addresses.length}
              </span>
            )}
          </h2>
          <p className="m-0 text-[13px] text-ui-body">
            The company’s mail account, live from Purelymail.{credit !== null && <> Account credit: <b className={STRONG}>${Number(credit).toFixed(2)}</b></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void loadAll()} disabled={state.kind === 'loading'}
            className={cn(FIELD, 'inline-flex items-center gap-2 font-medium transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ui-hover-bg')}>
            <RefreshCw size={16} aria-hidden className={state.kind === 'loading' ? 'animate-spin' : undefined} /> Refresh
          </button>
          {canEdit && connected && tab === 'mailboxes' && <Button variant="accent" onClick={() => setCreating(true)}><Plus /> New mailbox</Button>}
        </div>
      </div>

      {state.kind === 'loading' ? <p role="status" className={cn('m-0 text-[13px]', MUTED)}>Loading mailboxes…</p>
        : state.kind === 'not_configured' ? (
          <div role="note" className="rounded-md border border-dashed border-primary-300 px-4 py-3 text-[13px] text-ui-body dark:border-primary-600">
            Purelymail isn’t connected yet. Add <code className="font-mono">PURELYMAIL_API_KEY</code> to the server’s environment, then refresh.
          </div>
        ) : state.kind === 'error' ? (
          <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">{state.message}</div>
        ) : (
          <>
            <div role="tablist" aria-label="Purelymail" className="flex h-11 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
              {([['mailboxes', 'Mailboxes'], ['routing', 'Routing'], ['domains', 'Domains']] as const).map(([k, label]) => (
                <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={tabClass(tab === k)}>{label}</button>
              ))}
            </div>

            {tab === 'routing' ? <RoutingTab canEdit={canEdit} domains={ownDomains} />
              : tab === 'domains' ? <DomainsTab canEdit={canEdit} domains={domains} error={domainError} onChanged={() => void loadDomains()} />
                : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="relative flex w-[320px] max-w-full items-center">
                        <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
                        <span className="sr-only">Search mailboxes</span>
                        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search addresses…"
                          className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')} />
                      </label>
                      <div className="relative">
                        <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
                        <Select aria-label="Sort mailboxes" className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')} value={sort} onValueChange={v => setSort((v ?? 'az') as Sort)} options={SORT_OPTIONS} />
                      </div>
                      <Select aria-label="Filter by domain" className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')} value={domainFilter} onValueChange={v => setDomainFilter(v ?? '')} options={filterOptions} />
                      {(query || domainFilter) && <span className={cn('text-[12px]', MUTED)}>{visible.length} of {addresses.length}</span>}
                    </div>

                    {addresses.length === 0 ? (
                      <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-10 text-center dark:border-primary-600">
                        <p className={cn('m-0 text-[15px] font-semibold', STRONG)}>No mailboxes on Purelymail</p>
                        <p className="m-0 text-[13px] text-ui-body">The account is connected but has no mailboxes yet.</p>
                      </div>
                    ) : visible.length === 0 ? (
                      <p className={cn('m-0 rounded-[8px] border border-dashed border-primary-300 px-4 py-6 text-center text-[13px] dark:border-primary-600', MUTED)}>No mailbox matches these filters.</p>
                    ) : (
                      <div className={PANEL_TABLE}>
                        <table className="w-full border-collapse">
                          <thead><tr className="border-b border-ui-divider bg-ui-surface">
                            <th scope="col" className={TH}>Address</th><th scope="col" className={TH}>Domain</th>
                            <th scope="col" className={cn(TH, 'w-[60px]')}><span className="sr-only">Actions</span></th>
                          </tr></thead>
                          <tbody>
                            {visible.map(a => (
                              <tr key={a} className="border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg">
                                <td className={cn(TD, STRONG)}>
                                  <button type="button" onClick={() => setManaging(a)} className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-medium text-inherit hover:underline">
                                    <Mail size={16} aria-hidden className={MUTED} />{a}
                                  </button>
                                </td>
                                <td className={TD}>{domainOf(a)}</td>
                                <td className={cn(TD, 'text-right')}>
                                  <Menu>
                                    <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a}`} />}><Ellipsis /></MenuTrigger>
                                    <MenuContent>
                                      <MenuItem onClick={() => setManaging(a)}><Settings2 /> {canEdit ? 'Manage' : 'Details'}</MenuItem>
                                      {canEdit && <MenuItem onClick={() => setChanging(a)}><KeyRound /> Change password</MenuItem>}
                                      {canEdit && (<><MenuSeparator /><MenuItem variant="destructive" onClick={() => { setConfirmText(''); setDeleting(a); }}><Trash2 /> Delete mailbox</MenuItem></>)}
                                    </MenuContent>
                                  </Menu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
          </>
        )}

      {canEdit && <NewMailboxDialog open={creating} domains={ownDomains} onOpenChange={setCreating} onCreated={() => void loadList()} />}
      {canEdit && <ChangePasswordDialog address={changing} onOpenChange={o => { if (!o) setChanging(null); }} />}
      <MailboxManageDialog address={managing} canEdit={canEdit} onOpenChange={o => { if (!o) setManaging(null); }}
        onRenamed={to => { setManaging(to); void loadList(); }} />
      <ConfirmModal open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }} tone="destructive" confirmLabel="Delete mailbox"
        title={`Delete ${deleting ?? 'this mailbox'}?`}
        warning="The mailbox and all its mail are deleted on Purelymail. This can’t be undone."
        onConfirm={async () => {
          if (!deleting) return;
          if (confirmText.trim().toLowerCase() !== deleting) { toast.error('Type the address to confirm'); throw new Error('kept'); }
          if (!(await runChange(() => pmOp('deleteUser', { userName: deleting }), `${deleting} deleted`))) throw new Error('kept');
          setDeleting(null); void loadList();
        }}>
        <Field label={`Type ${deleting ?? ''} to confirm`} htmlFor="pm-del-user">
          <Input id="pm-del-user" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmModal>
    </section>
  );
}
