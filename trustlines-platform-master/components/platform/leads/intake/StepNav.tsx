'use client';

import { Check } from 'lucide-react';
import { WIZARD_STEPS } from './types';

export function StepNav({ activeStep, onSelect }: { activeStep: number; onSelect: (step: number) => void }) {
  return (
    <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-1">
      {WIZARD_STEPS.map((s) => {
        const isActive = activeStep === s.step;
        const isDone = activeStep > s.step;

        return (
          <button
            key={s.step}
            type="button"
            onClick={() => onSelect(s.step)}
            className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer relative ${
              isActive
                ? 'bg-blue-50/70'
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDone
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isDone ? <Check size={12} strokeWidth={2.5} /> : s.step}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold leading-tight ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                {s.title}
              </p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{s.subtitle}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
