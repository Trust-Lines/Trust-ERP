'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { suggestVendorCode } from '@/lib/production/vendorCode';

export interface Vendor { id: string; code: string | null; name: string }

export function AddVendorModal({
  initialName = '', onCreated, onClose,
}: {
  initialName?: string;
  onCreated: (vendor: Vendor) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || (name.trim() ? suggestVendorCode(name) : 'CODE');

  async function create() {
    if (!name.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/production/vendors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed');
      const { vendor } = await res.json() as { vendor: Vendor };
      toast.success(`Vendor created: ${vendor.code} — ${vendor.name}`);
      onCreated(vendor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 460, maxWidth: '94vw', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Add New Vendor</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color="#666" /></button>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Vendor Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void create(); }}
            placeholder="e.g., Premier Millwork Solutions"
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}>Vendor Code</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void create(); }}
            placeholder="e.g., PMS (optional - auto-generated if empty)"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 5 }}>
            Leave empty to auto-generate from vendor name
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>About PF Codes</div>
            <div style={{ fontSize: 12, color: '#2563eb', lineHeight: 1.5 }}>
              When you assign this vendor to project items, PF codes are generated automatically as{' '}
              <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{preview}-[PROJECT_NO]-[TYPE][NUM]</code>{' '}
              (e.g. <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{preview}-7899-M01</code>).
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid var(--border-default)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={create} disabled={saving || !name.trim()} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 700,
            background: name.trim() ? '#1a6b6b' : '#cbd5e1', color: '#fff',
            cursor: (saving || !name.trim()) ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            Create Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--border-default)', boxSizing: 'border-box', fontFamily: 'inherit',
};
