'use client';

import type { FolderItem } from './wizardApi';
import { DIVIDER, FolderGrid, Spinner, StepCard } from './WizardParts';

/** Pick an existing project folder or create one (with its standard sub-folders). */
export function ProjectStep({
  clientName, projects, onSelect, no, onNoChange, name, onNameChange, addr, onAddrChange, canCreate, onCreate, loading, onBack,
}: {
  clientName: string;
  projects: FolderItem[];
  onSelect: (f: FolderItem) => void;
  no: string; onNoChange: (v: string) => void;
  name: string; onNameChange: (v: string) => void;
  addr: string; onAddrChange: (v: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <StepCard eyebrow={`Step 5 · ${clientName}`} title="Select or create project" onBack={onBack}>
      {projects.length > 0 && (
        <>
          <div className="form-label" style={{ marginBottom: 10 }}>Existing projects</div>
          <FolderGrid folders={projects} onSelect={onSelect} />
          {DIVIDER}
        </>
      )}
      <div className="form-label">Create new project folder</div>
      <div className="form-hint" style={{ marginBottom: 12 }}>
        Folder name: <code style={{ background: 'var(--bg-sunken)', padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>
          {no || '{No'}- {name || 'Name'}, {addr || 'Address'}
        </code>
      </div>
      <div className="form-row-3" style={{ marginBottom: 8 }}>
        <div>
          <label className="form-label required" style={{ fontSize: 12 }}>Project No</label>
          <input className="form-input" placeholder="e.g. 2024-001" value={no} onChange={e => onNoChange(e.target.value)} />
        </div>
        <div>
          <label className="form-label required" style={{ fontSize: 12 }}>Project Name</label>
          <input className="form-input" placeholder="e.g. ACME Office" value={name} onChange={e => onNameChange(e.target.value)} />
        </div>
        <div>
          <label className="form-label required" style={{ fontSize: 12 }}>Address</label>
          <input className="form-input" placeholder="e.g. 123 Main St" value={addr} onChange={e => onAddrChange(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={onCreate} disabled={!canCreate || loading}>
        {loading ? <Spinner /> : 'Create project folder + 20 sub-folders'}
      </button>
    </StepCard>
  );
}
