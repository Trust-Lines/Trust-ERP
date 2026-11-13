'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
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
    // layerClassName: opened from the document generator, which sits above the normal z-50 layer.
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        title="Add New Vendor"
        layerClassName="z-[10000]"
        footer={<>
          <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
          <Button onClick={create} loading={saving} disabled={!name.trim()}>Create Vendor</Button>
        </>}
      >
        <div>
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

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--status-info-bg)', border: '1px solid color-mix(in srgb, var(--status-info) 35%, transparent)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-info-fg)', marginBottom: 4 }}>About PF Codes</div>
            <div style={{ fontSize: 12, color: 'var(--status-info-fg)', lineHeight: 1.5 }}>
              When you assign this vendor to project items, PF codes are generated automatically as{' '}
              <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{preview}-[PROJECT_NO]-[TYPE][NUM]</code>{' '}
              (e.g. <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{preview}-7899-M01</code>).
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--border-default)', boxSizing: 'border-box', fontFamily: 'inherit',
};
