'use client';

import { Check } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { StepFooter } from './StepFooter';
import { StandardItemCard } from './StandardItemCard';
import { STANDARDS, TRADES, type Quantities } from './standards';
import type { Scope, StepProps } from './types';

// Figma "New lead · Scope of work" (node 919:28149): "Scope" label, then one toggle button per trade.
// Selected = navy fill, white text and a trailing check; unselected = white input with navy text.
export function Step4ScopeOfWork({ form, setForm, onBack, onNext, onSaveDraft, qty, setQty }: StepProps & {
  qty: Quantities;
  setQty: Dispatch<SetStateAction<Quantities>>;
}) {
  const toggle = (key: keyof Scope) =>
    setForm(f => ({ ...f, scope_of_work: { ...f.scope_of_work, [key]: !f.scope_of_work[key] } }));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Scope of work</h2>
        <p className="m-0 text-[12px] leading-[1.45] text-ui-body">Select trade disciplines requested by customer.</p>
      </div>

      <div className="flex flex-col gap-[7px]">
        <span id="scope-label" className="text-[12px] font-medium leading-4 text-ui-body">Scope</span>
        <div role="group" aria-labelledby="scope-label" className="flex flex-wrap gap-[7px]">
          {TRADES.map(({ key, label, Icon }) => {
            const on = form.scope_of_work[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={`inline-flex items-center gap-4 rounded-[4px] border border-[var(--ui-input-border)] py-3 pl-4 pr-6 text-[16px] font-semibold leading-[1.5] tracking-[-0.352px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary-700)] focus-visible:ring-offset-2 ${
                  on
                    ? 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950'
                    : 'bg-ui-input-bg text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={24} strokeWidth={1.5} aria-hidden />
                  {label}
                </span>
                {on && <Check size={16} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {TRADES.filter(t => form.scope_of_work[t.key]).map(({ key, label }) => {
        const items = STANDARDS[key];
        return (
          <section key={key} aria-label={`${label} standards`} className="flex flex-col gap-2">
            <h3 className="m-0 text-[16px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">
              {label} ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="m-0 rounded-[8px] border border-dashed border-ui-divider px-4 py-6 text-center text-[13px] text-ui-body">
                No standard {label.toLowerCase()} items yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {items.map(item => (
                  <StandardItemCard
                    key={item.id}
                    item={item}
                    qty={qty[item.id] ?? 0}
                    onChange={n => setQty(q => ({ ...q, [item.id]: Math.max(0, n) }))}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <StepFooter onBack={onBack} onNext={onNext} onSaveDraft={onSaveDraft} />
    </div>
  );
}
