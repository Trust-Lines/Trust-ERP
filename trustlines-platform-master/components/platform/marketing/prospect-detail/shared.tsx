'use client';

import { Building2, X } from 'lucide-react';
import { Pill } from '@/components/platform/shared/Pill';
import type { NeedClassification } from '@/types/database';
import { NEED_CLASSIFICATION_LABEL, NEED_CLASSIFICATION_VARIANT } from './types';

export function NeedClassificationPill({ c }: { c: NeedClassification }) {
  return <Pill variant={NEED_CLASSIFICATION_VARIANT[c]}>{NEED_CLASSIFICATION_LABEL[c]}</Pill>;
}

export function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

export function FormShell({ title, onCancel, children, footer }: { title: string; onCancel: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--brand-navy), var(--brand-teal-600, var(--brand-navy)))' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-default)' }}>{title}</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 2, display: 'flex' }} aria-label="Cancel">
          <X size={15} />
        </button>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>{footer}</div>
    </div>
  );
}

export function FieldSection({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon size={13} style={{ color: 'var(--brand-navy)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

