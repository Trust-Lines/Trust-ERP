'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { Plus, Trash2, ShieldCheck, Monitor, ToggleRight, ToggleLeft, SquarePen, PenLine, Signature, Eye, Bell, TrendingUp, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { PERMISSION_GROUPS, effectivePermissions, hasDefault, pageAllowed, pageInherited, type PermCategory } from '@/lib/permissions/catalog';

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

const GROUP_ICONS: Record<PermCategory, LucideIcon> = {
  page: Monitor, edit: PenLine, sign: Signature, view: Eye, notify: Bell, progress: TrendingUp,
};

// Figma "Primary button" at the Roles page's 32px height: #2B3D55 light, #EEF2F6 dark.
const ACTION_BTN = 'gap-2 rounded-[6px] px-4 font-medium bg-[var(--color-secondary-700)] text-ui-btn-primary-fg hover:bg-[var(--color-secondary-600)] active:bg-[var(--color-secondary-600)] dark:bg-[var(--color-secondary-50)]';
const HEADING = 'text-[var(--color-secondary-700)] dark:text-[var(--color-secondary-50)]';

// A role's stored pair is tint + strong colour. Dark mode swaps them, like the status tones in globals.css.
function roleVars(role: RoleDefinition) {
  return { '--role-tint': role.color_bg, '--role-strong': role.color_fg } as CSSProperties;
}
const ROLE_SURFACE = 'bg-[var(--role-tint)] dark:bg-[var(--role-strong)]';
const ROLE_TEXT = 'text-[var(--role-strong)] dark:text-[var(--role-tint)]';

// Figma: 54×28 track with an inset 23×22 thumb — bigger and squarer than components/ui/switch.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="inline-flex h-7 w-[54px] shrink-0 cursor-pointer items-center rounded-[8px] bg-ui-selected-bg p-[3px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring data-checked:bg-[var(--color-secondary-700)] dark:data-checked:bg-[var(--color-secondary-50)]"
    >
      <SwitchPrimitive.Thumb className="h-[22px] w-[23px] rounded-[4px] bg-ui-page-bg transition-transform duration-150 data-checked:translate-x-[25px]" />
    </SwitchPrimitive.Root>
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
  roleName, perms, isSystem, onChange,
}: {
  roleName: string;
  perms:    Record<string, boolean>;
  isSystem: boolean;
  onChange: (p: Record<string, boolean>) => void;
}) {
  const isAll = !!perms['all'];
  // Pages use the same rule as the app (pageAllowed): a page the role hasn't set yet follows its
  // parent page / old default, so the switch shows what the role can really open today.
  const isOn = (category: string, key: string) => (category === 'page' || hasDefault(key) ? pageAllowed(roleName, perms, key) : !!perms[key]);

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
    <div className="flex flex-col gap-4">
      {isSystem && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--status-info-bg)', border: '1px solid color-mix(in srgb, var(--status-info) 35%, transparent)', borderRadius: 8, fontSize: 12, color: 'var(--status-info-fg)' }}>
          🛡️ System role — defaults shown. You can still tailor its permissions; changes are saved.
        </div>
      )}

      {PERMISSION_GROUPS.map(group => {
        const keys = group.perms.map(p => p.key);
        const granted = keys.filter(k => isOn(group.category, k)).length;
        const allOn = granted === keys.length;
        const GroupIcon = GROUP_ICONS[group.category];
        return (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-4 rounded-[10px] border border-ui-divider bg-ui-surface-elevated px-2 pb-2.5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <div className="flex min-h-9 min-w-0 items-center gap-1.5">
                <GroupIcon size={26} className={`shrink-0 ${HEADING}`} aria-hidden />
                <h2 className={`m-0 text-[20px] font-semibold leading-normal ${HEADING}`}>{group.title}</h2>
                <span className="ml-1 whitespace-nowrap text-[12px] text-ui-text-secondary">{granted}/{keys.length} enabled</span>
              </div>
              <Button className={ACTION_BTN} onClick={() => setGroup(keys, !allOn)}>
                {allOn ? <ToggleLeft aria-hidden /> : <ToggleRight aria-hidden />}
                {allOn ? 'Clear All' : 'Enable All'}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {group.perms.map(p => {
                const on = isOn(group.category, p.key);
                const inherited = pageInherited(perms, p.key);
                return (
                  <div key={p.key} className="flex items-center justify-between gap-3 rounded-[6px] border border-ui-divider bg-ui-surface px-6 py-4">
                    <div className="min-w-0">
                      <div className={`text-[20px] font-semibold leading-[1.35] ${HEADING}`}>{p.label}</div>
                      {p.hint && <div className="mt-0.5 text-[12px] text-ui-text-secondary">{p.hint}</div>}
                      {inherited && <div className="mt-0.5 text-[11px] italic text-ui-text-secondary">Follows the default — switch it to set it for this role</div>}
                    </div>
                    <Toggle checked={on} onChange={val => set(p.key, val)} label={p.label} />
                  </div>
                );
              })}
            </div>
          </section>
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
    // The stored map, or the code defaults when the role has none saved — what the app really uses.
    ? (pendingPerms[current.name] ?? effectivePermissions(current.name, current.permissions))
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

  const customRoles = roles.filter(r => !r.is_system);

  const PROTECTED = ['ops_manager'];

  function applyDetails(name: string, patch: Partial<RoleDefinition>) {
    setRoles(prev => prev.map(r => r.name === name ? { ...r, ...patch } : r));
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Admin' }, { label: 'Roles & permissions', href: '/roles' }]} />
        <h1 className={`m-0 text-[28px] font-semibold leading-[1.35] ${HEADING}`}>Roles &amp; permissions</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {roles.length} roles · {customRoles.length} custom
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="w-full shrink-0 overflow-hidden rounded-[10px] border border-ui-divider lg:w-[315px]">
          <div className="flex items-center justify-between gap-3 border-b border-ui-divider bg-ui-surface py-2.5 pl-4 pr-2.5">
            <h2 className={`m-0 text-[20px] font-semibold leading-9 ${HEADING}`}>Roles</h2>
            <Button
              className="gap-2 rounded-[6px] bg-ui-btn-accent px-4 font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:brightness-95 active:bg-ui-btn-accent dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent"
              onClick={() => setShowNew(true)}
            >
              <Plus size={14} aria-hidden /> Add Role
            </Button>
          </div>
          {roles.length === 0 ? (
            <div className="bg-ui-surface-elevated p-6 text-center text-[13px] text-ui-text-secondary">No roles yet</div>
          ) : roles.map(r => (
            <RoleItem key={r.name} role={r} isSelected={selected === r.name} isDirty={!!pendingPerms[r.name]} onSelect={() => setSelected(r.name)}
              onDelete={PROTECTED.includes(r.name) ? undefined : () => handleDelete(r.name)} deleting={deleting === r.name} />
          ))}
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          {current ? (
            <>
              <div
                className={`sticky top-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[var(--role-strong)] px-4 py-2.5 ${ROLE_SURFACE}`}
                style={roleVars(current)}
              >
                <h2 className={`m-0 min-w-0 text-[20px] font-semibold leading-9 ${ROLE_TEXT}`}>{current.label}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {isDirty && (
                    <>
                      <Button variant="outline" className="rounded-[6px] bg-ui-surface-elevated font-medium"
                        onClick={() => setPendingPerms(prev => { const n = { ...prev }; delete n[current.name]; return n; })}
                        disabled={saving}>Discard</Button>
                      <Button className={ACTION_BTN} onClick={handleSave} loading={saving} disabled={saving}>Save changes</Button>
                    </>
                  )}
                  <Button
                    className="gap-2 rounded-[6px] bg-[var(--role-strong)] px-4 font-medium text-white hover:bg-[var(--role-strong)] hover:brightness-95 active:bg-[var(--role-strong)] dark:bg-[var(--role-tint)] dark:text-primary-950 dark:hover:bg-[var(--role-tint)] dark:active:bg-[var(--role-tint)]"
                    onClick={() => setEditDetails(current)}
                  >
                    <SquarePen aria-hidden /> Edit Details
                  </Button>
                </div>
              </div>
              <PermissionEditor
                roleName={current.name}
                perms={livePerms}
                isSystem={current.is_system}
                onChange={p => setPendingPerms(prev => ({ ...prev, [current.name]: p }))}
              />
            </>
          ) : (
            <div className="rounded-[10px] border border-ui-divider bg-ui-surface-elevated p-10 text-center text-[13px] text-ui-text-secondary">
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
    <div
      className={`flex min-h-14 items-center border-b border-ui-divider pr-4 last:border-b-0 ${ROLE_SURFACE} ${isSelected ? 'shadow-[inset_4px_0_0_var(--role-strong)] dark:shadow-[inset_4px_0_0_var(--role-tint)]' : ''}`}
      style={roleVars(role)}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch border-0 bg-transparent py-2 pl-4 pr-3 text-left text-[14px] font-semibold leading-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring ${ROLE_TEXT}`}
      >
        <span className="min-w-0">{role.label}</span>
        {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-warning-normal" aria-label="Unsaved changes" />}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Delete"
          aria-label={`Delete role ${role.label}`}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-0 bg-ui-surface-elevated p-1 text-[var(--status-t10-fg)] outline-none hover:bg-[var(--status-t10-bg)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:opacity-60"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
