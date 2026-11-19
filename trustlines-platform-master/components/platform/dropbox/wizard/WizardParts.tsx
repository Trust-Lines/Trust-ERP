'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react';
import type { FolderItem } from './wizardApi';

export const Spinner = () => <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />;

export const DIVIDER = <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0' }} />;

export function StepDots({ current, total }: { current: number; total: number }) {
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

export function PathDisplay({ path }: { path: string }) {
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

export function FolderGrid({ folders, selected, onSelect }: {
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
            background: f.path === selected ? 'var(--brand-teal-100)' : 'var(--bg-surface)',
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

/** Card shell every step uses: eyebrow + title, optional Back, body. */
export function StepCard({ eyebrow, title, onBack, bodyStyle, children }: {
  eyebrow: string;
  title: string;
  onBack?: () => void;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="text-eyebrow">{eyebrow}</div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
        </div>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>}
      </div>
      <div className="card-body" style={bodyStyle}>{children}</div>
    </div>
  );
}

/** Full-width folder row with a chevron (region / production type lists). */
export function FolderOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn btn-secondary" style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Folder size={15} />{label}
      </span>
      <ChevronRight size={14} />
    </button>
  );
}

/** Large side-by-side choice (status / client type). */
export function ChoiceButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-secondary"
      style={{ flex: 1, justifyContent: 'center', padding: '14px 20px', fontSize: 14 }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
