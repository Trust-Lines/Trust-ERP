'use client';

import { ArrowRight } from 'lucide-react';

/** The "← Back / Continue to …" footer shared by steps 2–6. */
export function StepFooter({ nextLabel, onBack, onNext }: { nextLabel: string; onBack: () => void; onNext: () => void }) {
  return (
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
        onClick={onNext}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
      >
        <span>{nextLabel}</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
