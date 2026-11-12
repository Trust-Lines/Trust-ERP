'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { normalizeSign, normalizeStatus } from '@/lib/production/statuses';
import type { PItem } from '@/lib/excel/projectsExcelExport';

// Production tracker quick filters (Trust System FilterBar right side): To do / Receive Follow Up
// (Today's PFs flags), the sign-waiting and status chips, Groups (PF groups) — and the Edit window
// for the flags and groups. Flags and groups live in T-ERP (migration 152, /api/production/flags).

export interface PfFlag { id: string; kind: 'PF' | 'ORDER' | 'FOLLOWUP'; projectId: string; projectCode: string; projectName: string; type: string; itemId: string | null; completedAt: string | null; createdAt: string }
export interface PfGroup { id: string; number: number; members: { id: string; rank: number; projectId: string; projectCode: string; type: string }[] }

export type QuickToken = 'TODO' | 'FOLLOWUP' | 'PO_TLINES' | 'PO_T' | 'PF_T' | 'TO_ORDER' | 'BOOKS_IN_PROGRESS' | 'GROUPS';

const SIGN_CHIPS: { token: QuickToken; label: string; title: string }[] = [
  { token: 'PO_TLINES', label: 'PO Waiting T-Lines', title: 'PO status: Waiting T Lines to sign' },
  { token: 'PO_T', label: 'PO Waiting T', title: 'PO status: Waiting T to sign' },
  { token: 'PF_T', label: 'PF Waiting T', title: 'PF status: Waiting T to sign' },
  { token: 'TO_ORDER', label: 'To Order', title: 'Status: To Order' },
  { token: 'BOOKS_IN_PROGRESS', label: 'Books in Progress', title: 'Status: Books in Progress' },
];

export function useProductionFlags() {
  const [flags, setFlags] = useState<PfFlag[]>([]);
  const [groups, setGroups] = useState<PfGroup[]>([]);
  const load = useCallback(async () => {
    const r = await fetch('/api/production/flags').then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) { setFlags(r.flags ?? []); setGroups(r.groups ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { flags, groups, reload: load };
}

const key = (projectId: string | null | undefined, type: string | null | undefined) => `${projectId ?? ''}|${String(type ?? '').trim().toLowerCase()}`;

/**
 * Row test for the quick filters (Trust System rules): To do / Follow Up keep rows whose
 * project + type (or PF row) is flagged; the sign / status chips keep rows matching ANY of them;
 * Groups keeps project + types in a PF group. Active groups of chips combine with AND.
 */
export function makeQuickMatcher(tokens: Set<QuickToken>, flags: PfFlag[], groups: PfGroup[]) {
  const flagKinds = new Set<string>([...(tokens.has('TODO') ? ['PF'] : []), ...(tokens.has('FOLLOWUP') ? ['FOLLOWUP'] : [])]);
  const flagged = new Set<string>();
  for (const f of flags) if (flagKinds.has(f.kind)) flagged.add(f.itemId ? `item:${f.itemId}` : key(f.projectId, f.type));
  const grouped = new Set(groups.flatMap(g => g.members.map(m => key(m.projectId, m.type))));
  const sign = SIGN_CHIPS.map(c => c.token).filter(t => tokens.has(t));
  return (it: PItem) => {
    if (flagKinds.size && !(flagged.has(key(it.projectId, it.type)) || (it.id && flagged.has(`item:${it.id}`)))) return false;
    if (sign.length && !sign.some(t =>
      t === 'PO_TLINES' ? normalizeSign(it.poSignStatus) === 'WAITING_TLINES_TO_SIGN'
        : t === 'PO_T' ? normalizeSign(it.poSignStatus) === 'WAITING_T_TO_SIGN'
        : t === 'PF_T' ? normalizeSign(it.pfSignStatus) === 'WAITING_T_TO_SIGN'
        : t === 'TO_ORDER' ? normalizeStatus(it.status) === 'TO_ORDER'
        : normalizeStatus(it.status) === 'BOOKS_IN_PROGRESS')) return false;
    if (tokens.has('GROUPS') && !grouped.has(key(it.projectId, it.type))) return false;
    return true;
  };
}

const CHIP = 'inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[6px] border px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ui-focus-ring';
function Count({ n }: { n: number }) {
  return <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[var(--color-secondary-700)] px-1 text-[11px] font-semibold text-white dark:bg-ui-heading dark:text-ui-page-bg">{n}</span>;
}

export function QuickChips({ tokens, onToggle, flags, groups }: { tokens: Set<QuickToken>; onToggle: (t: QuickToken) => void; flags: PfFlag[]; groups: PfGroup[] }) {
  const chips: { token: QuickToken; label: string; title: string; count?: number }[] = [
    { token: 'TODO', label: 'To do', title: "Only today's flagged PFs", count: flags.filter(f => f.kind === 'PF').length },
    { token: 'FOLLOWUP', label: 'Receive Follow Up', title: 'Only PFs being followed up', count: flags.filter(f => f.kind === 'FOLLOWUP').length },
    ...SIGN_CHIPS,
    { token: 'GROUPS', label: 'Groups', title: 'Only project types in a PF group', count: groups.length },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick filters">
      {chips.map(c => {
        const on = tokens.has(c.token);
        return (
          <button key={c.token} type="button" title={c.title} aria-pressed={on} onClick={() => onToggle(c.token)}
            className={cn(CHIP, on
              ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
              : 'border-ui-input-border bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading')}>
            {c.label}{c.count ? <Count n={c.count} /> : null}
          </button>
        );
      })}
    </div>
  );
}

const KIND_LABEL: Record<PfFlag['kind'], string> = { PF: 'To do', FOLLOWUP: 'Receive Follow Up', ORDER: 'Order' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

/** "Edit": Today's PFs & Follow Up flags and the PF groups. */
export function FlagsManageModal({ open, onOpenChange, flags, groups, canEdit, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; flags: PfFlag[]; groups: PfGroup[]; canEdit: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const byKind = useMemo(() => (['PF', 'FOLLOWUP', 'ORDER'] as const).map(k => ({ kind: k, rows: flags.filter(f => f.kind === k) })).filter(g => g.rows.length), [flags]);

  async function call(id: string, url: string, init: RequestInit, ok: string) {
    setBusy(id);
    const res = await fetch(url, init).catch(() => null);
    setBusy(null);
    if (!res?.ok) { toast.error('Could not save'); return; }
    toast.success(ok);
    onChanged();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg" title="Today's PFs, Follow Up & Groups"
        description="The flags and groups the To do, Receive Follow Up and Groups filters use."
        footer={<ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Close</ModalClose>}>
        <div className="flex flex-col gap-5">
          {byKind.length === 0 && <p className="m-0 text-[13px] text-ui-text-secondary">No flags yet.</p>}
          {byKind.map(g => (
            <section key={g.kind} className="flex flex-col gap-1.5">
              <h3 className="m-0 text-[13px] font-semibold text-ui-heading">{KIND_LABEL[g.kind]} <span className="font-normal text-ui-text-secondary">({g.rows.length})</span></h3>
              <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider rounded-[6px] border border-ui-divider p-0">
                {g.rows.map(f => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <span className={cn('min-w-0 flex-1 truncate', f.completedAt ? 'text-ui-text-secondary line-through' : 'text-ui-heading')}>
                      <b className="font-semibold">{f.projectCode}</b> · {f.type}
                    </span>
                    <span className="shrink-0 text-[12px] text-ui-text-secondary">{f.completedAt ? `done ${fmt(f.completedAt)}` : `since ${fmt(f.createdAt)}`}</span>
                    {canEdit && (
                      <>
                        <Button size="icon-sm" variant="ghost" disabled={busy === f.id} aria-label={f.completedAt ? 'Mark not done' : 'Mark done'} title={f.completedAt ? 'Mark not done' : 'Mark done'}
                          onClick={() => void call(f.id, `/api/production/flags/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !f.completedAt }) }, f.completedAt ? 'Marked not done' : 'Marked done')}>
                          {f.completedAt ? <RotateCcw /> : <Check />}
                        </Button>
                        <Button size="icon-sm" variant="ghost" disabled={busy === f.id} aria-label="Remove flag" title="Remove flag"
                          onClick={() => void call(f.id, `/api/production/flags/${f.id}`, { method: 'DELETE' }, 'Flag removed')}>
                          <Trash2 className="text-error-normal" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[13px] font-semibold text-ui-heading">Groups <span className="font-normal text-ui-text-secondary">({groups.length})</span></h3>
            {groups.length === 0 && <p className="m-0 text-[13px] text-ui-text-secondary">No groups yet.</p>}
            {groups.map(gr => (
              <div key={gr.id} className="rounded-[6px] border border-ui-divider px-3 py-2">
                <p className="m-0 mb-1 text-[12px] font-semibold text-ui-heading">Group {gr.number}</p>
                <div className="flex flex-wrap gap-1.5">
                  {gr.members.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-[4px] bg-ui-surface px-2 py-1 text-[12px] text-ui-body">
                      <span className="font-semibold">#{m.rank}</span> {m.projectCode} · {m.type}
                      {canEdit && (
                        <button type="button" aria-label={`Remove ${m.projectCode} ${m.type} from Group ${gr.number}`} disabled={busy === m.id}
                          onClick={() => void call(m.id, `/api/production/pf-group-members/${m.id}`, { method: 'DELETE' }, 'Removed from the group')}
                          className="inline-flex size-4 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-ui-text-secondary hover:bg-ui-hover-bg">
                          <X size={12} aria-hidden />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </ModalContent>
    </Modal>
  );
}
