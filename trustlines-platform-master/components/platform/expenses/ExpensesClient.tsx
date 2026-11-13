'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BanknoteCheck, BanknoteX, CircleDollarSign, Ellipsis, Plus, Receipt, Trash2, Check, Undo2, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TrustExpense } from '@/types/database';
import type { CurrencyTotals } from '@/lib/expenses/config';
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/lib/expenses/config';
import { Select } from '@/components/platform/shared/Select';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { CategoryViews } from '@/components/platform/website/CategoryViews';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

interface Proj { id: string; code: string; name: string }
interface Sup { id: string; code: string | null; name: string }

interface Props {
  initialExpenses: TrustExpense[];
  totals: CurrencyTotals;
  canEdit: boolean;
  projects: Proj[];
  suppliers: Sup[];
  schemaError: string | null;
}

// Figma "Expenses" (node 427:18378). The frame has no "New expense" action; the existing
// one stays (orange, like the other list pages). Row "…" holds the existing actions.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const CELL_STRONG = cn('text-[15px] font-semibold', HEADING);
const FIELD = 'h-10 w-full min-w-0 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const FORM_LABEL = 'flex min-w-0 flex-col gap-1 text-[12px] font-medium text-ui-body';
const ACCENT_BTN = 'gap-2 bg-ui-btn-accent px-8 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "2026-08-10" → "8/10/2026", no timezone shift. */
const usDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${Number(m)}/${Number(d)}/${y}` : iso;
};

/** Figma summary card: tinted 16px-radius tile, white icon square, label, big amount + currency tag. */
function SummaryCard({ tone, icon: Icon, label, rows }: { tone: string; icon: LucideIcon; label: string; rows: { currency: string; value: number }[] }) {
  const fg = `var(--status-${tone}-fg)`;
  return (
    <div className="flex min-h-[165px] flex-col justify-between gap-4 rounded-[16px] py-3.5 pl-3.5 pr-4" style={{ background: `var(--status-${tone}-bg)` }}>
      <span className="grid size-[49px] place-items-center rounded-[8px] bg-ui-surface-elevated" style={{ color: fg }}>
        <Icon size={24} aria-hidden />
      </span>
      <div className="flex flex-col gap-1 pl-0.5">
        <p className="m-0 text-[14px] leading-[1.5]" style={{ color: fg }}>{label}</p>
        {rows.map(r => (
          <div key={r.currency} className="flex items-center justify-between gap-3">
            <span className="text-[30px] font-semibold leading-[1.5] tracking-[0.6px] tabular-nums" style={{ color: fg }}>{fmt(r.value)}</span>
            <span className="rounded-[4px] bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px]" style={{ color: fg }}>{r.currency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpensesClient({ initialExpenses, totals, canEdit, projects, suppliers, schemaError }: Props) {
  const router = useRouter();
  // Read straight from props: router.refresh() after add / delete / mark-paid sends a
  // fresh list, which a useState copy would ignore (list and totals would disagree).
  const expenses: TrustExpense[] = initialExpenses;
  const [category, setCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<TrustExpense | null>(null);
  const [f, setF] = useState({ category: 'other', description: '', currency: 'USD', amount: '', expense_date: '', project_id: '', supplier_id: '', is_paid: false });

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const supById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const filtered = useMemo(() => category === 'all' ? expenses : expenses.filter(e => e.category === category), [expenses, category]);
  const activeCurrencies = CURRENCIES.filter(c => totals[c].total !== 0);
  const shown = activeCurrencies.length ? activeCurrencies : ['USD' as const];
  const views = [
    { value: 'all', label: 'All', count: expenses.length },
    ...EXPENSE_CATEGORIES.map(c => ({ value: c as string, label: EXPENSE_CATEGORY_LABELS[c], count: expenses.filter(e => e.category === c).length })),
  ];

  async function create() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, amount: Number(f.amount) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Expense recorded'); setShowForm(false);
    setF({ category: 'other', description: '', currency: 'USD', amount: '', expense_date: '', project_id: '', supplier_id: '', is_paid: false });
    router.refresh();
  }

  async function togglePaid(e: TrustExpense) {
    const res = await fetch(`/api/expenses/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_paid: !e.is_paid }) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    router.refresh();
  }

  // Called from the confirm popup; throwing keeps the popup open so the user can retry.
  async function remove(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); throw new Error('delete failed'); }
    toast.success('Expense deleted'); router.refresh();
  }

  const paidChip = (paid: boolean) => {
    const tone = paid ? 't9' : 't10';
    return (
      <span
        className="inline-flex items-center rounded-[4px] border px-4 py-1 text-[12px] font-medium leading-4 whitespace-nowrap"
        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)`, borderColor: `var(--status-${tone}-fg)` }}
      >
        {paid ? 'Paid' : 'Unpaid'}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Finance' }, { label: 'Expenses', href: '/expenses' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Expenses</h1>
          <p className="m-0 text-[13px] text-ui-body">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · internal operational spend</p>
        </div>
        {canEdit && (
          <Button size="md" className={ACCENT_BTN} onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
            <Plus className="size-4" /> New Expense
          </Button>
        )}
      </div>

      {schemaError && (
        <div className="rounded-[8px] border border-warning-normal bg-ui-surface px-4 py-3 text-[13px] text-ui-body">⚠️ {schemaError}</div>
      )}

      <div className="grid grid-cols-1 gap-[22px] md:grid-cols-3">
        <SummaryCard tone="t2" icon={CircleDollarSign} label="Total Spent" rows={shown.map(c => ({ currency: c, value: totals[c].total }))} />
        <SummaryCard tone="t6" icon={BanknoteCheck} label="Paid" rows={shown.map(c => ({ currency: c, value: totals[c].paid }))} />
        <SummaryCard tone="t10" icon={BanknoteX} label="Unpaid" rows={shown.map(c => ({ currency: c, value: totals[c].unpaid }))} />
      </div>

      {showForm && canEdit && (
        <div className="grid grid-cols-2 items-end gap-2 rounded-[8px] border border-ui-divider bg-ui-page-bg p-4 md:grid-cols-[1fr_80px_1fr_1fr_1.4fr_1.4fr_auto]">
          <label className={FORM_LABEL}>Category<Select className={FIELD} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}</Select></label>
          <label className={FORM_LABEL}>Cur.<Select className={FIELD} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
          <label className={FORM_LABEL}>Amount<input className={FIELD} type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label className={FORM_LABEL}>Date<input className={FIELD} type="date" value={f.expense_date} onChange={e => setF({ ...f, expense_date: e.target.value })} /></label>
          <label className={FORM_LABEL}>Project<Select className={FIELD} value={f.project_id} onChange={e => setF({ ...f, project_id: e.target.value })}><option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}</Select></label>
          <label className={FORM_LABEL}>Supplier<Select className={FIELD} value={f.supplier_id} onChange={e => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
          <Button size="md" onClick={create} loading={saving}>Save</Button>
          <div className="col-span-full flex flex-wrap items-center gap-3 text-[12px] text-ui-body">
            <label className="flex items-center gap-1.5"><Checkbox checked={f.is_paid} onCheckedChange={v => setF({ ...f, is_paid: !!v })} /> Already paid</label>
            <input className={cn(FIELD, 'flex-1')} placeholder="Description (optional)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          </div>
        </div>
      )}

      <CategoryViews options={views} value={category} onChange={setCategory} label="Expense category" />

      {filtered.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <EmptyState icon={<Receipt />} title="No expenses recorded." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-ui-surface">
                  <th className={cn(TH, 'w-[14%] pl-[18px]')}>Date</th>
                  <th className={cn(TH, 'w-[9%]')}>Category</th>
                  <th className={cn(TH, 'w-[26%]')}>Description</th>
                  <th className={cn(TH, 'w-[15%]')}>Project</th>
                  <th className={cn(TH, 'w-[13%]')}>Supplier</th>
                  <th className={cn(TH, 'w-[11%]')}>Amount</th>
                  <th className={TH}>Paid</th>
                  {canEdit && <th className="w-12"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const p = e.project_id ? projById.get(e.project_id) : null;
                  const s = e.supplier_id ? supById.get(e.supplier_id) : null;
                  return (
                    <tr key={e.id} className="h-16 border-b border-ui-divider last:border-b-0">
                      <td className={cn('py-2 pl-[18px] pr-2.5 whitespace-nowrap', CELL_STRONG)}>{usDate(e.expense_date)}</td>
                      <td className={cn('max-w-0 truncate px-2.5 py-2', CELL_STRONG)}>{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</td>
                      <td className="max-w-0 px-2 py-2"><p className="m-0 truncate text-[13px] text-ui-body" title={e.description ?? undefined}>{e.description || '-'}</p></td>
                      <td className="max-w-0 truncate px-2 py-2 text-[13px] text-ui-body">{p ? <Link href={`/projects/${e.project_id}`} className="text-inherit hover:underline">{p.code}</Link> : '-'}</td>
                      <td className="max-w-0 truncate px-2 py-2 text-[13px] text-ui-body">{s ? <Link href={`/suppliers/${e.supplier_id}`} className="text-inherit hover:underline">{s.name}</Link> : '-'}</td>
                      <td className={cn('px-2.5 py-2 whitespace-nowrap tabular-nums', CELL_STRONG)}>
                        {fmt(Number(e.amount))} <small className="text-[11px] font-normal text-ui-text-secondary">{e.currency}</small>
                      </td>
                      <td className="px-2 py-2">
                        {canEdit ? (
                          <button type="button" className="cursor-pointer border-0 bg-transparent p-0" onClick={() => togglePaid(e)} title={e.is_paid ? 'Mark unpaid' : 'Mark paid'}>
                            {paidChip(e.is_paid)}
                          </button>
                        ) : paidChip(e.is_paid)}
                      </td>
                      {canEdit && (
                        <td className="pr-3 text-center">
                          <Menu>
                            <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Expense actions" />}>
                              <Ellipsis />
                            </MenuTrigger>
                            <MenuContent>
                              <MenuItem onClick={() => void togglePaid(e)}>
                                {e.is_paid ? <><Undo2 aria-hidden /> Mark unpaid</> : <><Check aria-hidden /> Mark paid</>}
                              </MenuItem>
                              <MenuItem variant="destructive" onClick={() => setRemoving(e)}>
                                <Trash2 aria-hidden /> Delete
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }} tone="destructive"
        title="Delete this expense?"
        description={removing
          ? `${EXPENSE_CATEGORY_LABELS[removing.category] ?? removing.category} · ${fmt(Number(removing.amount))} ${removing.currency}${removing.expense_date ? ` · ${usDate(removing.expense_date)}` : ''}. This can't be undone.`
          : undefined}
        confirmLabel="Delete"
        onConfirm={async () => { if (removing) await remove(removing.id); }}
      />
    </div>
  );
}
