'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, LayoutGrid, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal, Modal, ModalContent } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { normalizeSign, normalizeStatus, statusStyle } from '@/lib/production/statuses';
import { TYPE_ORDER, vendorText, type PItem, type PProject } from '@/lib/excel/projectsExcelExport';

// Production tracker quick filters and their windows (Trust System FilterBar): ToDo / Receive
// Follow Up (flags), the sign / status chips, Groups (PF groups), the ToDo window and Manage
// Groups. Flags and groups live in T-ERP (migration 152, /api/production/flags, /pf-groups).

export interface PfFlag {
  id: string; kind: 'PF' | 'ORDER' | 'FOLLOWUP'; projectId: string; projectCode: string; projectName: string;
  type: string; itemId: string | null; completedAt: string | null; createdAt: string;
  totalItems?: number; filledItems?: number; pfCode?: string | null; itemStatus?: string | null; vendorName?: string | null;
}
export interface PfGroup { id: string; number: number; members: { id: string; rank: number; projectId: string; projectCode: string; type: string }[] }

export type QuickToken = 'TODO' | 'FOLLOWUP' | 'PO_TLINES' | 'PO_T' | 'PF_T' | 'TO_ORDER' | 'BOOKS_IN_PROGRESS' | 'GROUPS';

/** Chip colours when active (Trust System): background / border / text. */
const ACTIVE: Record<QuickToken, [string, string, string]> = {
  TODO: ['#fff7ed', '#fed7aa', '#c2410c'],
  FOLLOWUP: ['#f0fdf4', '#bbf7d0', '#15803d'],
  PO_TLINES: ['#fff7ed', '#fdba74', '#c2410c'],
  PO_T: ['#f5f3ff', '#c4b5fd', '#6d28d9'],
  PF_T: ['#f5f3ff', '#c4b5fd', '#6d28d9'],
  TO_ORDER: ['#fff1f2', '#fda4af', '#be123c'],
  BOOKS_IN_PROGRESS: ['#f0f9ff', '#7dd3fc', '#0369a1'],
  GROUPS: ['#fef2f2', '#fecaca', '#b91c1c'],
};

export const SIGN_CHIPS: { token: QuickToken; label: string; title: string }[] = [
  { token: 'PO_TLINES', label: 'PO Waiting TLines', title: 'PO status: WAITING TLINES TO SIGN' },
  { token: 'PO_T', label: 'PO Waiting T', title: 'PO status: WAITING T TO SIGN' },
  { token: 'PF_T', label: 'PF Waiting T', title: 'PF status: WAITING T TO SIGN' },
  { token: 'TO_ORDER', label: 'To Order', title: 'Status: TO ORDER' },
  { token: 'BOOKS_IN_PROGRESS', label: 'Books in Progress', title: 'Status: BOOKS IN PROGRESS' },
];
export const QUICK_LABEL: Record<QuickToken, string> = {
  TODO: 'ToDo', FOLLOWUP: 'Receive Follow Up', GROUPS: 'Groups',
  ...Object.fromEntries(SIGN_CHIPS.map(c => [c.token, c.label])) as Record<'PO_TLINES' | 'PO_T' | 'PF_T' | 'TO_ORDER' | 'BOOKS_IN_PROGRESS', string>,
};

export function useProductionFlags() {
  const [flags, setFlags] = useState<PfFlag[]>([]);
  const [groups, setGroups] = useState<PfGroup[]>([]);
  const load = useCallback(async () => {
    const r = await fetch('/api/production/flags', { cache: 'no-store' }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) { setFlags(r.flags ?? []); setGroups(r.groups ?? []); }
  }, []);
  useEffect(() => {
    void load();
    // Other people's changes: refresh with the board (focus + every 30s).
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);
  return { flags, groups, reload: load };
}

const key = (projectId: string | null | undefined, type: string | null | undefined) => `${projectId ?? ''}|${String(type ?? '').trim().toLowerCase()}`;

/**
 * Row test for the quick filters (Trust System rules): ToDo keeps every row of a flagged project +
 * type, Follow Up keeps the flagged rows (both on: either); the sign / status chips keep rows
 * matching ANY of them; Groups keeps project + types in a PF group. The kinds combine with AND.
 */
export function makeQuickMatcher(tokens: Set<QuickToken>, flags: PfFlag[], groups: PfGroup[]) {
  const todo = tokens.has('TODO'), follow = tokens.has('FOLLOWUP');
  const types = new Set(flags.filter(f => todo && f.kind === 'PF').map(f => key(f.projectId, f.type)));
  const items = new Set(flags.filter(f => follow && f.kind === 'FOLLOWUP' && f.itemId).map(f => f.itemId!));
  const grouped = new Set(groups.flatMap(g => g.members.map(m => key(m.projectId, m.type))));
  const sign = SIGN_CHIPS.map(c => c.token).filter(t => tokens.has(t));
  return (it: PItem) => {
    if ((todo || follow) && !(types.has(key(it.projectId, it.type)) || (it.id && items.has(it.id)))) return false;
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
  return <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-current/15 px-1 text-[11px] font-semibold">{n}</span>;
}

export function QuickChips({ tokens, onToggle, flags, groups, projectsTab }: {
  tokens: Set<QuickToken>; onToggle: (t: QuickToken) => void; flags: PfFlag[]; groups: PfGroup[]; projectsTab: boolean;
}) {
  const chips: { token: QuickToken; label: string; title: string; count?: number }[] = [
    ...(projectsTab ? [
      { token: 'TODO' as const, label: 'ToDo', title: 'Only the flagged project types', count: flags.filter(f => f.kind === 'PF').length },
      { token: 'FOLLOWUP' as const, label: 'Receive Follow Up', title: 'Only the PFs being followed up', count: flags.filter(f => f.kind === 'FOLLOWUP').length },
    ] : []),
    ...SIGN_CHIPS,
    ...(projectsTab ? [{ token: 'GROUPS' as const, label: 'Groups', title: 'Show the grouped-view table', count: groups.length }] : []),
  ];
  return (
    <>
      {chips.map(c => {
        const on = tokens.has(c.token);
        const [bg, border, fg] = ACTIVE[c.token];
        return (
          <button key={c.token} type="button" title={c.title} aria-pressed={on} onClick={() => onToggle(c.token)}
            className={cn(CHIP, !on && 'border-ui-input-border bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading')}
            style={on ? { background: bg, borderColor: border, color: fg } : undefined}>
            {c.label}{c.count != null && <Count n={c.count} />}
          </button>
        );
      })}
    </>
  );
}

// ── ToDo window ("Today's PFs & Follow Up") ─────────────────────────────────────────────────
const ORANGE = '#ea580c', GREEN = '#16a34a';

async function send(url: string, init: RequestInit): Promise<boolean> {
  const res = await fetch(url, init).catch(() => null);
  if (res?.ok) return true;
  const b = await res?.json().catch(() => ({}));
  toast.error(b?.error ?? 'Could not save');
  return false;
}

function Progress({ filled, total }: { filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const color = total && filled === total ? GREEN : filled ? '#d97706' : '#9ca3af';
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ui-divider"><span className="block h-full" style={{ width: `${pct}%`, background: color }} /></span>
      <span className="text-[11px] tabular-nums text-ui-text-secondary">{filled}/{total}</span>
    </span>
  );
}

const typesOf = (p: PProject) => {
  const m = new Map<string, PItem[]>();
  for (const it of p.items ?? []) { const t = it.type ?? ''; if (t) m.set(t, [...(m.get(t) ?? []), it]); }
  return [...m.entries()].sort((a, b) => (TYPE_ORDER.indexOf(a[0]) + 1 || 99) - (TYPE_ORDER.indexOf(b[0]) + 1 || 99));
};

export function TodoModal({ open, onOpenChange, flags, projects, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; flags: PfFlag[]; projects: PProject[]; onChanged: () => void;
}) {
  const [tab, setTab] = useState<'PF' | 'FOLLOWUP'>('PF');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<PProject | null>(null);
  const [busy, setBusy] = useState(false);
  const list = flags.filter(f => f.kind === tab);
  const color = tab === 'PF' ? ORANGE : GREEN;

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || picked) return [];
    return projects.filter(p => p.id && `${p.projectNo} ${p.editName ?? ''} ${p.projectName ?? ''}`.toLowerCase().includes(s)).slice(0, 8);
  }, [q, projects, picked]);

  async function add(body: Record<string, unknown>) {
    setBusy(true);
    const ok = await send('/api/production/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (ok) { toast.success('Flagged'); onChanged(); }
  }
  async function remove(id: string) {
    setBusy(true);
    const ok = await send(`/api/production/flags/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (ok) onChanged();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md" title={<span className="inline-flex items-center gap-2" style={{ color }}><Star size={16} aria-hidden /> ToDo</span>}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-6 border-b border-ui-divider" role="tablist">
            {([['PF', 'PFs to complete', ORANGE], ['FOLLOWUP', 'Receive follow up', GREEN]] as const).map(([k, label, c]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPicked(null); setQ(''); }}
                className={cn('-mb-px cursor-pointer border-0 border-b-2 border-solid bg-transparent px-0 pb-2 text-[13px] font-semibold', tab === k ? '' : 'border-transparent text-ui-text-secondary')}
                style={tab === k ? { borderColor: c, color: c } : undefined}>
                {label} ({flags.filter(f => f.kind === k).length})
              </button>
            ))}
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary">Currently flagged ({list.length})</h3>
            {list.length === 0 && <p className="m-0 text-[13px] text-ui-text-secondary">{tab === 'PF' ? 'No PFs flagged yet.' : 'Nothing being followed up yet.'}</p>}
            <ul className="m-0 flex max-h-[260px] list-none flex-col gap-1.5 overflow-y-auto p-0">
              {list.map(f => (
                <li key={f.id} className={cn('flex items-center gap-3 rounded-[6px] border border-ui-divider py-2 pl-3 pr-2', f.completedAt && 'bg-[#f0fdf4] dark:bg-[#14532d33]')}
                  style={{ borderLeft: `3px solid ${f.completedAt ? GREEN : color}` }}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
                    <span className="truncate text-ui-heading">
                      <b className="font-semibold">{f.projectCode}</b> — {f.type}
                      {f.kind === 'FOLLOWUP' && <> · <span className="text-ui-body">{f.pfCode || 'no PF code yet'}</span></>}
                      {f.completedAt && <span className="ml-2 font-semibold" style={{ color: GREEN }}>✓ done</span>}
                    </span>
                    {f.kind === 'PF'
                      ? <Progress filled={f.filledItems ?? 0} total={f.totalItems ?? 0} />
                      : <span className="truncate text-[12px] text-ui-text-secondary">{[f.vendorName, f.itemStatus && statusStyle(f.itemStatus).label].filter(Boolean).join(' · ')}</span>}
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" title="Remove" disabled={busy} onClick={() => void remove(f.id)}><X /></Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary">Add new</h3>
            {picked ? (
              <div className="flex items-center justify-between rounded-[6px] bg-ui-surface px-3 py-2 text-[13px]">
                <span className="truncate"><b>{picked.projectNo}</b> — {picked.editName || picked.projectName}</span>
                <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setQ(''); }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <input aria-label="Search project" placeholder="Search project by number or name..." value={q} onChange={e => setQ(e.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2.5 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-ui-focus-ring" />
                {matches.length > 0 && (
                  <ul className="absolute inset-x-0 top-10 z-10 m-0 list-none rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 shadow-03">
                    {matches.map(p => (
                      <li key={p.id}>
                        <button type="button" onClick={() => setPicked(p)} className="w-full cursor-pointer truncate rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg">
                          {p.projectNo} — {p.editName || p.projectName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {picked && tab === 'PF' && (
              <div className="flex flex-col gap-1">
                {typesOf(picked).map(([type, rows]) => {
                  const flagged = flags.some(f => f.kind === 'PF' && f.projectId === picked.id && f.type.toLowerCase() === type.toLowerCase() && !f.completedAt);
                  return (
                    <button key={type} type="button" disabled={busy || flagged} onClick={() => void add({ projectId: picked.id, type })}
                      className="flex cursor-pointer items-center justify-between rounded-[6px] border border-ui-divider bg-transparent px-3 py-2 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50">
                      <span>{type}{flagged && ' (flagged)'}</span>
                      <Progress filled={rows.filter(r => r.pfCode).length} total={rows.length} />
                    </button>
                  );
                })}
              </div>
            )}
            {picked && tab === 'FOLLOWUP' && (
              <div className="flex flex-col gap-1">
                <p className="m-0 text-[12px] text-ui-text-secondary">Only ORDERED PFs can be followed up — the others are greyed out.</p>
                {typesOf(picked).flatMap(([type, rows]) => rows.map(r => {
                  const ordered = normalizeStatus(r.status) === 'ORDERED';
                  const flagged = flags.some(f => f.kind === 'FOLLOWUP' && f.itemId === r.id);
                  return (
                    <button key={r.id} type="button" disabled={busy || !ordered || flagged} onClick={() => void add({ projectId: picked.id, kind: 'FOLLOWUP', itemId: r.id })}
                      className="flex cursor-pointer items-center gap-2 rounded-[6px] border border-ui-divider bg-transparent px-3 py-2 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-45">
                      <span className="w-20 shrink-0 font-medium">{type}</span>
                      <span className="w-32 shrink-0 truncate">{r.pfCode || 'no PF code yet'}</span>
                      <span className="min-w-0 flex-1 truncate text-ui-text-secondary">{vendorText(r.vendor)}</span>
                      <span className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold"
                        style={ordered ? { background: '#dcfce7', color: '#15803d' } : { background: '#fef9c3', color: '#a16207' }}>
                        {statusStyle(r.status).label}
                      </span>
                    </button>
                  );
                }))}
              </div>
            )}
          </section>
        </div>
      </ModalContent>
    </Modal>
  );
}

// ── Manage Groups ──────────────────────────────────────────────────────────────────────────
export function ManageGroupsModal({ open, onOpenChange, groups, canEdit, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; groups: PfGroup[]; canEdit: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PfGroup | null>(null);

  async function call(id: string, url: string, init: RequestInit) {
    setBusy(id);
    const ok = await send(url, init);
    setBusy(null);
    if (ok) onChanged();
  }

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent size="lg" title={<span className="inline-flex items-center gap-2 text-[#b91c1c]"><LayoutGrid size={16} aria-hidden /> Manage Groups</span>}>
          <div className="flex flex-col gap-4">
            {groups.length === 0 && <p className="m-0 text-[13px] text-ui-text-secondary">No groups yet.</p>}
            {groups.map(gr => {
              const tiers = [...new Set(gr.members.map(m => m.rank))].sort((a, b) => a - b);
              return (
                <div key={gr.id} className="overflow-hidden rounded-[8px] border border-ui-divider">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#b91c1c] to-[#ef4444] px-3 py-2 text-white">
                    <span className="text-[14px] font-bold">Group {gr.number}</span>
                    {canEdit && (
                      <button type="button" onClick={() => setToDelete(gr)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border-0 bg-white/15 px-2 py-1 text-[12px] font-medium text-white hover:bg-white/25">
                        <Trash2 size={12} aria-hidden /> Delete group
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    {tiers.map((tier, ti) => {
                      const inTier = gr.members.filter(m => m.rank === tier);
                      const byProject = [...new Set(inTier.map(m => m.projectCode))];
                      return (
                        <div key={tier} className="flex gap-3 rounded-[6px] border border-ui-divider p-2">
                          <span className="w-8 shrink-0 text-center text-[22px] font-bold text-[#b91c1c]">{tier}</span>
                          <div className="flex flex-wrap gap-2">
                            {byProject.map(code => (
                              <div key={code} className="rounded-[6px] bg-ui-surface px-2 py-1.5">
                                <p className="m-0 mb-1 text-[12px] font-semibold text-ui-heading">{code}</p>
                                <div className="flex flex-col gap-1">
                                  {inTier.filter(m => m.projectCode === code).map(m => (
                                    <div key={m.id} className="flex items-center gap-1 text-[12px] text-ui-body">
                                      <span className="min-w-[70px]">{m.type}</span>
                                      <span className="rounded-[3px] bg-[#fee2e2] px-1 text-[10px] font-semibold text-[#b91c1c]">#{m.rank}</span>
                                      {canEdit && (
                                        <>
                                          <Button size="icon-sm" variant="ghost" disabled={busy === m.id || ti === 0} title="Move up a tier (joins whatever is already there)" aria-label={`Move ${code} ${m.type} up a tier`}
                                            onClick={() => void call(m.id, `/api/production/pf-group-members/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: 'up' }) })}><ChevronUp /></Button>
                                          <Button size="icon-sm" variant="ghost" disabled={busy === m.id} title="Move down a tier (joins the next one, or starts a new one)" aria-label={`Move ${code} ${m.type} down a tier`}
                                            onClick={() => void call(m.id, `/api/production/pf-group-members/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: 'down' }) })}><ChevronDown /></Button>
                                          <Button size="icon-sm" variant="ghost" disabled={busy === m.id} title="Remove from group" aria-label={`Remove ${code} ${m.type} from Group ${gr.number}`}
                                            onClick={() => void call(m.id, `/api/production/pf-group-members/${m.id}`, { method: 'DELETE' })}><X /></Button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="m-0 text-[12px] text-ui-text-secondary">To add a new group or a new member, right-click a project number in the Projects grid.</p>
          </div>
        </ModalContent>
      </Modal>
      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title={toDelete ? `Delete Group ${toDelete.number}?` : 'Delete group?'} tone="destructive" confirmLabel="Delete group"
        description="Only the grouping is removed. Projects and their rows are not touched."
        onConfirm={async () => { if (toDelete) await call(toDelete.id, `/api/production/pf-groups/${toDelete.id}`, { method: 'DELETE' }); setToDelete(null); }}
      />
    </>
  );
}
