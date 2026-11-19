'use client';

import type { FolderItem } from './wizardApi';
import { DIVIDER, FolderGrid, Spinner, StepCard } from './WizardParts';

/** Pick an existing client folder or create a new one. */
export function ClientStep({ clientType, clients, onSelect, newClientName, onNameChange, onCreate, loading, onBack }: {
  clientType: string;
  clients: FolderItem[];
  onSelect: (f: FolderItem) => void;
  newClientName: string;
  onNameChange: (v: string) => void;
  onCreate: () => void;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <StepCard eyebrow={`Step 4 · ${clientType}`} title="Select or create client" onBack={onBack}>
      {clients.length > 0 && (
        <>
          <div className="form-label" style={{ marginBottom: 10 }}>Existing clients</div>
          <FolderGrid folders={clients} onSelect={onSelect} />
          {DIVIDER}
        </>
      )}
      <div className="form-label">Create new client</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          placeholder="Client name (e.g. SPEEDY)"
          value={newClientName}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCreate(); }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={onCreate} disabled={!newClientName.trim() || loading}>
          {loading ? <Spinner /> : 'Create folder'}
        </button>
      </div>
    </StepCard>
  );
}
