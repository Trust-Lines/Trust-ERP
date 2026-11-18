'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import { FOOTER_PRIMARY, FOOTER_SECONDARY } from './StepFooter';
import { StandardItemCard } from './StandardItemCard';
import { STANDARDS, TRADES, type Quantities } from './standards';
import type { FormState } from './types';

const VALUE = 'm-0 break-words text-[13px] font-semibold leading-[1.5] tracking-[-0.286px] text-[var(--color-secondary-700)] dark:text-ui-heading';
const PILL = 'inline-flex items-center rounded-[4px] px-4 py-[3px] text-[12px] font-medium leading-4';
const PRIORITY_PILL: Record<string, string> = {
  high: 'bg-[var(--status-t10-bg)] text-[var(--status-t10-fg)]',
  medium: 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]',
  low: 'bg-[var(--status-t9-bg)] text-[var(--status-t9-fg)]',
};

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
      {children}
    </div>
  );
}

const text = (v: string | null | undefined) => <p className={cn(VALUE, !v && 'font-medium text-ui-text-secondary')}>{v || '-'}</p>;

// Figma "New lead · Overview" (node 930:2073): read-only review after the last step — lead fields in a
// four-column grid, note + scope, the picked standard items per trade with their quantity, then
// "← Back", the estimated value and "Save and Exit".
export function StepOverview({ form, projectCode, assigneeName, qty, saving, onBack, onFinish }: {
  form: FormState;
  projectCode: string | null;
  assigneeName: string | null;
  qty: Quantities;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const trades = TRADES.filter(t => form.scope_of_work[t.key]);
  const location = [form.street, form.city, US_STATES.find(s => s.abbr === form.state)?.name ?? form.state]
    .map(s => s.trim()).filter(Boolean).join(', ');
  const note = form.notes.client_special_request.trim() || form.notes.areas.trim();
  const dueDate = form.follow_up_date ? new Date(`${form.follow_up_date}T00:00:00`).toLocaleDateString('en-US') : null;
  const estValue = form.deal_size ? Number(form.deal_size) : null;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Overview</h2>

      <div className="grid grid-cols-1 gap-x-2 gap-y-8 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_380fr_279fr]">
        <Field label="Lead Name">{text(form.customer_name || form.brand)}</Field>
        <Field label="Project #">{text(projectCode)}</Field>
        <Field label="Brand">{text(form.brand)}</Field>
        <Field label="Assignee">{text(assigneeName)}</Field>

        <Field label="Priority" className="gap-[7px]">
          {form.priority
            ? <span className={cn(PILL, 'self-start capitalize', PRIORITY_PILL[form.priority] ?? PRIORITY_PILL.medium)}>{form.priority}</span>
            : text(null)}
        </Field>
        <Field label="Industry">
          {form.industry
            ? <span className={cn(PILL, 'self-start bg-[var(--status-info-bg)] text-[var(--status-info-fg)]')}>{form.industry}</span>
            : text(null)}
        </Field>
        <Field label="Project Type">{text(form.project_type)}</Field>
        <Field label="Due Date">{text(dueDate)}</Field>

        <Field label="Location" className="sm:col-span-2">{text(location)}</Field>
        <Field label="Mailing address" className="sm:col-span-2">{text(form.customer_address)}</Field>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[616fr_555fr] xl:gap-[92px]">
        <Field label="Note"><p className={cn(VALUE, 'max-w-[548px] whitespace-pre-line', !note && 'font-medium text-ui-text-secondary')}>{note || '-'}</p></Field>
        <Field label="Scope">
          {trades.length === 0 ? text(null) : (
            <div className="flex flex-wrap gap-[7px]">
              {trades.map(({ key, label, Icon }) => (
                <span key={key} className="inline-flex min-w-[140px] flex-1 items-center gap-2 rounded-[4px] border border-[var(--ui-input-border)] bg-[var(--color-secondary-700)] py-3 pl-4 pr-6 text-[13px] font-semibold leading-[1.5] tracking-[-0.286px] text-white dark:bg-primary-50 dark:text-primary-950">
                  <Icon size={18} strokeWidth={1.5} aria-hidden /> {label}
                </span>
              ))}
            </div>
          )}
        </Field>
      </div>

      {trades.map(({ key, label }) => {
        const picked = STANDARDS[key].filter(item => (qty[item.id] ?? 0) > 0);
        return (
          <Field key={key} label={label}>
            {picked.length === 0 ? (
              <p className="m-0 rounded-[8px] border border-dashed border-ui-divider px-4 py-4 text-center text-[13px] text-ui-body">
                No standard {label.toLowerCase()} items picked.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                {picked.map(item => <StandardItemCard key={item.id} item={item} qty={qty[item.id]} />)}
              </div>
            )}
          </Field>
        );
      })}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        <button type="button" onClick={onBack} className={FOOTER_SECONDARY}>
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        <div className="flex items-center gap-6 rounded-[4px] border border-[var(--status-t9-fg)] bg-[var(--status-t9-bg)] px-3 py-2 text-[var(--status-t9-fg)]">
          <span className="text-[12px] font-medium leading-4">EST. Value (USD)</span>
          <span className="text-[24px] font-semibold leading-[1.2]">
            {estValue != null ? `$ ${estValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </span>
        </div>
        <button type="button" onClick={onFinish} disabled={saving} className={FOOTER_PRIMARY}>
          {saving ? 'Saving…' : 'Save and Exit'}
        </button>
      </div>
    </div>
  );
}
