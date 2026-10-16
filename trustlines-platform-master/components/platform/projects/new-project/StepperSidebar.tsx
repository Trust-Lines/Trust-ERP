'use client';

import { Check } from 'lucide-react';
import { WIZARD_STEPS } from './helpers';

export function StepperSidebar({ activeStep, step1Complete, onSelect }: {
  activeStep: number;
  /** Step 1 shows as done once Region and location are filled, even before moving past it. */
  step1Complete: boolean;
  onSelect: (step: number) => void;
}) {
  return (
    <div className="stepper-sidebar">
      {WIZARD_STEPS.map((step) => {
        const isActive = activeStep === step.id;
        const isCompleted = activeStep > step.id || (step.id === 1 && step1Complete);

        return (
          <div
            key={step.id}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => onSelect(step.id)}
          >
            <div className="step-icon-circle">
              {isCompleted && !isActive ? <Check size={14} strokeWidth={3} /> : step.id}
            </div>
            <div className="step-text">
              <span className="step-title-text">{step.title}</span>
              <span className="step-subtitle-text">{step.subtitle}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
