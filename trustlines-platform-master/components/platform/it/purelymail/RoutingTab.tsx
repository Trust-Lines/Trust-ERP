'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { MUTED, STRONG } from '../itCardParts';
import { PANEL_TABLE, TD, TH, pmOp, runChange } from './shared';

// Purelymail routing rules: forward mail sent to an address (or every address starting with it,
// or anything not matching a mailbox) to one or more other addresses.

interface Rule { id: number; domainName: string; prefix: boolean; matchUser: string; targetAddresses: string[]; catchall: boolean }

function describe(r: Rule) {
  if (r.catchall) return `anything else @${r.domainName}`;
  if (r.prefix) return r.matchUser ? `${r.matchUser}…@${r.domainName}` : `everything @${r.domainName}`;
  return `${r.matchUser}@${r.domainName}`;
}

function NewRuleDialog({ open, domains, onOpenChange, onSaved }: { open: boolean; domains: string[]; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [domainName, setDomain] = useState('');
  const [matchUser, setMatchUser] = useState('');
  const [kind, setKind] = useState<'exact' | 'prefix' | 'catchall'>('exact');
  const [targets, setTargets] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDomain(domains[0] ?? ''); setMatchUser(''); setKind('exact'); setTargets(''); setBusy(false); } }, [open, domains]);

  const save = async () => {
    setBusy(true);
    const ok = await runChange(() => pmOp('createRoutingRule', {
      domainName, matchUser: kind === 'catchall' ? '' : matchUser, prefix: kind !== 'exact', catchall: kind === 'catchall',
      targetAddresses: targets.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean),
    }), 'Routing rule added');
    setBusy(false);
    if (ok) { onOpenChange(false); onSaved(); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="New routing rule" footer={(
        <>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button loading={busy} disabled={busy || !domainName || !targets.trim() || (kind === 'exact' && !matchUser.trim())} onClick={save}><Plus /> Add rule</Button>
        </>
      )}>
        <div className="flex flex-col gap-4">
          <Field label="Mail sent to" htmlFor="pm-rule-user" className="[&>label]:text-[14px]">
            <div className="flex items-center gap-2">
              <Input id="pm-rule-user" value={kind === 'catchall' ? '' : matchUser} disabled={kind === 'catchall'} onChange={e => setMatchUser(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder={kind === 'catchall' ? 'any address' : 'info'} className="h-10 flex-1 text-[14px]" />
              <span className="text-[14px] text-ui-body">@</span>
              <Select aria-label="Domain" value={domainName} onValueChange={v => setDomain(v ?? '')} options={domains.map(d => ({ value: d, label: d }))} className="h-10 w-auto min-w-[160px] text-[14px]" />
            </div>
          </Field>
          <Field label="Match" htmlFor="pm-rule-kind" className="[&>label]:text-[14px]">
            <Select id="pm-rule-kind" value={kind} onValueChange={v => setKind((v as typeof kind) ?? 'exact')} className="h-10 text-[14px]" options={[
              { value: 'exact', label: 'Exactly this address' },
              { value: 'prefix', label: 'Every address starting with it' },
              { value: 'catchall', label: 'Catch-all: any address that isn’t a mailbox' },
            ]} />
          </Field>
          <Field label="Forward to" htmlFor="pm-rule-targets" className="[&>label]:text-[14px]">
            <Input id="pm-rule-targets" value={targets} onChange={e => setTargets(e.target.value)} placeholder="ali@trust-lines.com, ayse@trust-lines.com" className="h-10 text-[14px]" />
          </Field>
        </div>
      </ModalContent>
    </Modal>
  );
}

export function RoutingTab({ canEdit, domains }: { canEdit: boolean; domains: string[] }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Rule | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setRules((await pmOp<{ rules: Rule[] }>('listRoutingRules')).rules); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); setRules([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[13px] text-ui-body">Forward mail from one address to others — e.g. info@ to the sales team.</p>
        {canEdit && <Button variant="secondary" disabled={!domains.length} onClick={() => setAdding(true)}><Plus /> New rule</Button>}
      </div>
      {error ? <p role="alert" className="m-0 text-[13px] text-error-normal">{error}</p>
        : rules === null ? <p role="status" className={cn('m-0 text-[13px]', MUTED)}>Loading rules…</p>
          : rules.length === 0 ? <p className={cn('m-0 rounded-[8px] border border-dashed border-primary-300 px-4 py-6 text-center text-[13px] dark:border-primary-600', MUTED)}>No routing rules.</p>
            : (
              <div className={PANEL_TABLE}>
                <table className="w-full min-w-[560px] border-collapse">
                  <thead><tr className="border-b border-ui-divider bg-ui-surface">
                    <th scope="col" className={TH}>Mail sent to</th><th scope="col" className={TH}>Goes to</th>
                    {canEdit && <th scope="col" className={cn(TH, 'w-[60px]')}><span className="sr-only">Actions</span></th>}
                  </tr></thead>
                  <tbody>
                    {rules.map(r => (
                      <tr key={r.id} className="border-b border-ui-divider last:border-b-0">
                        <td className={cn(TD, STRONG)}>{describe(r)}</td>
                        <td className={TD}><span className="inline-flex flex-wrap items-center gap-1"><ArrowRight size={14} aria-hidden className={MUTED} />{r.targetAddresses.join(', ')}</span></td>
                        {canEdit && (
                          <td className={cn(TD, 'text-right')}>
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete rule for ${describe(r)}`} onClick={() => setRemoving(r)}><Trash2 className="text-error-normal" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      {canEdit && <NewRuleDialog open={adding} domains={domains} onOpenChange={setAdding} onSaved={() => void load()} />}
      <ConfirmModal open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive" confirmLabel="Delete rule"
        title="Delete this routing rule?" description={removing ? `${describe(removing)} → ${removing.targetAddresses.join(', ')}` : undefined}
        warning="Mail to that address stops being forwarded right away."
        onConfirm={async () => { if (!removing) return; if (!(await runChange(() => pmOp('deleteRoutingRule', { routingRuleId: removing.id }), 'Rule deleted'))) throw new Error('kept'); setRemoving(null); void load(); }} />
    </div>
  );
}
