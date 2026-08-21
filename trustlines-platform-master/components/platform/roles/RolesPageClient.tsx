'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { PERMISSION_GROUPS } from '@/lib/permissions/catalog';

export interface RoleDefinition {
  name:        string;
  label:       string;
  description: string | null;
  color_bg:    string;
  color_fg:    string;
  is_system:   boolean;
  permissions: Record<string, boolean>;
}

interface Props { initialRoles: RoleDefinition[] }

const COLOR_PRESETS = [
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={e => { e.stopPropagation(); if (!disabled) onChange(!checked); }}
      style={{
        width: 38, height: 22, borderRadius: 11, flexShrink: 0,
        background: checked ? 'var(--brand-teal)' : '#d1d5db',
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 150ms',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, borderRadius: '50%',
        width: 16, height: 16, background: 'white',
        left: checked ? 19 : 3,
        transition: 'left 150ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

function NewRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: RoleDefinition) => void }) {
  const [label, setLabel]       = useState('');
  const [desc, setDesc]         = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [saving, setSaving]     = useState(false);

  async function handleCreate() {
    if (!label.trim()) return;
    setSaving(true);
    const color = COLOR_PRESETS[colorIdx];
    const res = await fetch('/api/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: label, label, description: desc, color_bg: color.bg, color_fg: color.fg }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json() as { error?: string }; toast.error(e.error ?? 'Failed'); return; }
    const { role } = await res.json() as { role: RoleDefinition };
    toast.success(`"${label}" created`);
    onCreated(role);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>New custom role</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Role name</label>
            <input className="form-input" placeholder="e.g. Senior Designer" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
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
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: COLOR_PRESETS[colorIdx].bg, color: COLOR_PRESETS[colorIdx].fg }}>
                  {label}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!label.trim() || saving} onClick={handleCreate}>
            {saving ? 'Creating…' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionEditor({
  perms, isSystem, onChange,
}: {
  perms:    Record<string, boolean>;
  isSystem: boolean;
  onChange: (p: Record<string, boolean>) => void;
}) {
  const isAll = !!perms['all'];

  function set(key: string, val: boolean) { onChange({ ...perms, [key]: val }); }

  function setGroup(keys: string[], val: boolean) {
    const patch = { ...perms };
    keys.forEach(k => { patch[k] = val; });
    onChange(patch);
  }

  if (isAll) {
    return (
      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={34} color="var(--brand-teal)" />
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Superadmin — full access</p>
        <p style={{ fontSize: 12, color: 'var(--fg-faint)', margin: 0, textAlign: 'center' }}>This role bypasses every permission check (signing, visibility, notifications, progress).</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {isSystem && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
          🛡️ System role — defaults shown. You can still tailor its permissions; changes are saved.
        </div>
      )}

      {PERMISSION_GROUPS.map(group => {
        const keys = group.perms.map(p => p.key);
        const granted = keys.filter(k => !!perms[k]).length;
        const allOn = granted === keys.length;
        return (
          <div key={group.category} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 16 }}>{group.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{group.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-faint)' }}>{granted}/{keys.length} enabled</div>
              </div>
              <button
                onClick={() => setGroup(keys, !allOn)}
                disabled={false}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: '#fff', color: 'var(--brand-teal)', cursor: 'pointer' }}>
                {allOn ? 'Clear all' : 'Enable all'}
              </button>
            </div>
            <div>
              {group.perms.map((p, idx) => {
                const on = !!perms[p.key];
                return (
                  <div key={p.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '10px 14px', background: on ? '#f0fdfa' : '#fff',
                    borderBottom: idx < group.perms.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-default)' }}>{p.label}</div>
                      {p.hint && <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>{p.hint}</div>}
                    </div>
                    <Toggle checked={on} onChange={val => set(p.key, val)} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RolesPageClient({ initialRoles }: Props) {
  const [roles, setRoles]               = useState<RoleDefinition[]>(initialRoles);
  const [selected, setSelected]         = useState<string>(initialRoles[0]?.name ?? '');
  const [showNew, setShowNew]           = useState(false);
  const [pendingPerms, setPendingPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [editDetails, setEditDetails]   = useState<RoleDefinition | null>(null);

  const current = roles.find(r => r.name === selected);
  const livePerms: Record<string, boolean> = current
    ? (pendingPerms[current.name] ?? current.permissions)
    : {};
  const isDirty = current ? pendingPerms[current.name] !== undefined : false;

  async function handleSave() {
    if (!current || !isDirty) return;
    setSaving(true);
    const res = await fetch(`/api/roles/${current.name}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: pendingPerms[current.name] }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json() as { error?: string }; toast.error(e.error ?? 'Failed'); return; }
    setRoles(prev => prev.map(r => r.name === current.name ? { ...r, permissions: pendingPerms[current.name] } : r));
    setPendingPerms(prev => { const n = { ...prev }; delete n[current.name]; return n; });
    toast.success('Permissions saved');
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Delete role "${name}"?`)) return;
    setDeleting(name);
    const res = await fetch(`/api/roles/${name}`, { method: 'DELETE' });
    setDeleting(null);
    if (!res.ok) { const e = await res.json() as { error?: string }; toast.error(e.error ?? 'Failed'); return; }
    setRoles(prev => prev.filter(r => r.name !== name));
    if (selected === name) setSelected(roles.find(r => r.name !== name)?.name ?? '');
    toast.success('Role deleted');
  }

  const systemRoles = roles.filter(r => r.is_system);
  const customRoles = roles.filter(r => !r.is_system);

  const PROTECTED = ['ops_manager'];

  function applyDetails(name: string, patch: Partial<RoleDefinition>) {
    setRoles(prev => prev.map(r => r.name === name ? { ...r, ...patch } : r));
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Roles & Permissions</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {roles.length} roles · {customRoles.length} custom
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New role
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {systemRoles.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-faint)' }}>
                System
              </div>
              {systemRoles.map(r => (
                <RoleItem key={r.name} role={r} isSelected={selected === r.name} isDirty={!!pendingPerms[r.name]} onSelect={() => setSelected(r.name)}
                  onDelete={PROTECTED.includes(r.name) ? undefined : () => handleDelete(r.name)} deleting={deleting === r.name} />
              ))}
            </div>
          )}
          {(customRoles.length > 0) && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-faint)' }}>
                Custom
              </div>
              {customRoles.map(r => (
                <RoleItem key={r.name} role={r} isSelected={selected === r.name} isDirty={!!pendingPerms[r.name]} onSelect={() => setSelected(r.name)}
                  onDelete={() => handleDelete(r.name)} deleting={deleting === r.name} />
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-teal)' }} onClick={() => setShowNew(true)}>
            <Plus size={12} /> New custom role
          </button>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {current ? (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: current.color_bg, color: current.color_fg }}>
                  {current.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
                  {current.is_system ? 'System' : 'Custom'} · {current.name}
                </span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: isDirty ? 0 : 'auto' }} onClick={() => setEditDetails(current)}>Edit details</button>
                {isDirty && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setPendingPerms(prev => { const n = { ...prev }; delete n[current.name]; return n; })}
                      disabled={saving}>Discard</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ padding: 20, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <PermissionEditor
                  perms={livePerms}
                  isSystem={current.is_system}
                  onChange={p => setPendingPerms(prev => ({ ...prev, [current.name]: p }))}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>
              Select a role to view permissions
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewRoleModal
          onClose={() => setShowNew(false)}
          onCreated={r => { setRoles(prev => [...prev, r]); setSelected(r.name); }}
        />
      )}

      {editDetails && (
        <EditRoleModal
          role={editDetails}
          onClose={() => setEditDetails(null)}
          onSaved={patch => { applyDetails(editDetails.name, patch); setEditDetails(null); }}
        />
      )}
    </div>
  );
}

function EditRoleModal({ role, onClose, onSaved }: {
  role: RoleDefinition; onClose: () => void; onSaved: (patch: Partial<RoleDefinition>) => void;
}) {
  const [label, setLabel]   = useState(role.label);
  const [desc, setDesc]     = useState(role.description ?? '');
  const [colorIdx, setColorIdx] = useState(Math.max(0, COLOR_PRESETS.findIndex(c => c.bg === role.color_bg)));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    const color = COLOR_PRESETS[colorIdx];
    const res = await fetch(`/api/roles/${role.name}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), description: desc, color_bg: color.bg, color_fg: color.fg }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json() as { error?: string }; toast.error(e.error ?? 'Failed'); return; }
    toast.success('Role updated');
    onSaved({ label: label.trim(), description: desc, color_bg: color.bg, color_fg: color.fg });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Edit role · {role.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Display name</label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Brief description…" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Badge color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {COLOR_PRESETS.map((c, i) => (
                <button key={i} type="button" onClick={() => setColorIdx(i)} style={{ width: 30, height: 30, borderRadius: 6, background: c.bg, border: `2px solid ${i === colorIdx ? c.fg : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: c.fg }}>Aa</span>
                </button>
              ))}
            </div>
            {label && <div style={{ marginTop: 10 }}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: COLOR_PRESETS[colorIdx].bg, color: COLOR_PRESETS[colorIdx].fg }}>{label}</span></div>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!label.trim() || saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function RoleItem({ role, isSelected, isDirty, onSelect, onDelete, deleting }: {
  role: RoleDefinition; isSelected: boolean; isDirty: boolean;
  onSelect: () => void; onDelete?: () => void; deleting?: boolean;
}) {
  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
      cursor: 'pointer', borderLeft: `3px solid ${isSelected ? 'var(--brand-teal)' : 'transparent'}`,
      background: isSelected ? 'var(--bg-sunken)' : 'transparent',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0, background: role.color_bg, color: role.color_fg }}>
        {role.label}
      </span>
      {isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} disabled={deleting} title="Delete"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: 'var(--fg-faint)', display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-faint)'; }}>
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
