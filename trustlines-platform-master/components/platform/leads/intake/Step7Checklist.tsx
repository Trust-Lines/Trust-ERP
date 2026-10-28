'use client';

import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react';
import type { FormState, SetForm } from './types';
import { FOOTER_PRIMARY, FOOTER_SECONDARY } from './StepFooter';
import { cn } from '@/lib/utils';

// Figma "New lead · Checklist" (node 290:37915): add row (input + dark "+ Add"), then 60px item rows
// with a 29px check box and a red delete button; footer "← Back" / "Save and Exit".
export function Step7Checklist({ form, setForm, newChecklistText, setNewChecklistText, onBack, onFinish }: {
  form: FormState;
  setForm: SetForm;
  newChecklistText: string;
  setNewChecklistText: (text: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  function add() {
    const text = newChecklistText.trim();
    if (!text) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: crypto.randomUUID(), text, done: false }] }));
    setNewChecklistText('');
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Checklist & next steps</h2>
        <p className="mt-1 text-[13px] text-ui-body">Track immediate action items for this opportunity.</p>
      </div>

      <div className="flex items-stretch gap-[7px]">
        <input
          type="text"
          aria-label="New checklist item"
          placeholder="Add checklist item.."
          value={newChecklistText}
          onChange={e => setNewChecklistText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="min-h-[44px] min-w-0 flex-1 rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 text-[14px] leading-[1.4] text-ui-heading outline-none placeholder:text-ui-body focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
        />
        <button
          type="button" onClick={add} disabled={!newChecklistText.trim()}
          className="inline-flex h-11 shrink-0 items-center gap-[7px] rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-primary-50 dark:text-primary-950"
        >
          <Plus size={16} aria-hidden /> Add
        </button>
      </div>

      {form.checklist.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {form.checklist.map((item, idx) => (
            <li key={item.id || idx} className="flex items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 py-2.5">
              <button
                type="button" role="checkbox" aria-checked={item.done}
                aria-label={item.done ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
                onClick={() => setForm(f => ({ ...f, checklist: f.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c)) }))}
                className={cn(
                  'grid size-[29px] shrink-0 place-items-center rounded-[4px] border transition-colors',
                  item.done
                    ? 'border-[var(--color-secondary-700)] bg-[var(--color-secondary-700)] text-white dark:border-primary-50 dark:bg-primary-50 dark:text-primary-950'
                    : 'border-ui-divider bg-ui-input-bg hover:border-[var(--ui-input-border)]',
                )}
              >
                {item.done && <Check size={16} strokeWidth={2.5} aria-hidden />}
              </button>
              <span className={cn('min-w-0 flex-1 break-words text-[14px] leading-[1.4]', item.done ? 'text-ui-text-disabled line-through' : 'text-ui-body')}>
                {item.text}
              </span>
              <button
                type="button" aria-label={`Remove ${item.text}`} title="Remove"
                onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))}
                className="grid h-10 shrink-0 place-items-center rounded-[6px] border border-[var(--status-t10-bg)] bg-[var(--status-t10-bg)] px-3 text-[var(--status-t10-fg)] transition-opacity hover:opacity-85"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-[6px] border border-dashed border-ui-divider px-3 py-6 text-center text-[13px] text-ui-text-secondary">
          No checklist items yet — add the first next step above.
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <button type="button" onClick={onBack} className={FOOTER_SECONDARY}>
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        <button type="button" onClick={onFinish} className={FOOTER_PRIMARY}>
          Save and Exit
        </button>
      </div>
    </div>
  );
}
