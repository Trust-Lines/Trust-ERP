'use client';

import { Check, Trash2 } from 'lucide-react';
import type { FormState, SetForm } from './types';

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
            <input
              type="checkbox"
              checked={item.done}
              onChange={e => {
                const next = [...form.checklist];
                next[idx].done = e.target.checked;
                setForm(f => ({ ...f, checklist: next }));
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-xs flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))}
              className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2">
          <input
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
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
          />
          <button
            type="button"
            onClick={() => {
              if (!newChecklistText.trim()) return;
              setForm(f => ({
                ...f,
                checklist: [...f.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }],
              }));
              setNewChecklistText('');
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <span>Complete & Create Lead</span>
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}
