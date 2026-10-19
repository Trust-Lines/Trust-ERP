'use client';

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LeadSummary({
  savedAt, generatedProjectCode, filledRequiredCount,
  hasCompany, hasRegion, hasCustomer, hasAddress, canCreate, onCreate,
}: {
  savedAt: Date | null;
  generatedProjectCode: string;
  filledRequiredCount: number;
  hasCompany: boolean;
  hasRegion: boolean;
  hasCustomer: boolean;
  hasAddress: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="lg:col-span-3 bg-ui-surface-elevated border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900">Lead summary</h3>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          {savedAt ? 'Saved' : 'Not saved yet'}
        </span>
      </div>

      {/* Project code box */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Project code
        </label>
        <div className="w-full bg-slate-100/70 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700">
          {generatedProjectCode}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">{filledRequiredCount} of 4 required fields</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${(filledRequiredCount / 4) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400">
          Fill Company · Region · Customer · Address to start
        </p>
      </div>

      {/* Checklist of required items */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <RequiredItem done={hasCompany} label="Company" />
        <RequiredItem done={hasRegion} label="Region" />
        <RequiredItem done={hasCustomer} label="Customer" />
        <RequiredItem done={hasAddress} label="Address" />
      </div>

      {/* Create Lead Button */}
      <div className="pt-3">
        <Button size="md" className="w-full" onClick={onCreate} disabled={!canCreate}>
          {!canCreate && <Lock size={13} />}
          <span>Create lead</span>
        </Button>
      </div>
    </div>
  );
}

function RequiredItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
        done ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
      }`}>
        ✓
      </span>
      <span className={done ? 'text-slate-900 font-semibold' : 'text-slate-500'}>{label}</span>
    </div>
  );
}
