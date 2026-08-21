'use client';

import { useState } from 'react';
import { CheckCircle, Folder, FolderOpen, Loader2, ChevronRight } from 'lucide-react';

interface FolderItem { name: string; path: string }

const WIZARD_ROOT = '/D-Projects/T LINES/1-Store Maker';

const REGIONS = [
  'T Lines CVW Projects',
  'T Lines NE Projects',
  'T Lines NW Projects',
  'T Lines SE Projects',
];

const STATUSES = ['Under Working', 'Done'];

const CLIENT_TYPES = [
  { label: 'Clients',     value: 'Clients' },
  { label: 'Individuals', value: 'Individuals' },
];

const PRODUCTION_TYPES = ['Millwork', 'Ceiling', 'Shelving', 'Image', '0-Missing-Extra'];

async function listFolders(path: string): Promise<FolderItem[]> {
  const r = await fetch(`/api/dropbox/list-folders?path=${encodeURIComponent(path)}`);
  const j = await r.json() as { folders?: FolderItem[]; error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Failed to list folders');
  return j.folders ?? [];
}

async function createSingleFolder(path: string): Promise<void> {
  const r = await fetch('/api/dropbox/create-single-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const j = await r.json() as { error?: string };
    throw new Error(j.error ?? 'Failed to create folder');
  }
}

async function createProjectStructure(projectFolderPath: string): Promise<void> {
  const r = await fetch('/api/dropbox/create-project-structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectFolderPath }),
  });
  if (!r.ok) {
    const j = await r.json() as { error?: string };
    throw new Error(j.error ?? 'Failed to create structure');
  }
}

async function savePath(targetPath: string): Promise<string> {
  const r = await fetch('/api/dropbox/save-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPath }),
  });
  const j = await r.json() as { uploadedTo?: string; error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Failed to save path');
  return j.uploadedTo ?? targetPath;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 999,
            background: i < current
              ? 'var(--status-success)'
              : i === current
              ? 'var(--brand-teal)'
              : 'var(--border-default)',
            transition: 'all 200ms',
          }}
        />
      ))}
      <span style={{ fontSize: 12, color: 'var(--fg-subtle)', marginLeft: 4 }}>
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

function PathDisplay({ path }: { path: string }) {
  if (!path) return null;
  const segments = path.split('/').filter(Boolean);
  return (
    <div style={{
      padding: '8px 12px', background: 'var(--bg-sunken)',
      borderRadius: 'var(--radius-sm)', marginBottom: 20,
      fontSize: 12, fontFamily: 'var(--font-mono)',
      color: 'var(--fg-subtle)', wordBreak: 'break-all',
      display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
    }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: i === segments.length - 1 ? 'var(--brand-teal)' : 'var(--fg-subtle)' }}>
            {seg}
          </span>
          {i < segments.length - 1 && <span style={{ color: 'var(--fg-faint)' }}>/</span>}
        </span>
      ))}
    </div>
  );
}

function FolderGrid({
  folders,
  selected,
  onSelect,
}: {
  folders: FolderItem[];
  selected?: string;
  onSelect: (f: FolderItem) => void;
}) {
  if (folders.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 16 }}>
      {folders.map(f => (
        <button
          key={f.path}
          onClick={() => onSelect(f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 6,
            border: `1.5px solid ${f.path === selected ? 'var(--brand-teal)' : 'var(--border-default)'}`,
            background: f.path === selected ? 'var(--brand-teal-100)' : 'white',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: f.path === selected ? 'var(--brand-teal)' : 'var(--fg-default)',
            textAlign: 'left',
          }}
        >
          {f.path === selected ? <FolderOpen size={15} /> : <Folder size={15} />}
          {f.name}
        </button>
      ))}
    </div>
  );
}

export function DropboxWizard() {
  const [step, setStep]               = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const [region, setRegion]           = useState('');
  const [status, setStatus]           = useState('');
  const [clientType, setClientType]   = useState('');
  const [clientPath, setClientPath]   = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [productionType, setProductionType] = useState('');
  const [finalPath, setFinalPath]     = useState('');

  const [clients, setClients]         = useState<FolderItem[]>([]);
  const [newClientName, setNewClientName] = useState('');

  const [projects, setProjects]       = useState<FolderItem[]>([]);
  const [newProjectNo, setNewProjectNo]   = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddr, setNewProjectAddr] = useState('');

  const [savedTo, setSavedTo]         = useState('');

  function clearError() { setError(''); }

  async function goToStep4(clientTypeVal: string) {
    setLoading(true); clearError();
    try {
      const basePath = `${WIZARD_ROOT}/${region}/${status}/${clientTypeVal}`;
      const list = await listFolders(basePath);
      setClients(list);
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function selectClient(f: FolderItem) {
    setClientPath(f.path);
    setLoading(true); clearError();
    try {
      const list = await listFolders(f.path);
      setProjects(list);
      setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function createClient() {
    if (!newClientName.trim()) return;
    setLoading(true); clearError();
    try {
      const base = `${WIZARD_ROOT}/${region}/${status}/${clientType}`;
      const path = `${base}/${newClientName.trim()}`;
      await createSingleFolder(path);
      setClientPath(path);
      setProjects([]);
      setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function selectProject(f: FolderItem) {
    setProjectPath(f.path);
    setStep(5);
  }

  async function createProject() {
    if (!newProjectNo.trim() || !newProjectName.trim() || !newProjectAddr.trim()) return;
    setLoading(true); clearError();
    try {
      const folderName = `${newProjectNo.trim()}- ${newProjectName.trim()}, ${newProjectAddr.trim()}`;
      const path = `${clientPath}/${folderName}`;
      await createProjectStructure(path);
      setProjectPath(path);
      setStep(5);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function selectProductionType(type: string) {
    const path = `${projectPath}/3-Production & Delivery/${type}`;
    setProductionType(type);
    setFinalPath(path);
    setStep(6);
  }

  async function handleSavePath() {
    setLoading(true); clearError();
    try {
      const uploaded = await savePath(finalPath);
      setSavedTo(uploaded);
      setStep(7);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  const currentPath = [
    WIZARD_ROOT,
    region,
    status,
    clientType,
    clientPath ? clientPath.split('/').pop() : '',
    projectPath ? projectPath.split('/').pop() : '',
    productionType ? `3-Production & Delivery/${productionType}` : '',
  ].filter(Boolean).join('/').replace(/\/+/g, '/');

  return (
    <div style={{ maxWidth: 720 }}>
      <StepDots current={step} total={7} />

      {step < 7 && <PathDisplay path={`/${currentPath.replace(/^\//, '')}`} />}

      {error && (
        <div className="warning-box" style={{ marginBottom: 16 }}>
          <span>⚠</span><span>{error}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={clearError}>✕</button>
        </div>
      )}

      {step === 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 1</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select region</h3>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => { setRegion(r); setStep(1); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Folder size={15} />{r}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 2 · {region}</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Project status</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>← Back</button>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 12 }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setStep(2); }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '14px 20px', fontSize: 14 }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 3 · {region} / {status}</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Client type</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 12 }}>
            {CLIENT_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => { setClientType(ct.value); goToStep4(ct.value); }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '14px 20px', fontSize: 14 }}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : ct.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 4 · {clientType}</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select or create client</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>← Back</button>
          </div>
          <div className="card-body">
            {clients.length > 0 && (
              <>
                <div className="form-label" style={{ marginBottom: 10 }}>Existing clients</div>
                <FolderGrid folders={clients} onSelect={selectClient} />
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0' }} />
              </>
            )}
            <div className="form-label">Create new client</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="Client name (e.g. SPEEDY)"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createClient(); }}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={createClient}
                disabled={!newClientName.trim() || loading}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 5 · {clientPath.split('/').pop()}</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select or create project</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(3)}>← Back</button>
          </div>
          <div className="card-body">
            {projects.length > 0 && (
              <>
                <div className="form-label" style={{ marginBottom: 10 }}>Existing projects</div>
                <FolderGrid folders={projects} onSelect={selectProject} />
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0' }} />
              </>
            )}
            <div className="form-label">Create new project folder</div>
            <div className="form-hint" style={{ marginBottom: 12 }}>
              Folder name: <code style={{ background: 'var(--bg-sunken)', padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>
                {newProjectNo || '{No'}- {newProjectName || 'Name'}, {newProjectAddr || 'Address'}
              </code>
            </div>
            <div className="form-row-3" style={{ marginBottom: 8 }}>
              <div>
                <label className="form-label required" style={{ fontSize: 12 }}>Project No</label>
                <input className="form-input" placeholder="e.g. 2024-001" value={newProjectNo} onChange={e => setNewProjectNo(e.target.value)} />
              </div>
              <div>
                <label className="form-label required" style={{ fontSize: 12 }}>Project Name</label>
                <input className="form-input" placeholder="e.g. ACME Office" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
              </div>
              <div>
                <label className="form-label required" style={{ fontSize: 12 }}>Address</label>
                <input className="form-input" placeholder="e.g. 123 Main St" value={newProjectAddr} onChange={e => setNewProjectAddr(e.target.value)} />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={createProject}
              disabled={!newProjectNo.trim() || !newProjectName.trim() || !newProjectAddr.trim() || loading}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create project folder + 20 sub-folders'}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 6 · {projectPath.split('/').pop()}</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Select production type</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(4)}>← Back</button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRODUCTION_TYPES.map(t => (
              <button
                key={t}
                onClick={() => selectProductionType(t)}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Folder size={15} />{t}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Step 7 · Confirm</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Save as default path</h3>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(5)}>← Back</button>
          </div>
          <div className="card-body">
            <div className="form-label" style={{ marginBottom: 6 }}>Target path</div>
            <div style={{
              padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 6,
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-default)',
              marginBottom: 20, wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {finalPath}
            </div>
            <div className="info-box" style={{ marginBottom: 20 }}>
              <span>ℹ</span>
              <span>A test file will be uploaded to this folder to confirm the connection.</span>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSavePath}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: 12 }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading test file…</>
                : 'Save as default path & verify connection'}
            </button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <CheckCircle size={48} style={{ color: 'var(--status-success)', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Path saved!</h2>
            <p style={{ fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 20 }}>
              Test file uploaded to:
            </p>
            <div style={{
              padding: '8px 14px', background: 'var(--status-success-bg)', borderRadius: 6,
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--status-success-fg)',
              wordBreak: 'break-all', marginBottom: 24,
            }}>
              {savedTo}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setStep(0); setRegion(''); setStatus(''); setClientType('');
                setClientPath(''); setProjectPath(''); setProductionType('');
                setFinalPath(''); setSavedTo(''); setNewClientName('');
                setNewProjectNo(''); setNewProjectName(''); setNewProjectAddr('');
              }}
            >
              ← Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
