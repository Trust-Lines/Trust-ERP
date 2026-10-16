'use client';

import { Check, Trash2 } from 'lucide-react';
import type { FormState, SetForm } from './types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export function Step7Checklist({ form, setForm, newChecklistText, setNewChecklistText, canCreate, onBack, onCreate }: {
  form: FormState;
  setForm: SetForm;
  newChecklistText: string;
  setNewChecklistText: (text: string) => void;
  canCreate: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Checklist & next steps</h2>
        <p className="text-xs text-slate-500 mt-0.5">Track immediate action items for this opportunity.</p>
      </div>

      <div className="space-y-2">
        {form.checklist.map((item, idx) => (
          <div key={item.id || idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
            <Checkbox
              checked={item.done}
              onCheckedChange={checked => {
                const next = [...form.checklist];
                next[idx].done = checked;
                setForm(f => ({ ...f, checklist: next }));
              }}
            />
            <span className={`text-xs flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {item.text}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="Remove checklist item"
              onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2">
          <Input
            type="text"
            placeholder="Add checklist item..."
            value={newChecklistText}
            onChange={e => setNewChecklistText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newChecklistText.trim()) {
                e.preventDefault();
                setForm(f => ({
                  ...f,
                  checklist: [...f.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }],
                }));
                setNewChecklistText('');
              }
            }}
            className="flex-1"
          />
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (!newChecklistText.trim()) return;
              setForm(f => ({
                ...f,
                checklist: [...f.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }],
              }));
              setNewChecklistText('');
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <Button
          variant="secondary"
          type="button"
          onClick={onBack}
        >
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
        >
          <span>Complete & Create Lead</span>
          <Check size={14} />
        </Button>
      </div>
    </div>
  );
}
