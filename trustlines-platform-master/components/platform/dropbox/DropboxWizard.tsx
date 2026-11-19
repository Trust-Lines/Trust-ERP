'use client';

import { TOTAL_STEPS } from './wizard/wizardApi';
import { useDropboxWizard } from './wizard/useDropboxWizard';
import { PathDisplay, StepDots } from './wizard/WizardParts';
import { ClientTypeStep, ProductionTypeStep, RegionStep, StatusStep } from './wizard/ChoiceSteps';
import { ClientStep } from './wizard/ClientStep';
import { ProjectStep } from './wizard/ProjectStep';
import { ConfirmStep, DoneStep } from './wizard/FinishSteps';

/** Walks region → status → client → project → production type and saves that Dropbox folder as the default path. */
export function DropboxWizard() {
  const w = useDropboxWizard();
  const back = (to: number) => () => w.setStep(to);

  return (
    <div style={{ maxWidth: 720 }}>
      <StepDots current={w.step} total={TOTAL_STEPS} />

      {w.step < TOTAL_STEPS && <PathDisplay path={`/${w.currentPath.replace(/^\//, '')}`} />}

      {w.error && (
        <div className="warning-box" style={{ marginBottom: 16 }}>
          <span>⚠</span><span>{w.error}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={w.clearError}>✕</button>
        </div>
      )}

      {w.step === 0 && <RegionStep onChoose={w.chooseRegion} />}
      {w.step === 1 && <StatusStep region={w.region} onChoose={w.chooseStatus} onBack={back(0)} />}
      {w.step === 2 && <ClientTypeStep region={w.region} status={w.status} loading={w.loading} onChoose={w.chooseClientType} onBack={back(1)} />}
      {w.step === 3 && (
        <ClientStep
          clientType={w.clientType}
          clients={w.clients}
          onSelect={w.selectClient}
          newClientName={w.newClientName}
          onNameChange={w.setNewClientName}
          onCreate={w.createClient}
          loading={w.loading}
          onBack={back(2)}
        />
      )}
      {w.step === 4 && (
        <ProjectStep
          clientName={w.clientName}
          projects={w.projects}
          onSelect={w.selectProject}
          no={w.newProjectNo} onNoChange={w.setNewProjectNo}
          name={w.newProjectName} onNameChange={w.setNewProjectName}
          addr={w.newProjectAddr} onAddrChange={w.setNewProjectAddr}
          canCreate={w.canCreateProject}
          onCreate={w.createProject}
          loading={w.loading}
          onBack={back(3)}
        />
      )}
      {w.step === 5 && <ProductionTypeStep projectName={w.projectName} onChoose={w.selectProductionType} onBack={back(4)} />}
      {w.step === 6 && <ConfirmStep finalPath={w.finalPath} loading={w.loading} onSave={w.confirmSave} onBack={back(5)} />}
      {w.step === 7 && <DoneStep savedTo={w.savedTo} onStartOver={w.reset} />}
    </div>
  );
}
