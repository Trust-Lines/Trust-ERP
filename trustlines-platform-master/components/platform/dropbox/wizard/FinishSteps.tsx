'use client';

import { CheckCircle } from 'lucide-react';
import { Spinner, StepCard } from './WizardParts';

export function ConfirmStep({ finalPath, loading, onSave, onBack }: { finalPath: string; loading: boolean; onSave: () => void; onBack: () => void }) {
  return (
    <StepCard eyebrow="Step 7 · Confirm" title="Save as default path" onBack={onBack}>
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
        onClick={onSave}
        disabled={loading}
        style={{ width: '100%', justifyContent: 'center', padding: 12 }}
      >
        {loading
          ? <><Spinner /> Uploading test file…</>
          : 'Save as default path & verify connection'}
      </button>
    </StepCard>
  );
}

export function DoneStep({ savedTo, onStartOver }: { savedTo: string; onStartOver: () => void }) {
  return (
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
        <button className="btn btn-ghost" onClick={onStartOver}>
          ← Start over
        </button>
      </div>
    </div>
  );
}
