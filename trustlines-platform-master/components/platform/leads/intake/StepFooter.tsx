'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The "← Back / Continue to …" footer shared by steps 2–6. */
export function StepFooter({ nextLabel, onBack, onNext }: { nextLabel: string; onBack: () => void; onNext: () => void }) {
  return (
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
        onClick={onNext}
      >
        <span>{nextLabel}</span>
        <ArrowRight size={14} />
      </Button>
    </div>
  );
}
