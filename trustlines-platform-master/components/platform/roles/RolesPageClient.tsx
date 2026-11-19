'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { effectivePermissions } from '@/lib/permissions/catalog';
import { HEADING, PROTECTED_ROLES, ROLE_SURFACE, ROLE_TEXT, roleVars, type RoleDefinition } from './roleShared';
import { PermissionEditor } from './PermissionEditor';
import { RoleDetailsModal } from './RoleDetailsModal';
import { RoleItem } from './RoleItem';

export type { RoleDefinition } from './roleShared';

interface Props { initialRoles: RoleDefinition[] }

/** Admin → Roles & permissions: role list on the left, the selected role's permissions on the right. */
export function RolesPageClient({ initialRoles }: Props) {
  const [roles, setRoles]               = useState<RoleDefinition[]>(initialRoles);
  const [selected, setSelected]         = useState<string>(initialRoles[0]?.name ?? '');
  const [showNew, setShowNew]           = useState(false);
  // Unsaved permission edits, per role name.
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
  const customRoles = roles.filter(r => !r.is_system);

  function discard(name: string) {
    setPendingPerms(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

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
    discard(current.name);
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
            <Button variant="accent" onClick={() => setShowNew(true)}>
              <Plus size={14} aria-hidden /> Add Role
            </Button>
          </div>
          {roles.length === 0 ? (
            <div className="bg-ui-surface-elevated p-6 text-center text-[13px] text-ui-text-secondary">No roles yet</div>
          ) : roles.map(r => (
            <RoleItem key={r.name} role={r} isSelected={selected === r.name} isDirty={!!pendingPerms[r.name]} onSelect={() => setSelected(r.name)}
              onDelete={PROTECTED_ROLES.includes(r.name) ? undefined : () => handleDelete(r.name)} deleting={deleting === r.name} />
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
                      <Button variant="outline" onClick={() => discard(current.name)} disabled={saving}>Discard</Button>
                      <Button onClick={handleSave} loading={saving} disabled={saving}>Save changes</Button>
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
        <RoleDetailsModal
          onClose={() => setShowNew(false)}
          onCreated={r => { setRoles(prev => [...prev, r]); setSelected(r.name); }}
        />
      )}

      {editDetails && (
        <RoleDetailsModal
          role={editDetails}
          onClose={() => setEditDetails(null)}
          onSaved={patch => { applyDetails(editDetails.name, patch); setEditDetails(null); }}
        />
      )}
    </div>
  );
}
