'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleCheck, CircleX, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { MUTED, STRONG } from '../itCardParts';
import { PANEL_TABLE, TD, TH, copyText, pmOp, runChange } from './shared';

// Purelymail domains: DNS health (MX / SPF / DKIM / DMARC), the two domain settings, re-check DNS,
// add a domain (after its ownership TXT record is in DNS) and delete one (takes its mailboxes too).

export interface PmDomain {
  name: string; allowAccountReset: boolean; symbolicSubaddressing: boolean; isShared: boolean;
  dnsSummary: { passesMx: boolean; passesSpf: boolean; passesDkim: boolean; passesDmarc: boolean };
}

function Dns({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px] font-medium', ok ? 'text-success-normal' : 'text-error-normal')}>
      {ok ? <CircleCheck size={14} aria-hidden /> : <CircleX size={14} aria-hidden />}{label}<span className="sr-only">{ok ? ' passes' : ' fails'}</span>
    </span>
  );
}

function AddDomainDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(''); setBusy(false); setCode(null); setCodeError(null);
    pmOp<{ code: string | null }>('getOwnershipCode').then(r => setCode(r.code)).catch(e => setCodeError(e instanceof Error ? e.message : 'Could not load'));
  }, [open]);
  const add = async () => {
    setBusy(true);
    const ok = await runChange(() => pmOp('addDomain', { domainName: name }), `${name} added`);
    setBusy(false);
    if (ok) { onOpenChange(false); onAdded(); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Add domain" footer={(
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={busy || !name.trim()} onClick={add}><Plus /> Add domain</Button>
        </>
      )}>
        <div className="flex flex-col gap-4 text-[14px] text-ui-body">
          <p className="m-0">First add this <b className={STRONG}>TXT record</b> to the domain’s DNS (at the domain registrar), then add the domain here. Purelymail checks the DNS when you add it.</p>
          {codeError ? <p role="alert" className="m-0 text-error-normal">{codeError}</p>
            : code === null ? <p role="status" className={cn('m-0', MUTED)}>Loading the ownership code…</p>
              : (
                <div className="flex items-center gap-2 rounded-[6px] bg-ui-surface p-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{code}</code>
                  <Button variant="ghost" size="icon-sm" aria-label="Copy ownership code" onClick={() => copyText(code, 'Code copied')}><Copy /></Button>
                </div>
              )}
          <p className={cn('m-0 text-[12px]', MUTED)}>For mail to arrive you also need Purelymail’s MX, SPF, DKIM and DMARC records — their health shows in the list after adding.</p>
          <Field label="Domain" htmlFor="pm-domain" className="[&>label]:text-[14px]">
            <Input id="pm-domain" value={name} onChange={e => setName(e.target.value.trim().toLowerCase())} placeholder="example.com" className="h-10 text-[14px]" />
          </Field>
        </div>
      </ModalContent>
    </Modal>
  );
}

export function DomainsTab({ canEdit, domains, error, onChanged }: { canEdit: boolean; domains: PmDomain[] | null; error: string | null; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PmDomain | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const update = async (name: string, patch: Record<string, boolean>, ok: string) => {
    setBusy(name);
    if (await runChange(() => pmOp('updateDomainSettings', { name, ...patch }), ok)) onChanged();
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[13px] text-ui-body">The company’s mail domains on Purelymail and whether their DNS is set up.</p>
        {canEdit && <Button variant="secondary" onClick={() => setAdding(true)}><Plus /> Add domain</Button>}
      </div>
      {error ? <p role="alert" className="m-0 text-[13px] text-error-normal">{error}</p>
        : domains === null ? <p role="status" className={cn('m-0 text-[13px]', MUTED)}>Loading domains…</p>
          : domains.length === 0 ? <p className={cn('m-0 rounded-[8px] border border-dashed border-primary-300 px-4 py-6 text-center text-[13px] dark:border-primary-600', MUTED)}>No domains yet.</p>
            : (
              <div className={PANEL_TABLE}>
                <table className="w-full min-w-[760px] border-collapse">
                  <thead><tr className="border-b border-ui-divider bg-ui-surface">
                    <th scope="col" className={TH}>Domain</th><th scope="col" className={TH}>DNS</th>
                    <th scope="col" className={TH} title="Accounts on this domain can be used to reset a Purelymail account password">Account reset</th>
                    <th scope="col" className={TH} title="user-anything@domain is delivered to user@domain">Sub-addressing</th>
                    {canEdit && <th scope="col" className={cn(TH, 'w-[150px]')}><span className="sr-only">Actions</span></th>}
                  </tr></thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.name} className="border-b border-ui-divider last:border-b-0">
                        <td className={cn(TD, 'font-semibold', STRONG)}>{d.name}</td>
                        <td className={TD}>
                          <span className="inline-flex flex-wrap gap-2.5">
                            <Dns ok={d.dnsSummary.passesMx} label="MX" /><Dns ok={d.dnsSummary.passesSpf} label="SPF" />
                            <Dns ok={d.dnsSummary.passesDkim} label="DKIM" /><Dns ok={d.dnsSummary.passesDmarc} label="DMARC" />
                          </span>
                        </td>
                        <td className={TD}>
                          <Switch checked={d.allowAccountReset} disabled={!canEdit || busy === d.name} aria-label={`Account reset on ${d.name}`}
                            onCheckedChange={v => void update(d.name, { allowAccountReset: !!v }, 'Saved')} />
                        </td>
                        <td className={TD}>
                          <Switch checked={d.symbolicSubaddressing} disabled={!canEdit || busy === d.name} aria-label={`Sub-addressing on ${d.name}`}
                            onCheckedChange={v => void update(d.name, { symbolicSubaddressing: !!v }, 'Saved')} />
                        </td>
                        {canEdit && (
                          <td className={cn(TD, 'whitespace-nowrap text-right')}>
                            <Button variant="ghost" size="sm" disabled={busy === d.name} onClick={() => void update(d.name, { recheckDns: true }, 'DNS re-checked')}>
                              <RefreshCw /> Check DNS
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${d.name}`} onClick={() => { setConfirmText(''); setRemoving(d); }}><Trash2 className="text-error-normal" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      {canEdit && <AddDomainDialog open={adding} onOpenChange={setAdding} onAdded={onChanged} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive" confirmLabel="Delete domain and its mailboxes"
        title={`Delete ${removing?.name ?? 'this domain'}?`}
        warning="Every mailbox on this domain, its mail and its settings are deleted on Purelymail. This can’t be undone."
        onConfirm={async () => {
          if (!removing) return;
          if (confirmText.trim().toLowerCase() !== removing.name) { toast.error('Type the domain name to confirm'); throw new Error('kept'); }
          if (!(await runChange(() => pmOp('deleteDomain', { name: removing.name }), `${removing.name} deleted`))) throw new Error('kept');
          setRemoving(null); onChanged();
        }}>
        <Field label={`Type ${removing?.name ?? ''} to confirm`} htmlFor="pm-del-domain">
          <Input id="pm-del-domain" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmModal>
    </div>
  );
}
