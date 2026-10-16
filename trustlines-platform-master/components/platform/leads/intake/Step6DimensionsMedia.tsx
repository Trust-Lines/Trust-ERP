'use client';

import { Upload, Link2 } from 'lucide-react';
import { StepFooter } from './StepFooter';
import type { StepProps } from './types';
import { Input } from '@/components/ui/input';

export function Step6DimensionsMedia({ form, setForm, onBack, onNext }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Dimensions & media</h2>
        <p className="text-xs text-slate-500 mt-0.5">Attach Matterport 360 link and initial site files.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Matterport 360 Virtual Tour Link</label>
        <div className="relative">
          <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="url"
            placeholder="https://my.matterport.com/show/?m=..."
            value={form.matterport_link}
            onChange={e => setForm(f => ({ ...f, matterport_link: e.target.value }))}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50">
        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-xs font-semibold text-slate-700">Drop files or plans to upload</p>
        <p className="text-[10px] text-slate-400 mt-0.5">PDF, DWG, PNG, or JPG up to 50MB</p>
      </div>

      <StepFooter nextLabel="Continue to Checklist" onBack={onBack} onNext={onNext} />
    </div>
  );
}
