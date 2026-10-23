'use client';

import { Check } from 'lucide-react';
import { WIZARD_STEPS } from './helpers';

/** Horizontal "Form progress" row (Figma Project Detail); the name is kept for existing imports. */
export function StepperSidebar({ activeStep, step1Complete, onSelect }: {
  activeStep: number;
  /** Step 1 shows as done once Region and location are filled, even before moving past it. */
  step1Complete: boolean;
  onSelect: (step: number) => void;
}) {
  return (
    <div className="np-progress" role="tablist" aria-label="Form progress">
      {WIZARD_STEPS.map((step) => {
        const isActive = activeStep === step.id;
        const isCompleted = activeStep > step.id || (step.id === 1 && step1Complete);

        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={step.subtitle}
            className={`np-progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => onSelect(step.id)}
          >
            <span className="np-progress-marker">
              {isCompleted && !isActive ? <Check size={13} strokeWidth={3} /> : step.id}
            </span>
            <span>{step.title}</span>
          </button>
        );
      })}
    </div>
  );
}
