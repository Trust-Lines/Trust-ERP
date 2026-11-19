'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { RoleDefinition } from './roleShared';

export const COLOR_PRESETS = [
  { bg: '#f1f5f9', fg: '#475569' },
  { bg: '#ddf1f6', fg: '#0891B2' },
  { bg: '#ddecec', fg: '#2D7D7D' },
  { bg: '#fbe6dc', fg: '#C7572B' },
  { bg: '#e7f6ec', fg: '#16A34A' },
  { bg: '#ece2fc', fg: '#7C3AED' },
  { bg: '#fef3c7', fg: '#B45309' },
  { bg: '#fce7f3', fg: '#DB2777' },
  { bg: '#e3eaf2', fg: '#0F2A44' },
];

type RoleDetails = Pick<RoleDefinition, 'label' | 'description' | 'color_bg' | 'color_fg'>;

type Props = { onClose: () => void } & (
  /** Create: POST /api/roles, then hands back the new role and closes itself. */
  | { role?: undefined; onCreated: (role: RoleDefinition) => void }
  /** Edit: PATCH /api/roles/:name with name / description / colour; the parent closes it. */
  | { role: RoleDefinition; onSaved: (patch: RoleDetails) => void }
);

/** Name, description and badge colour for a role — one form for both creating and editing. */
export function RoleDetailsModal(props: Props) {
  const { role, onClose } = props;
  const editing = !!role;
  const [label, setLabel] = useState(role?.label ?? '');
  const [desc, setDesc] = useState(role?.description ?? '');
  const [colorIdx, setColorIdx] = useState(role ? Math.max(0, COLOR_PRESETS.findIndex(c => c.bg === role.color_bg)) : 0);
  const [saving, setSaving] = useState(false);
  const color = COLOR_PRESETS[colorIdx];

  async function handleSubmit() {
    if (!label.trim()) return;
    setSaving(true);
    const res = props.role
      ? await fetch(`/api/roles/${props.role.name}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), description: desc, color_bg: color.bg, color_fg: color.fg }),
      })
      : await fetch('/api/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: label, label, description: desc, color_bg: color.bg, color_fg: color.fg }),
      });
    setSaving(false);
    if (!res.ok) { const e = await res.json() as { error?: string }; toast.error(e.error ?? 'Failed'); return; }

    if (props.role) {
      toast.success('Role updated');
      props.onSaved({ label: label.trim(), description: desc, color_bg: color.bg, color_fg: color.fg });
    } else {
      const { role: created } = await res.json() as { role: RoleDefinition };
      toast.success(`"${label}" created`);
      props.onCreated(created);
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>{role ? `Edit role · ${role.name}` : 'New custom role'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">{editing ? 'Display name' : 'Role name'}</label>
            <input className="form-input" placeholder={editing ? undefined : 'e.g. Senior Designer'} value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Brief description…" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Badge color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {COLOR_PRESETS.map((c, i) => (
                <button key={i} type="button" onClick={() => setColorIdx(i)} style={{
                  width: 30, height: 30, borderRadius: 6, background: c.bg,
                  border: `2px solid ${i === colorIdx ? c.fg : 'transparent'}`, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: c.fg }}>Aa</span>
                </button>
              ))}
            </div>
            {label && (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: color.bg, color: color.fg }}>
                  {label}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!label.trim() || saving} onClick={handleSubmit}>
            {editing ? (saving ? 'Saving…' : 'Save') : (saving ? 'Creating…' : 'Create role')}
          </button>
        </div>
      </div>
    </div>
  );
}
