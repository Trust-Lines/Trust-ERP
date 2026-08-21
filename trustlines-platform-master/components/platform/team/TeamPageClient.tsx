'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import {
  COMPANY_SIDES, OFFICES, DEPARTMENTS, SKILLS,
  COMPANY_SIDE_LABELS, OFFICE_LABELS, DEPARTMENT_LABELS, SKILL_LABELS,
  defaultCompanySideForRole, defaultDepartmentForRole,
} from '@/lib/profile/metadata';
import { REGIONS } from '@/lib/regions';
import type { UserRole } from '@/types/database';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  pm_client_id?: string | null;
  is_pm_supervisor?: boolean;
  company_side?: string | null;
  office?: string | null;
  department?: string | null;
  skills?: string[] | null;
  manager_id?: string | null;
  region_ids?: string[] | null;
  service_line_ids?: string[] | null;
  assigned_regions?: string[] | null;
}

interface ClientRow {
  id: string;
  name: string;
  code: string | null;
}

interface ServiceLineRow {
  id: string;
  name: string;
  client_id: string;
}

interface FranchiseRow {
  id: string;
  name: string;
  code: string | null;
  client_id: string;
  client: ClientRow | null;
}

interface RoleOption {
  name: string;
  label: string;
  color_bg: string;
  color_fg: string;
  is_system: boolean;
}

interface Props {
  profiles: ProfileRow[];
  clients: ClientRow[];
  franchises: FranchiseRow[];
  roleDefinitions: RoleOption[];
  serviceLines: ServiceLineRow[];
  metadataReady: boolean;
  userRole: UserRole;
  canEdit?: boolean;
}

const SALES_ROLES = ['sales_marketing_manager', 'sales_rep'];

const FALLBACK_LABELS: Partial<Record<string, string>> = {
  ops_manager:    'Ops Manager',
  pm_millwork:    'PM · Millwork',
  pm_ceiling:     'PM · Ceiling',
  trustlines_pm:  'TL Project Manager',
  tlines_pm:      'T-Lines PM',
  qc_responsible: 'QC Responsible',
  logistics:      'Logistics',
  accounting:     'Accounting',
  sales_marketing_manager: 'Sales & Marketing Manager',
  sales_rep:               'Sales Rep',
};

function RoleBadge({ role, roleMap }: { role: string; roleMap: Map<string, RoleOption> }) {
  const def = roleMap.get(role);
  const bg  = def?.color_bg ?? 'var(--bg-sunken)';
  const fg  = def?.color_fg ?? 'var(--fg-subtle)';
  const lbl = def?.label ?? FALLBACK_LABELS[role] ?? role;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: bg, color: fg }}>
      {lbl}
    </span>
  );
}

function InviteModal({
  clients,
  franchises,
  roleDefinitions,
  onClose,
  onSuccess,
}: {
  clients: ClientRow[];
  franchises: FranchiseRow[];
  roleDefinitions: RoleOption[];
  onClose: () => void;
  onSuccess: (p: ProfileRow) => void;
}) {
  const internalRoles = roleDefinitions.filter(r => r.name !== 'tlines_pm' && !SALES_ROLES.includes(r.name));
  const salesRoles    = roleDefinitions.filter(r => SALES_ROLES.includes(r.name));
  const defaultInternalRole = internalRoles.find(r => r.name === 'trustlines_pm')?.name ?? internalRoles[0]?.name ?? 'trustlines_pm';
  const defaultSalesRole    = salesRoles.find(r => r.name === 'sales_marketing_manager')?.name ?? salesRoles[0]?.name ?? 'sales_rep';

  const [type, setType]                   = useState<'internal' | 'client_pm' | 'sales'>('internal');
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [role, setRole]                   = useState<string>(defaultInternalRole);
  const [selectedClientId, setSelectedClientId]     = useState('');
  const [isGeneralPm, setIsGeneralPm]               = useState(false);
  const [sending, setSending]             = useState(false);

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
  }

  async function handleSend() {
    if (!fullName.trim() || !email.trim()) return;
    setSending(true);

    const res = await fetch('/api/team/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        email.trim(),
        full_name:    fullName.trim(),
        role:             type === 'client_pm' ? 'tlines_pm' : role,
        pm_client_id:     type === 'client_pm' && !isGeneralPm && selectedClientId ? selectedClientId : null,
        is_pm_supervisor: type === 'client_pm' && isGeneralPm,
      }),
    });

    const json = await res.json() as { success?: boolean; error?: string; userId?: string; alreadyExisted?: boolean };
    setSending(false);

    if (!res.ok) {
      toast.error(json.error ?? 'Failed to send invite');
      return;
    }

    const finalRole: string = type === 'client_pm' ? 'tlines_pm' : role;
    toast.success(json.alreadyExisted
      ? `${fullName} already exists — profile updated`
      : `Invite sent to ${email}`);

    onSuccess({
      id:         json.userId ?? '',
      full_name:  fullName.trim(),
      email:      email.trim(),
      role:       finalRole,
      is_active:  true,
      created_at: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Invite team member</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['internal', 'client_pm', 'sales'] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => { setType(t); setRole(t === 'sales' ? defaultSalesRole : defaultInternalRole); setSelectedClientId(''); setIsGeneralPm(false); }}
                style={{
                  flex: 1, padding: '9px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${type === t ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                  background: type === t ? 'var(--brand-teal-100)' : 'white',
                  color: type === t ? 'var(--brand-teal)' : 'var(--fg-muted)',
                }}
              >
                {t === 'internal' ? '🏢  Internal' : t === 'client_pm' ? '🤝  Client PM' : '📣  Sales'}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label required">Full name</label>
            <input
              className="form-input"
              placeholder="e.g. Sara Johnson"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label required">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {(type === 'internal' || type === 'sales') && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Role</label>
              <select
                className="form-input form-select"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                {(type === 'sales' ? salesRoles : internalRoles).map(r => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))}
              </select>
              {type === 'sales' && salesRoles.length === 0 && (
                <div className="form-hint">No Sales roles found — run migration 026 to seed them.</div>
              )}
            </div>
          )}

          {type === 'client_pm' && (
            <>
              <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 14, background: 'var(--brand-teal-100)', border: '1px solid var(--brand-teal)', fontSize: 12, color: 'var(--brand-teal-600)' }}>
                <strong>T-Lines PM</strong> — choose the region this PM manages, or make them the global <strong>Project Management Supervisor</strong> who oversees every region.
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', border: `1px solid ${isGeneralPm ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, borderRadius: 8, marginBottom: 12, cursor: 'pointer', background: isGeneralPm ? 'var(--brand-teal-100)' : 'white' }}>
                <input type="checkbox" checked={isGeneralPm} onChange={e => { setIsGeneralPm(e.target.checked); if (e.target.checked) setSelectedClientId(''); }} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12.5 }}>
                  <b>General PM — Project Management Supervisor</b>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>Sees all regions; signs the PO Project Management Supervisor box. Only one person.</div>
                </span>
              </label>

              {!isGeneralPm && (
                <div className="form-group">
                  <label className="form-label">Region this PM manages</label>
                  <select className="form-input form-select" value={selectedClientId} onChange={e => handleClientChange(e.target.value)}>
                    <option value="">Select region…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <div className="form-hint">No regions yet. <a href="/clients" style={{ color: 'var(--brand-teal)' }}>Add one in Clients →</a></div>
                  )}
                  <div className="form-hint">This PM is auto-assigned to new projects in this region.</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!fullName.trim() || !email.trim() || sending}
            onClick={handleSend}
          >
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  profile, roleDefinitions, clients, serviceLines, allProfiles, metadataReady, onClose, onSaved,
}: {
  profile: ProfileRow;
  roleDefinitions: RoleOption[];
  clients: ClientRow[];
  serviceLines: ServiceLineRow[];
  allProfiles: ProfileRow[];
  metadataReady: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<ProfileRow>) => void;
}) {
  const [fullName, setFullName]   = useState(profile.full_name);
  const [role, setRole]           = useState<string>(profile.role);
  const [isActive, setIsActive]   = useState(profile.is_active);
  const [pmClientId, setPmClientId]       = useState<string>(profile.pm_client_id ?? '');
  const [isGeneralPm, setIsGeneralPm]     = useState<boolean>(!!profile.is_pm_supervisor);
  const [saving, setSaving]       = useState(false);
  const isClientPm = role === 'tlines_pm';

  const [companySide, setCompanySide] = useState<string>(profile.company_side ?? defaultCompanySideForRole(profile.role) ?? '');
  const [office, setOffice]           = useState<string>(profile.office ?? '');
  const [department, setDepartment]   = useState<string>(profile.department ?? defaultDepartmentForRole(profile.role) ?? '');
  const [skills, setSkills]           = useState<string[]>(profile.skills ?? []);
  const [managerId, setManagerId]     = useState<string>(profile.manager_id ?? '');
  const [regionIds, setRegionIds]     = useState<string[]>(profile.region_ids ?? []);
  const [serviceIds, setServiceIds]   = useState<string[]>(profile.service_line_ids ?? []);
  const [assignedRegions, setAssignedRegions] = useState<string[]>(profile.assigned_regions ?? []);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const managerOptions = allProfiles.filter(p => p.id !== profile.id && p.is_active);

  async function handleSave() {
    setSaving(true);
    const meta = metadataReady ? {
      company_side: companySide || null,
      office: office || null,
      department: department || null,
      skills,
      manager_id: managerId || null,
      region_ids: regionIds,
      service_line_ids: serviceIds,
      assigned_regions: assignedRegions,
    } : {};
    const res = await fetch(`/api/team/${profile.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        full_name: fullName, role, is_active: isActive,
        pm_client_id:     isClientPm && !isGeneralPm ? (pmClientId || null) : null,
        is_pm_supervisor: isClientPm && isGeneralPm,
        ...meta,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      toast.error(e.error ?? 'Failed to update');
      return;
    }
    toast.success('Member updated');
    onSaved({
      full_name: fullName, role, is_active: isActive,
      pm_client_id: isClientPm && !isGeneralPm ? (pmClientId || null) : null,
      is_pm_supervisor: isClientPm && isGeneralPm,
      ...meta,
    });
    onClose();
  }

  const allRoles = roleDefinitions;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Edit member</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Full name</label>
            <input
              className="form-input"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Role</label>
            <select
              className="form-input form-select"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
            >
              {allRoles.map(r => (
                <option key={r.name} value={r.name}>{r.label}</option>
              ))}
            </select>
          </div>

          {metadataReady && (
            <>
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '14px 0 12px', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                  Organisation
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-company-side">Company side</label>
                  <select id="edit-company-side" className="form-input form-select" value={companySide} onChange={e => setCompanySide(e.target.value)}>
                    <option value="">—</option>
                    {COMPANY_SIDES.map(s => <option key={s} value={s}>{COMPANY_SIDE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-office">Office</label>
                  <select id="edit-office" className="form-input form-select" value={office} onChange={e => setOffice(e.target.value)}>
                    <option value="">—</option>
                    {OFFICES.map(o => <option key={o} value={o}>{OFFICE_LABELS[o]}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-department">Department</label>
                  <select id="edit-department" className="form-input form-select" value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-manager">Manager</label>
                  <select id="edit-manager" className="form-input form-select" value={managerId} onChange={e => setManagerId(e.target.value)}>
                    <option value="">—</option>
                    {managerOptions.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="form-group" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
                <legend className="form-label" style={{ padding: 0 }}>Skills</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SKILLS.map(s => {
                    const on = skills.includes(s);
                    return (
                      <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand-teal-100)' : 'white' }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(skills, setSkills, s)} style={{ margin: 0 }} />
                        {SKILL_LABELS[s]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="form-group" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
                <legend className="form-label" style={{ padding: 0 }}>Client Regions (accounts)</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clients.map(c => {
                    const on = regionIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand-teal-100)' : 'white' }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(regionIds, setRegionIds, c.id)} style={{ margin: 0 }} />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="form-group" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
                <legend className="form-label" style={{ padding: 0 }}>T-Lines Regions (CRM visibility)</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {REGIONS.map(r => {
                    const on = assignedRegions.includes(r.code);
                    return (
                      <label key={r.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand-teal-100)' : 'white' }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(assignedRegions, setAssignedRegions, r.code)} style={{ margin: 0 }} />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                {assignedRegions.length === 0 && (
                  <p style={{ fontSize: 11.5, color: 'var(--fg-faint)', margin: '4px 0 0' }}>
                    No region assigned yet — this person still sees only their own leads/opportunities (fallback).
                  </p>
                )}
              </fieldset>

              {serviceLines.length > 0 && (
                <fieldset className="form-group" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
                  <legend className="form-label" style={{ padding: 0 }}>Service lines</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto' }}>
                    {serviceLines.map(s => {
                      const on = serviceIds.includes(s.id);
                      const region = clients.find(c => c.id === s.client_id);
                      return (
                        <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand-teal-100)' : 'white' }}>
                          <input type="checkbox" checked={on} onChange={() => toggle(serviceIds, setServiceIds, s.id)} style={{ margin: 0 }} />
                          {s.name}{region?.code ? ` · ${region.code}` : ''}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </>
          )}

          {isClientPm && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', border: `1px solid ${isGeneralPm ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, borderRadius: 8, marginBottom: 10, cursor: 'pointer', background: isGeneralPm ? 'var(--brand-teal-100)' : 'white' }}>
                <input type="checkbox" checked={isGeneralPm} onChange={e => { setIsGeneralPm(e.target.checked); if (e.target.checked) setPmClientId(''); }} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12.5 }}><b>General PM — Project Management Supervisor</b><div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>Oversees all regions; signs the PO supervisor box.</div></span>
              </label>
              {!isGeneralPm && (
                <>
                  <label className="form-label">Region this PM manages</label>
                  <select className="form-input form-select" value={pmClientId} onChange={e => setPmClientId(e.target.value)}>
                    <option value="">No region</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                  </select>
                </>
              )}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              Active account
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!fullName.trim() || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({
  profile, onClose, onDeleted,
}: {
  profile: ProfileRow;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/team/${profile.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      toast.error(e.error ?? 'Failed to deactivate');
      return;
    }
    toast.success(`${profile.full_name} deleted`);
    onDeleted(profile.id);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Delete member</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--fg-default)', margin: 0 }}>
            Are you sure you want to permanently delete <strong>{profile.full_name}</strong>?
            This will remove their account and cannot be undone.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--status-danger)', color: 'white', border: 'none' }}
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  profile, franchise, isOps, roleMap, onEdit, onDelete,
}: {
  profile:   ProfileRow;
  franchise?: FranchiseRow | null;
  isOps:     boolean;
  roleMap:   Map<string, RoleOption>;
  onEdit:    (p: ProfileRow) => void;
  onDelete:  (p: ProfileRow) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <Avatar name={profile.full_name || profile.email} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{profile.full_name || '—'}</span>
          <RoleBadge role={profile.role} roleMap={roleMap} />
          {!profile.is_active && (
            <span className="pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)', fontSize: 9 }}>
              Inactive
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
          {profile.email}
          {franchise && (
            <span style={{ marginLeft: 10, color: 'var(--brand-teal)' }}>
              · {franchise.client?.name} › {franchise.name}
            </span>
          )}
        </div>
      </div>
      {isOps && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onEdit(profile)}
            title="Edit member"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 6px', borderRadius: 5, color: 'var(--fg-subtle)',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(profile)}
            title="Deactivate member"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 6px', borderRadius: 5, color: 'var(--fg-subtle)',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--status-danger-bg)'; e.currentTarget.style.color = 'var(--status-danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--fg-subtle)'; }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
          {count} member{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="card-body flush">
        {count === 0
          ? <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--fg-faint)', textAlign: 'center' }}>No members yet</div>
          : children}
      </div>
    </div>
  );
}

export function TeamPageClient({ profiles: init, clients, franchises: rawFranchises, roleDefinitions, serviceLines, metadataReady, userRole, canEdit }: Props) {
  const router  = useRouter();
  const [profiles, setProfiles]     = useState<ProfileRow[]>(init);
  const [showInvite, setShowInvite] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const isOps = canEdit ?? (userRole === 'ops_manager');

  const roleMap = new Map(roleDefinitions.map(r => [r.name, r]));

  const sales     = profiles.filter(p => SALES_ROLES.includes(p.role));
  const internal  = profiles.filter(p => p.role !== 'tlines_pm' && !SALES_ROLES.includes(p.role));
  const clientPMs = profiles.filter(p => p.role === 'tlines_pm');

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const franchises: FranchiseRow[] = rawFranchises.map(f => ({
    ...f,
    client: f.client_id ? (clientMap.get(f.client_id) ?? null) : null,
  }));
  const franchiseByPm = new Map<string, FranchiseRow>();

  function handleInvited(np: ProfileRow) {
    setProfiles(prev => {
      const exists = prev.find(p => p.id === np.id);
      return exists ? prev.map(p => p.id === np.id ? np : p) : [...prev, np];
    });
    router.refresh();
  }

  function handleSaved(id: string, patch: Partial<ProfileRow>) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    router.refresh();
  }

  function handleDeleted(id: string) {
    setProfiles(prev => prev.filter(p => p.id !== id));
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Team</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {profiles.length} member{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isOps && (
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            + Invite member
          </button>
        )}
      </div>

      <Section title="Internal staff" count={internal.length}>
        {internal.map(p => (
          <MemberRow
            key={p.id} profile={p} isOps={isOps} roleMap={roleMap}
            onEdit={setEditTarget} onDelete={setDeleteTarget}
          />
        ))}
      </Section>

      <Section title="Client PMs (T-Lines)" count={clientPMs.length}>
        {clientPMs.map(p => (
          <MemberRow
            key={p.id} profile={p} franchise={franchiseByPm.get(p.id) ?? null}
            isOps={isOps} roleMap={roleMap} onEdit={setEditTarget} onDelete={setDeleteTarget}
          />
        ))}
        {isOps && clientPMs.length === 0 && (
          <div style={{ padding: '8px 18px 16px', textAlign: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--brand-teal)' }}
              onClick={() => setShowInvite(true)}
            >
              Invite first Client PM →
            </button>
          </div>
        )}
      </Section>

      <Section title="Sales & Marketing" count={sales.length}>
        {sales.map(p => (
          <MemberRow
            key={p.id} profile={p} isOps={isOps} roleMap={roleMap}
            onEdit={setEditTarget} onDelete={setDeleteTarget}
          />
        ))}
      </Section>

      {showInvite && isOps && (
        <InviteModal
          clients={clients}
          franchises={franchises}
          roleDefinitions={roleDefinitions}
          onClose={() => setShowInvite(false)}
          onSuccess={handleInvited}
        />
      )}

      {editTarget && (
        <EditModal
          profile={editTarget}
          roleDefinitions={roleDefinitions}
          clients={clients}
          serviceLines={serviceLines}
          allProfiles={profiles}
          metadataReady={metadataReady}
          onClose={() => setEditTarget(null)}
          onSaved={patch => handleSaved(editTarget.id, patch)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          profile={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
