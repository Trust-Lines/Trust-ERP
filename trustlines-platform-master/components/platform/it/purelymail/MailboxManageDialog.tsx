'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Modal, ModalClose, ModalContent } from '@/components/ui/modal';
import { MUTED, STRONG } from '../itCardParts';
import { PasswordInput, SettingRow, pmOp, runChange } from './shared';

// One Purelymail mailbox, everything Purelymail lets us change besides its password:
// settings (getUser / modifyUser), rename, password-reset methods, app passwords.

interface ResetMethod { type: string; target: string; description: string; allowMfaReset: boolean }
interface UserInfo {
  enableSearchIndexing: boolean; recoveryEnabled: boolean; requireTwoFactorAuthentication: boolean;
  enableSpamFiltering: boolean; resetMethods: ResetMethod[];
}

const SECTION = 'flex flex-col gap-2';
const H3 = cn('m-0 text-[13px] font-semibold uppercase tracking-[0.02em]', MUTED);

export function MailboxManageDialog({ address, canEdit, onOpenChange, onRenamed }: {
  address: string | null; canEdit: boolean; onOpenChange: (o: boolean) => void; onRenamed: (to: string) => void;
}) {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [method, setMethod] = useState<{ type: 'email' | 'phone'; target: string; description: string }>({ type: 'email', target: '', description: '' });
  const [appName, setAppName] = useState('');
  const [appPassword, setAppPassword] = useState<string | null>(null);
  const [revoke, setRevoke] = useState('');

  const load = useCallback(async (a: string) => {
    setError(null);
    try { setInfo(await pmOp<UserInfo>('getUser', { userName: a })); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => {
    if (!address) return;
    setInfo(null); setNewName(address); setAppPassword(null); setAppName(''); setRevoke('');
    setMethod({ type: 'email', target: '', description: '' });
    void load(address);
  }, [address, load]);

  if (!address) return null;
  const change = async (f: () => Promise<unknown>, ok: string, reload = true) => {
    setBusy(true);
    const done = await runChange(f, ok);
    if (done && reload) await load(address);
    setBusy(false);
    return done;
  };
  const toggle = (key: 'enableSearchIndexing' | 'requireTwoFactorAuthentication' | 'enablePasswordReset', on: boolean, label: string) =>
    change(() => pmOp('modifyUser', { userName: address, [key]: on }), `${label} ${on ? 'on' : 'off'}`);

  return (
    <Modal open onOpenChange={onOpenChange}>
      <ModalContent title="Manage mailbox" description={address} footer={<ModalClose render={<Button />}>Done</ModalClose>}>
        {error ? <p role="alert" className="m-0 text-[14px] text-error-normal">{error}</p>
          : !info ? <p role="status" className={cn('m-0 text-[14px]', MUTED)}>Loading…</p>
            : (
              <div className="flex max-h-[65vh] flex-col gap-6 overflow-y-auto pr-1">
                <section className={SECTION} aria-label="Settings">
                  <h3 className={H3}>Settings</h3>
                  <div>
                    <SettingRow label="Require two-factor sign-in" hint="The owner must set up 2FA to sign in.">
                      <Switch checked={info.requireTwoFactorAuthentication} disabled={!canEdit || busy}
                        onCheckedChange={v => void toggle('requireTwoFactorAuthentication', !!v, 'Two-factor requirement')} aria-label="Require two-factor sign-in" />
                    </SettingRow>
                    <SettingRow label="Self-service password reset" hint="The owner can reset a forgotten password through a reset method below.">
                      <Switch checked={info.recoveryEnabled} disabled={!canEdit || busy}
                        onCheckedChange={v => void toggle('enablePasswordReset', !!v, 'Password reset')} aria-label="Self-service password reset" />
                    </SettingRow>
                    <SettingRow label="Search indexing" hint="Lets the owner search mail contents. New indexes take a while to build.">
                      <Switch checked={info.enableSearchIndexing} disabled={!canEdit || busy}
                        onCheckedChange={v => void toggle('enableSearchIndexing', !!v, 'Search indexing')} aria-label="Search indexing" />
                    </SettingRow>
                    <SettingRow label="Spam filtering" hint="Set on Purelymail itself; shown here for reference.">
                      <span className={cn('text-[13px] font-medium', STRONG)}>{info.enableSpamFiltering ? 'On' : 'Off'}</span>
                    </SettingRow>
                  </div>
                </section>

                {canEdit && (
                  <section className={SECTION} aria-label="Rename">
                    <h3 className={H3}>Address</h3>
                    <div className="flex items-center gap-2">
                      <Input aria-label="New address" value={newName} onChange={e => setNewName(e.target.value.trim().toLowerCase())} className="h-10 flex-1 text-[14px]" />
                      <Button variant="secondary" disabled={busy || !newName || newName === address}
                        onClick={async () => { if (await change(() => pmOp('modifyUser', { userName: address, newUserName: newName }), `Renamed to ${newName}`, false)) onRenamed(newName); }}>
                        Rename
                      </Button>
                    </div>
                    <p className={cn('m-0 text-[12px]', MUTED)}>The owner signs in with the new address afterwards. Mail to the old one stops arriving unless you add a routing rule.</p>
                  </section>
                )}

                <section className={SECTION} aria-label="Password reset methods">
                  <h3 className={H3}>Password reset methods</h3>
                  {info.resetMethods.length === 0
                    ? <p className={cn('m-0 text-[13px]', MUTED)}>None yet.</p>
                    : (
                      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {info.resetMethods.map(m => (
                          <li key={m.target} className="flex items-center justify-between gap-2 rounded-[6px] border border-ui-divider px-3 py-2 text-[13px]">
                            <span className="min-w-0"><b className={STRONG}>{m.type === 'phone' ? 'Phone' : 'Email'}</b> · {m.target}{m.description ? ` · ${m.description}` : ''}</span>
                            {canEdit && (
                              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.target}`} disabled={busy}
                                onClick={() => void change(() => pmOp('deletePasswordReset', { userName: address, target: m.target }), 'Reset method removed')}>
                                <Trash2 className="text-error-normal" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select aria-label="Reset method type" value={method.type} onValueChange={v => setMethod(m => ({ ...m, type: (v === 'phone' ? 'phone' : 'email') }))}
                        options={[{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }]} className="h-10 w-auto min-w-[100px] text-[14px]" />
                      <Input aria-label="Reset email or phone" value={method.target} onChange={e => setMethod(m => ({ ...m, target: e.target.value }))}
                        placeholder={method.type === 'email' ? 'personal@example.com' : '+90 555 000 00 00'} className="h-10 min-w-[180px] flex-1 text-[14px]" />
                      <Input aria-label="Description" value={method.description} onChange={e => setMethod(m => ({ ...m, description: e.target.value }))}
                        placeholder="Note (optional)" className="h-10 w-[150px] text-[14px]" />
                      <Button variant="secondary" disabled={busy || !method.target.trim()}
                        onClick={async () => { if (await change(() => pmOp('upsertPasswordReset', { userName: address, ...method }), 'Reset method saved')) setMethod(m => ({ ...m, target: '', description: '' })); }}>
                        <Plus /> Add
                      </Button>
                    </div>
                  )}
                </section>

                {canEdit && (
                  <section className={SECTION} aria-label="App passwords">
                    <h3 className={H3}>App passwords</h3>
                    <p className={cn('m-0 text-[12px]', MUTED)}>A separate password for one mail app (phone, Outlook), so the main password isn’t typed there. Purelymail shows it only once.</p>
                    <div className="flex items-center gap-2">
                      <Input aria-label="App password name" value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g. iPhone Mail" className="h-10 flex-1 text-[14px]" />
                      <Button variant="secondary" disabled={busy}
                        onClick={() => void change(async () => {
                          const r = await pmOp<{ appPassword: string | null }>('createAppPassword', { userHandle: address, name: appName });
                          setAppPassword(r.appPassword); setAppName('');
                        }, 'App password created', false)}>
                        <KeyRound /> Create
                      </Button>
                    </div>
                    {appPassword && (
                      <div className="flex flex-col gap-1.5 rounded-[6px] bg-ui-surface p-3">
                        <span className="text-[12px] font-medium text-ui-heading">Copy it now — it won’t be shown again.</span>
                        <PasswordInput id="pm-app-pw" value={appPassword} readOnly />
                      </div>
                    )}
                    <Field label="Revoke an app password" htmlFor="pm-revoke" className="[&>label]:text-[13px]">
                      <div className="flex items-center gap-2">
                        <Input id="pm-revoke" value={revoke} onChange={e => setRevoke(e.target.value)} placeholder="Paste the app password to revoke" className="h-10 flex-1 font-mono text-[14px]" />
                        <Button variant="outline-destructive" disabled={busy || !revoke.trim()}
                          onClick={async () => { if (await change(() => pmOp('deleteAppPassword', { userName: address, appPassword: revoke }), 'App password revoked', false)) setRevoke(''); }}>
                          Revoke
                        </Button>
                      </div>
                    </Field>
                  </section>
                )}
              </div>
            )}
      </ModalContent>
    </Modal>
  );
}
