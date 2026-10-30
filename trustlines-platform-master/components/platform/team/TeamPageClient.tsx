'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowDownUp, ChevronDown, Ellipsis, Pencil, Search, Trash2, UserRoundPlus, Users, X } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  COMPANY_SIDES, OFFICES, DEPARTMENTS, SKILLS,
  COMPANY_SIDE_LABELS, OFFICE_LABELS, DEPARTMENT_LABELS, SKILL_LABELS,
  defaultCompanySideForRole, defaultDepartmentForRole,
} from '@/lib/profile/metadata';
import { REGIONS } from '@/lib/regions';
import type { UserRole } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import { EmptyState } from '@/components/ui/empty-state';

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

// Figma "Team Members" (node 351:3365).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5';

// Figma "Selection checkbox": 16px, 3px radius, input border + background.
const CHECKBOX = 'size-4 rounded-[3px] border-[var(--ui-input-border)] bg-ui-input-bg dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg';

type SortKey = 'newest' | 'oldest' | 'name';

// Every role uses the t4 (purple) tone, as in the design; the theme swaps it for dark mode.
function RoleBadge({ role, roleMap }: { role: string; roleMap: Map<string, RoleOption> }) {
  const lbl = roleMap.get(role)?.label ?? FALLBACK_LABELS[role] ?? role;
  return (
    <span
      title={lbl}
      className="inline-flex h-9 max-w-full items-center rounded-[4px] border border-solid px-4 py-[3px] text-[12px] font-medium leading-4"
      style={{ background: 'var(--status-t4-bg)', color: 'var(--status-t4-fg)', borderColor: 'var(--status-t4-fg)' }}
    >
      <span className="truncate">{lbl}</span>
    </span>
  );
}

function StatusChip({ active }: { active: boolean }) {
  const tone = active ? 't9' : 't0';
  return (
    <span
      className="inline-flex h-9 items-center rounded-[4px] border border-solid px-8 text-[12px] font-medium uppercase leading-4"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)`, borderColor: `var(--status-${tone}-fg)` }}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function regionText(codes: string[] | null | undefined): string {
  const shorts = (codes ?? []).map(c => REGIONS.find(r => r.code === c)?.codeShort ?? c);
  return shorts.length ? `T Lines (${shorts.join(', ')})` : '—';
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
                  background: type === t ? 'var(--brand-teal-100)' : 'var(--bg-surface)',
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
              <Select
                className="form-input form-select"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                {(type === 'sales' ? salesRoles : internalRoles).map(r => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))}
              </Select>
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

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', border: `1px solid ${isGeneralPm ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, borderRadius: 8, marginBottom: 12, cursor: 'pointer', background: isGeneralPm ? 'var(--brand-teal-100)' : 'var(--bg-surface)' }}>
                <input type="checkbox" checked={isGeneralPm} onChange={e => { setIsGeneralPm(e.target.checked); if (e.target.checked) setSelectedClientId(''); }} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12.5 }}>
                  <b>General PM — Project Management Supervisor</b>
                  <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1 }}>Sees all regions; signs the PO Project Management Supervisor box. Only one person.</div>
                </span>
              </label>

              {!isGeneralPm && (
                <div className="form-group">
                  <label className="form-label">Region this PM manages</label>
                  <Select className="form-input form-select" value={selectedClientId} onChange={e => handleClientChange(e.target.value)}>
                    <option value="">Select region…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                    ))}
                  </Select>
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

// Same field language as New Customer / New lead: 12px label, 42px input, outlined Cancel + dark primary.
const FORM_LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const FORM_FIELD = 'min-h-[42px] w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const FORM_SELECT = 'h-[42px] min-h-[42px] w-full rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading';
const SECTION_TITLE = 'm-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-ui-text-secondary';

function ToggleChip({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-solid px-2.5 py-1.5 text-[12px] font-medium transition-colors',
        on
          ? 'border-[var(--color-secondary-500)] bg-ui-selected-bg text-[var(--color-secondary-700)] dark:text-ui-heading'
          : 'border-ui-divider bg-ui-input-bg text-ui-body hover:bg-ui-hover-bg',
      )}
    >
      <input type="checkbox" checked={on} onChange={onToggle} className="m-0 accent-[var(--color-secondary-700)]" />
      {children}
    </label>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
  const dash = { value: '', label: '—' };

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="edit-member-title" onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col gap-6 overflow-y-auto rounded-[8px] border border-ui-divider bg-ui-page-bg p-5 shadow-04"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-member-title" className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING)}>Edit member</h2>
            <p className="m-0 mt-1 text-[13px] text-ui-body">{profile.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-full-name" className={FORM_LABEL}>Full name<span className="text-error-normal" aria-hidden>*</span></label>
              <input id="edit-full-name" className={FORM_FIELD} value={fullName} onChange={e => setFullName(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="edit-role" className={FORM_LABEL}>Role<span className="text-error-normal" aria-hidden>*</span></label>
              <FilterSelect
                id="edit-role" className={FORM_SELECT}
                value={role} onValueChange={v => setRole((v ?? role) as UserRole)}
                options={allRoles.map(r => ({ value: r.name, label: r.label }))}
              />
            </div>
          </div>

          {metadataReady && (
            <>
              <div className="border-t border-ui-divider pt-4">
                <p className={SECTION_TITLE}>Organisation</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-company-side" className={FORM_LABEL}>Company side</label>
                  <FilterSelect
                    id="edit-company-side" className={FORM_SELECT}
                    value={companySide} onValueChange={v => setCompanySide(v ?? '')}
                    options={[dash, ...COMPANY_SIDES.map(s => ({ value: s, label: COMPANY_SIDE_LABELS[s] }))]}
                  />
                </div>
                <div>
                  <label htmlFor="edit-office" className={FORM_LABEL}>Office</label>
                  <FilterSelect
                    id="edit-office" className={FORM_SELECT}
                    value={office} onValueChange={v => setOffice(v ?? '')}
                    options={[dash, ...OFFICES.map(o => ({ value: o, label: OFFICE_LABELS[o] }))]}
                  />
                </div>
                <div>
                  <label htmlFor="edit-department" className={FORM_LABEL}>Department</label>
                  <FilterSelect
                    id="edit-department" className={FORM_SELECT}
                    value={department} onValueChange={v => setDepartment(v ?? '')}
                    options={[dash, ...DEPARTMENTS.map(d => ({ value: d, label: DEPARTMENT_LABELS[d] }))]}
                  />
                </div>
                <div>
                  <label htmlFor="edit-manager" className={FORM_LABEL}>Manager</label>
                  <FilterSelect
                    id="edit-manager" className={FORM_SELECT}
                    value={managerId} onValueChange={v => setManagerId(v ?? '')}
                    options={[dash, ...managerOptions.map(p => ({ value: p.id, label: p.full_name }))]}
                  />
                </div>
              </div>

              <fieldset className="m-0 border-0 p-0">
                <legend className={cn(FORM_LABEL, 'p-0')}>Skills</legend>
                <div className="flex flex-wrap gap-1.5">
                  {SKILLS.map(s => (
                    <ToggleChip key={s} on={skills.includes(s)} onToggle={() => toggle(skills, setSkills, s)}>{SKILL_LABELS[s]}</ToggleChip>
                  ))}
                </div>
              </fieldset>

              <fieldset className="m-0 border-0 p-0">
                <legend className={cn(FORM_LABEL, 'p-0')}>Client Regions (accounts)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {clients.map(c => (
                    <ToggleChip key={c.id} on={regionIds.includes(c.id)} onToggle={() => toggle(regionIds, setRegionIds, c.id)}>{c.name}</ToggleChip>
                  ))}
                </div>
              </fieldset>

              <fieldset className="m-0 border-0 p-0">
                <legend className={cn(FORM_LABEL, 'p-0')}>T-Lines Regions (CRM visibility)</legend>
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS.map(r => (
                    <ToggleChip key={r.code} on={assignedRegions.includes(r.code)} onToggle={() => toggle(assignedRegions, setAssignedRegions, r.code)}>{r.label}</ToggleChip>
                  ))}
                </div>
                {assignedRegions.length === 0 && (
                  <p className="m-0 mt-1.5 text-[12px] text-ui-text-secondary">
                    No region assigned yet — this person still sees only their own leads/opportunities (fallback).
                  </p>
                )}
              </fieldset>

              {serviceLines.length > 0 && (
                <fieldset className="m-0 border-0 p-0">
                  <legend className={cn(FORM_LABEL, 'p-0')}>Service lines</legend>
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {serviceLines.map(s => {
                      const region = clients.find(c => c.id === s.client_id);
                      return (
                        <ToggleChip key={s.id} on={serviceIds.includes(s.id)} onToggle={() => toggle(serviceIds, setServiceIds, s.id)}>
                          {s.name}{region?.code ? ` · ${region.code}` : ''}
                        </ToggleChip>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </>
          )}

          {isClientPm && (
            <div className="flex flex-col gap-3">
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-[8px] border border-solid px-3 py-2.5',
                  isGeneralPm ? 'border-[var(--color-secondary-500)] bg-ui-selected-bg' : 'border-ui-divider bg-ui-input-bg',
                )}
              >
                <input
                  type="checkbox" checked={isGeneralPm} className="mt-0.5 accent-[var(--color-secondary-700)]"
                  onChange={e => { setIsGeneralPm(e.target.checked); if (e.target.checked) setPmClientId(''); }}
                />
                <span className="text-[13px] text-ui-body">
                  <b className={HEADING}>General PM — Project Management Supervisor</b>
                  <span className="mt-0.5 block text-[12px] text-ui-text-secondary">Oversees all regions; signs the PO supervisor box.</span>
                </span>
              </label>
              {!isGeneralPm && (
                <div>
                  <label htmlFor="edit-pm-region" className={FORM_LABEL}>Region this PM manages</label>
                  <FilterSelect
                    id="edit-pm-region" className={FORM_SELECT}
                    value={pmClientId} onValueChange={v => setPmClientId(v ?? '')}
                    options={[{ value: '', label: 'No region' }, ...clients.map(c => ({ value: c.id, label: `${c.name}${c.code ? ` (${c.code})` : ''}` }))]}
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ui-body">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="m-0 accent-[var(--color-secondary-700)]" />
            Active account
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ui-divider pt-5">
          <button
            type="button" onClick={onClose}
            className="inline-flex h-9 items-center rounded-[6px] border border-ui-divider bg-ui-input-bg px-8 text-[13px] font-medium text-ui-body transition-colors hover:bg-ui-hover-bg"
          >
            Cancel
          </button>
          <button
            type="button" disabled={!fullName.trim() || saving} onClick={handleSave}
            className="inline-flex h-9 items-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-8 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
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

export function TeamPageClient({ profiles: init, clients, franchises: rawFranchises, roleDefinitions, serviceLines, metadataReady, userRole, canEdit }: Props) {
  const router  = useRouter();
  const [profiles, setProfiles]     = useState<ProfileRow[]>(init);
  const [showInvite, setShowInvite] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [query, setQuery]           = useState('');
  const [sortBy, setSortBy]         = useState<SortKey>('newest');
  const [menuId, setMenuId]         = useState<string | null>(null);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const isOps = canEdit ?? (userRole === 'ops_manager');

  const roleMap = useMemo(() => new Map(roleDefinitions.map(r => [r.name, r])), [roleDefinitions]);
  const nameById = new Map(profiles.map(p => [p.id, p.full_name || p.email]));

  const sales     = profiles.filter(p => SALES_ROLES.includes(p.role));
  const internal  = profiles.filter(p => p.role !== 'tlines_pm' && !SALES_ROLES.includes(p.role));
  const clientPMs = profiles.filter(p => p.role === 'tlines_pm');

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const franchises: FranchiseRow[] = rawFranchises.map(f => ({
    ...f,
    client: f.client_id ? (clientMap.get(f.client_id) ?? null) : null,
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q ? profiles : profiles.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q)
      || (p.email ?? '').toLowerCase().includes(q)
      || (roleMap.get(p.role)?.label ?? FALLBACK_LABELS[p.role] ?? p.role).toLowerCase().includes(q));
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      const ta = Date.parse(a.created_at) || 0, tb = Date.parse(b.created_at) || 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
  }, [profiles, query, sortBy, roleMap]);

  const selectedCount = filtered.filter(p => selected.has(p.id)).length;
  const allSelected = filtered.length > 0 && selectedCount === filtered.length;
  const someSelected = selectedCount > 0 && !allSelected;

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
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Admin', href: '/team' }, { label: 'Team Member', href: '/team' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Team Members</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {profiles.length} member{profiles.length !== 1 ? 's' : ''} · {internal.length} internal · {clientPMs.length} client PM{clientPMs.length !== 1 ? 's' : ''} · {sales.length} sales &amp; marketing
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[380px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search members" placeholder="Search members…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <div className="relative">
            <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
            <FilterSelect
              aria-label="Sort"
              className="inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:pl-[34px] dark:pr-3 dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading [&_svg]:size-3.5"
              value={sortBy}
              onValueChange={v => setSortBy((v ?? 'newest') as SortKey)}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'name', label: 'Name A–Z' },
              ]}
            />
          </div>
        </div>
        {isOps && (
          <button
            type="button" onClick={() => setShowInvite(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90"
          >
            <UserRoundPlus size={16} aria-hidden /> Invite Member
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {profiles.length === 0 ? (
          <EmptyState icon={<Users />} title="No members yet." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search />} title="No matching members" description={`Nothing matches “${query}”.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th className="w-[44px] pl-[18px] pr-2.5">
                    <Checkbox
                      aria-label="Select all members" className={CHECKBOX}
                      checked={allSelected} indeterminate={someSelected}
                      onCheckedChange={on => setSelected(on ? new Set(filtered.map(p => p.id)) : new Set())}
                    />
                  </th>
                  <th className={cn(TH, 'w-[186px]')}>
                    <span className="inline-flex items-center gap-0.5">Name<ArrowDown size={12} aria-hidden /></span>
                  </th>
                  <th className={cn(TH, 'w-[326px]')}>Email</th>
                  <th className={cn(TH, 'w-[216px]')}>Role</th>
                  <th className={cn(TH, 'w-[194px]')}>Region</th>
                  <th className={cn(TH, 'w-[142px]')}>Manager</th>
                  <th className={cn(TH, 'w-[195px]')}>Joined Date</th>
                  <th className={cn(TH, 'w-[267px]')}>Status</th>
                  <th className="w-[48px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const name = p.full_name || p.email;
                  return (
                    <tr key={p.id} className="h-16 border-b border-ui-divider last:border-b-0">
                      <td className="pl-[18px] pr-2.5">
                        <Checkbox
                          aria-label={`Select ${name}`} className={CHECKBOX}
                          checked={selected.has(p.id)}
                          onCheckedChange={on => setSelected(prev => {
                            const next = new Set(prev);
                            if (on) next.add(p.id); else next.delete(p.id);
                            return next;
                          })}
                        />
                      </td>
                      <td className="max-w-0 px-2.5">
                        <p className={cn('m-0 truncate text-[13px] font-semibold', HEADING)}>{p.full_name || '—'}</p>
                      </td>
                      <td className="max-w-0 px-2.5"><p className="m-0 truncate text-[13px] text-ui-body">{p.email}</p></td>
                      <td className="px-2"><RoleBadge role={p.role} roleMap={roleMap} /></td>
                      <td className="px-2">
                        {isOps ? (
                          <button
                            type="button" onClick={() => setEditTarget(p)} title="Change region in Edit member"
                            className="inline-flex h-9 max-w-full items-center gap-4 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg pl-4 pr-2.5 text-[13px] font-medium text-[var(--color-secondary-700)] hover:bg-ui-hover-bg dark:text-ui-heading"
                          >
                            <span className="truncate">{regionText(p.assigned_regions)}</span>
                            <ChevronDown size={14} aria-hidden className="shrink-0" />
                          </button>
                        ) : (
                          <span className="text-[13px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading">{regionText(p.assigned_regions)}</span>
                        )}
                      </td>
                      <td className="max-w-0 px-2"><p className="m-0 truncate text-[12px] text-ui-body">{(p.manager_id && nameById.get(p.manager_id)) || '—'}</p></td>
                      <td className="px-2 text-[12px] text-ui-body">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-US') : '—'}</td>
                      <td className="px-2"><StatusChip active={p.is_active} /></td>
                      <td className="relative pr-2 text-center">
                        {isOps && (
                          <>
                            <button
                              type="button" aria-label={`Actions for ${name}`} aria-expanded={menuId === p.id}
                              onClick={() => setMenuId(id => (id === p.id ? null : p.id))}
                              className="inline-grid size-7 place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                            >
                              <Ellipsis size={16} />
                            </button>
                            {menuId === p.id && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                                <div role="menu" className="absolute right-2 top-full z-30 mt-1 w-44 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
                                  <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setMenuId(null); setEditTarget(p); }}>
                                    <Pencil aria-hidden /> Edit member
                                  </button>
                                  <button type="button" role="menuitem" className={cn(MENU_ITEM, 'text-[var(--color-error-normal)]')} onClick={() => { setMenuId(null); setDeleteTarget(p); }}>
                                    <Trash2 aria-hidden /> Delete member
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  );
}
