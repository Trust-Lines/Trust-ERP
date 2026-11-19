'use client';

import { CLIENT_TYPES, PRODUCTION_TYPES, REGIONS, STATUSES } from './wizardApi';
import { ChoiceButton, FolderOption, Spinner, StepCard } from './WizardParts';

const COLUMN = { display: 'flex', flexDirection: 'column', gap: 8 } as const;
const ROW = { display: 'flex', gap: 12 } as const;

export function RegionStep({ onChoose }: { onChoose: (r: string) => void }) {
  return (
    <StepCard eyebrow="Step 1" title="Select region" bodyStyle={COLUMN}>
      {REGIONS.map(r => <FolderOption key={r} label={r} onClick={() => onChoose(r)} />)}
    </StepCard>
  );
}

export function StatusStep({ region, onChoose, onBack }: { region: string; onChoose: (s: string) => void; onBack: () => void }) {
  return (
    <StepCard eyebrow={`Step 2 · ${region}`} title="Project status" onBack={onBack} bodyStyle={ROW}>
      {STATUSES.map(s => <ChoiceButton key={s} onClick={() => onChoose(s)}>{s}</ChoiceButton>)}
    </StepCard>
  );
}

export function ClientTypeStep({ region, status, loading, onChoose, onBack }: {
  region: string; status: string; loading: boolean; onChoose: (value: string) => void; onBack: () => void;
}) {
  return (
    <StepCard eyebrow={`Step 3 · ${region} / ${status}`} title="Client type" onBack={onBack} bodyStyle={ROW}>
      {CLIENT_TYPES.map(ct => (
        <ChoiceButton key={ct.value} onClick={() => onChoose(ct.value)} disabled={loading}>
          {loading ? <Spinner /> : ct.label}
        </ChoiceButton>
      ))}
    </StepCard>
  );
}

export function ProductionTypeStep({ projectName, onChoose, onBack }: { projectName: string; onChoose: (t: string) => void; onBack: () => void }) {
  return (
    <StepCard eyebrow={`Step 6 · ${projectName}`} title="Select production type" onBack={onBack} bodyStyle={COLUMN}>
      {PRODUCTION_TYPES.map(t => <FolderOption key={t} label={t} onClick={() => onChoose(t)} />)}
    </StepCard>
  );
}
