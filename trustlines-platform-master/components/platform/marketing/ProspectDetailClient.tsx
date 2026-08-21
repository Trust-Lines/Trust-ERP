'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Users, MapPin, Star, Trash2, Archive, ArchiveRestore, Target, Clock, ArrowRightCircle, Pencil, Activity, FileText, Image as ImageIcon, Link2, Video, Loader2, X, Paperclip, Globe, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';
import { SourceSelect } from './SourceSelect';
import { TagMultiSelect } from './TagMultiSelect';
import { hashColor } from '@/lib/marketing/pillColor';
import { TaskList } from '@/components/platform/shared/TaskList';
import { ActivityFeed } from '@/components/platform/shared/ActivityFeed';
import {
  SOURCE_LABEL, PROJECT_TYPE_LABEL, SCOPE_TYPE_LABEL, TIMING_LABEL, TIMINGS,
  PROJECT_TYPES, OPPORTUNITY_STAGE_LABEL,
} from '@/lib/marketing/classification';
import { REGIONS, SERVICE_LINES } from '@/lib/regions';
import { computeProspectCompleteness } from '@/lib/marketing/prospectCompleteness';
import type { LeadEntityType, ProjectType, ScopeType, LeadTiming, NeedClassification, OpportunityStage, PotentialStatus } from '@/types/database';

interface Prospect {
  id: string; entity_type: LeadEntityType; display_name: string;
  organization_name: string | null; person_name: string | null;
  brand_name: string | null; industry: string | null;
  website: string | null; main_email: string | null; main_phone: string | null;
  company_size: string | null; location_count: number | null; status: string;
  owner_id: string | null; assigned_marketing_user_id: string | null; customer_id: string | null;
  source_label: string | null;
  business_types?: string[]; region?: string | null;
  tags?: { name: string; color: string }[];
  source_detail?: string | null; source_raw_label?: string | null; x_note?: string | null;
  external_created_at?: string | null;
  is_archived: boolean; created_at: string; updated_at: string;
}
interface Contact {
  id: string; prospect_id: string; name: string; title: string | null; role_type: string | null;
  email: string | null; phone: string | null; linkedin_url: string | null; preferred_contact_method: string | null;
  is_decision_maker: boolean; is_primary: boolean; contact_consent: boolean; notes: string | null; created_at: string;
  other_contact?: string | null;
  whatsapp?: boolean; company2_phone?: string | null;
}
interface ProspectLocation {
  id: string; prospect_id: string; location_name: string | null; address_line_1: string | null;
  address_line_2: string | null; city: string | null; state: string | null; postal_code: string | null;
  country: string | null; location_type: string | null; is_active: boolean; store_status: string | null;
  estimated_remodel_date: string | null; notes: string | null; created_at: string;
  mailing_address?: string | null;
}
interface Need {
  id: string; prospect_id: string; location_id: string | null; title: string; description: string | null;
  has_active_project: boolean | null; project_types: ProjectType[]; scope_types: ScopeType[];
  deadline: string | null; expected_start_date: string | null; layout_available: boolean | null; site_ready: boolean | null;
  budget_min: number | null; budget_max: number | null; currency: string | null;
  timing: LeadTiming | null; target_contact_date: string | null; source: string | null; status: string;
  classification: NeedClassification;
  classification_reasons: string[]; created_at: string; updated_at: string;
  region?: string | null; service_line?: string | null; state?: string | null; project_id?: string | null;
}
interface Potential {
  id: string; need_id: string; prospect_id: string; title: string; status: PotentialStatus;
  target_contact_date: string | null; converted_opportunity_id: string | null; auto_managed: boolean;
  classification_reasons: string[]; created_at: string;
}
interface OpportunityRow {
  id: string; need_id: string; prospect_id: string; title: string; stage: OpportunityStage;
  deadline: string | null; auto_managed: boolean; admin_corrected: boolean;
  classification_reasons: string[]; created_at: string;
}

interface ContactNote {
  id: string; prospect_contact_id: string; author_name: string | null; body: string;
  source_created_at: string | null; created_at: string;
}
interface ProspectFile {
  id: string; prospect_id: string; dropbox_path: string; file_name: string;
  uploaded_by: string | null; uploaded_by_name?: string | null; created_at: string;
}

interface Props {
  initialProspect: Prospect;
  initialContacts: Contact[];
  initialLocations: ProspectLocation[];
  initialNeeds: Need[];
  initialPotentials: Potential[];
  initialOpportunities: OpportunityRow[];
  initialContactNotes?: ContactNote[];
  initialFiles?: ProspectFile[];
  showsAttended?: string[];
  assignees?: { id: string; full_name: string }[];
  canEdit?: boolean;
  onClose?: () => void;
}

const NEED_CLASSIFICATION_VARIANT: Record<NeedClassification, 'neutral' | 'warning' | 'info' | 'danger'> = {
  unclassified: 'neutral', potential: 'warning', opportunity: 'info', disqualified: 'danger',
};
const NEED_CLASSIFICATION_LABEL: Record<NeedClassification, string> = {
  unclassified: 'Unclassified', potential: 'Potential', opportunity: 'Opportunity', disqualified: 'Disqualified',
};
function NeedClassificationPill({ c }: { c: NeedClassification }) {
  return <Pill variant={NEED_CLASSIFICATION_VARIANT[c]}>{NEED_CLASSIFICATION_LABEL[c]}</Pill>;
}

const STATUSES = [
  'captured', 'enrichment', 'potential', 'nurture', 'opportunity_candidate',
  'qualified_for_sales', 'converted', 'disqualified', 'archived',
];
const STATUS_LABEL: Record<string, string> = {
  captured: 'Captured', enrichment: 'Enrichment', potential: 'Potential', nurture: 'Nurture',
  opportunity_candidate: 'Opportunity candidate', qualified_for_sales: 'Qualified for Sales',
  converted: 'Converted', disqualified: 'Disqualified', archived: 'Archived',
};

type Tab = 'overview' | 'contacts' | 'locations' | 'needs' | 'potentials' | 'opportunities' | 'activities' | 'files';

export function ProspectDetailClient({
  initialProspect, initialContacts, initialLocations, initialNeeds, initialPotentials, initialOpportunities,
  initialFiles = [], showsAttended = [], assignees = [], canEdit, onClose,
}: Props) {
  const router = useRouter();
  const [prospect, setProspect] = useState<Prospect>(initialProspect);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [locations, setLocations] = useState<ProspectLocation[]>(initialLocations);
  const [needs, setNeeds] = useState<Need[]>(initialNeeds);
  const [potentials, setPotentials] = useState<Potential[]>(initialPotentials);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>(initialOpportunities);
  const [files, setFiles] = useState<ProspectFile[]>(initialFiles);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const VALID_TABS: Tab[] = ['overview', 'contacts', 'locations', 'needs', 'potentials', 'opportunities', 'activities', 'files'];
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return (VALID_TABS as string[]).includes(t ?? '') ? (t as Tab) : 'overview';
  });
  const [addingContact, setAddingContact] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [addingNeed, setAddingNeed] = useState(false);
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const DONE_POTENTIAL_STATUSES = new Set(['converted', 'lost', 'cancelled']);
  const activePotentials = potentials.filter(p => !DONE_POTENTIAL_STATUSES.has(p.status));
  const donePotentials = potentials.filter(p => DONE_POTENTIAL_STATUSES.has(p.status));

  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0] ?? null;
  const primaryLocation = locations.find(l => l.is_active) ?? locations[0] ?? null;
  const completeness = computeProspectCompleteness({
    organizationName: prospect.organization_name, personName: prospect.person_name,
    mainEmail: prospect.main_email, mainPhone: prospect.main_phone, website: prospect.website,
    sourceLabel: prospect.source_label, sourceRawLabel: prospect.source_raw_label, sourceDetail: prospect.source_detail,
    businessTypes: prospect.business_types ?? [], showsAttended,
    primaryContact: primaryContact ? {
      title: primaryContact.title, linkedinUrl: primaryContact.linkedin_url, otherContact: primaryContact.other_contact ?? null,
      company2Phone: primaryContact.company2_phone ?? null, whatsapp: primaryContact.whatsapp ?? false,
    } : null,
    location: primaryLocation ? { state: primaryLocation.state, address: primaryLocation.address_line_1, mailingAddress: primaryLocation.mailing_address ?? null } : null,
    xNote: prospect.x_note,
  });

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error ?? 'Failed to update'); return; }
    setProspect(json.prospect);
  }

  async function trashProspect() {
    if (!window.confirm(`Delete "${prospect.display_name}"? It stays in the database (recoverable), but disappears everywhere in the UI — Lead Cloud, its Needs/Potentials/Opportunities, all of it.`)) return;
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/trash`, { method: 'POST' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    toast.success('Deleted');
    router.push('/marketing/prospects');
  }

  async function trashNeed(needId: string, title: string) {
    if (!window.confirm(`Delete Need "${title}"? Stays in the database, but disappears everywhere in the UI (including its own Opportunity/Potential, if any).`)) return;
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/needs/${needId}/trash`, { method: 'POST' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setNeeds(prev => prev.filter(n => n.id !== needId));
    setOpportunities(prev => prev.filter(o => o.need_id !== needId));
    setPotentials(prev => prev.filter(p => p.need_id !== needId));
    toast.success('Need deleted');
  }

  async function saveNeed(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/needs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save need'); return false; }
    setNeeds(prev => [body.need, ...prev]);
    if (body.opportunity) setOpportunities(prev => [body.opportunity, ...prev]);
    if (body.potential) setPotentials(prev => [body.potential, ...prev]);
    setAddingNeed(false);
    toast.success(`Need classified as ${NEED_CLASSIFICATION_LABEL[body.need.classification as NeedClassification]}`);
    return true;
  }

  async function updateNeed(needId: string, payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/needs/${needId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to update need'); return false; }
    setNeeds(prev => prev.map(n => (n.id === needId ? body.need : n)));
    if (body.opportunity) {
      setOpportunities(prev => (prev.some(o => o.id === body.opportunity.id) ? prev.map(o => (o.id === body.opportunity.id ? body.opportunity : o)) : [body.opportunity, ...prev]));
    }
    if (body.potential) {
      setPotentials(prev => (prev.some(p => p.id === body.potential.id) ? prev.map(p => (p.id === body.potential.id ? body.potential : p)) : [body.potential, ...prev]));
    }
    setEditingNeedId(null);
    toast.success(`Need re-classified as ${NEED_CLASSIFICATION_LABEL[body.need.classification as NeedClassification]}`);
    return true;
  }

  async function saveContact(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save contact'); return false; }
    setContacts(prev => {
      const next = body.contact.is_primary ? prev.map(c => ({ ...c, is_primary: false })) : prev;
      return [...next, body.contact];
    });
    setAddingContact(false);
    toast.success('Contact added');
    return true;
  }

  async function updateContact(id: string, payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/contacts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to update contact'); return false; }
    setContacts(prev => {
      const next = body.contact.is_primary ? prev.map(c => ({ ...c, is_primary: false })) : prev;
      return next.map(c => (c.id === id ? body.contact : c));
    });
    setEditingContactId(null);
    toast.success('Contact updated');
    return true;
  }

  async function deleteContact(id: string) {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to delete'); return; }
    setContacts(prev => prev.filter(c => c.id !== id));
  }

  async function saveLocation(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/locations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save location'); return false; }
    setLocations(prev => [...prev, body.location]);
    setAddingLocation(false);
    toast.success('Location added');
    return true;
  }

  async function updateLocation(id: string, payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/locations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to update location'); return false; }
    setLocations(prev => prev.map(l => (l.id === id ? body.location : l)));
    setEditingLocationId(null);
    toast.success('Location updated');
    return true;
  }

  async function uploadFile(file: File) {
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch(`/api/marketing/prospects/${prospect.id}/files`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Upload failed'); return; }
      setFiles(prev => [body.file, ...prev]);
      toast.success('File attached');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function viewFile(dropboxPath: string) {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/dropbox-link?path=${encodeURIComponent(dropboxPath)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.link) { toast.error(body.error ?? 'Could not open file'); return; }
    window.open(body.link, '_blank', 'noopener,noreferrer');
  }

  async function deleteFile(fileId: string) {
    if (!window.confirm('Permanently delete this file reference? This cannot be undone.')) return;
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/files/${fileId}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }

  async function deleteLocation(id: string) {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/locations/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to delete'); return; }
    setLocations(prev => prev.filter(l => l.id !== id));
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {onClose ? (
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <Link href="/marketing/prospects" className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Lead Cloud
          </Link>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>{prospect.display_name}</h1>
              <span className="pill" style={{ background: prospect.entity_type === 'person' ? 'var(--brand-orange-100)' : 'var(--brand-teal-100)', color: prospect.entity_type === 'person' ? 'var(--brand-orange-600)' : 'var(--brand-teal-600)', fontSize: 10.5 }}>
                {prospect.entity_type === 'person' ? 'Person' : 'Organization'}
              </span>
            </div>
            {prospect.brand_name && <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{prospect.brand_name}</p>}
            {prospect.entity_type === 'person' && prospect.organization_name && (
              <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{prospect.organization_name}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canEdit ? (
              <select className="form-input" style={{ fontSize: 12, width: 200 }} value={prospect.status}
                onChange={e => patch({ status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            ) : (
              <span className="pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>{STATUS_LABEL[prospect.status]}</span>
            )}
            {canEdit && (
              <button className="btn btn-secondary btn-sm" onClick={() => patch({ is_archived: !prospect.is_archived })}>
                {prospect.is_archived ? <><ArchiveRestore size={13} /> Unarchive</> : <><Archive size={13} /> Archive</>}
              </button>
            )}
            {canEdit && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={trashProspect}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, maxWidth: 360 }} title={completeness.checks.filter(c => !c.done).map(c => c.label).join(', ') || 'All fields filled'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 3 }}>
            <span>Profile completeness</span>
            <span>{completeness.filledCount}/{completeness.totalCount} · {completeness.percent}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${completeness.percent}%`, borderRadius: 3,
              background: completeness.percent >= 80 ? 'var(--status-success)' : completeness.percent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)',
              transition: 'width 0.2s',
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 18 }}>
        {([
          { key: 'overview', label: 'Overview', icon: Building2 },
          { key: 'contacts', label: `Contacts (${contacts.length})`, icon: Users },
          { key: 'locations', label: `Locations (${locations.length})`, icon: MapPin },
          { key: 'needs', label: `Needs (${needs.length})`, icon: Target },
          { key: 'potentials', label: `Potentials (${activePotentials.length})`, icon: Clock },
          { key: 'opportunities', label: `Opportunities (${opportunities.length})`, icon: ArrowRightCircle },
          { key: 'activities', label: 'Activities', icon: Activity },
          { key: 'files', label: 'Files', icon: FileText },
        ] as { key: Tab; label: string; icon: typeof Building2 }[]).map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn btn-ghost btn-sm"
              style={{
                borderRadius: 0, borderBottom: active ? '2px solid var(--brand-navy)' : '2px solid transparent',
                color: active ? 'var(--fg-default)' : 'var(--fg-subtle)', fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Profile</div>
              {canEdit && !editingProfile && (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingProfile(true)}><Pencil size={12} /> Edit</button>
              )}
            </div>
            <div className="card-body">
              {editingProfile ? (
                <ProfileForm
                  prospect={prospect}
                  primaryContact={primaryContact}
                  onSave={payload => patch(payload).then(() => setEditingProfile(false))}
                  onSaveContact={payload => (primaryContact ? updateContact(primaryContact.id, payload) : Promise.resolve(false))}
                  onCancel={() => setEditingProfile(false)}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <Field label="01 - State" value={primaryLocation?.state ?? null} />
                  <Field label="02 - Phone" value={prospect.main_phone} />
                  <Field label="03 - Email" value={prospect.main_email} />
                  <Field label="04 - Role/Position" value={primaryContact?.title ?? null} />
                  <Field label="05 - LinkedIn" value={primaryContact?.linkedin_url ?? null} />
                  <Field label="06 - Company" value={prospect.organization_name || prospect.person_name} />
                  <Field label="07 - Other contact" value={primaryContact?.other_contact ?? null} />
                  <Field label="08 - Business type" value={(prospect.business_types ?? []).join(', ') || null} />
                  <Field label="09 - Website" value={prospect.website} />
                  <Field label="10 - Shows attended" value={showsAttended.join(', ') || null} />
                  <Field label="11 - Location" value={primaryLocation?.address_line_1 || null} />
                  <Field label="12 - Mailing address" value={primaryLocation?.mailing_address || null} />
                  <Field label="13 - Source" value={prospect.source_raw_label || (prospect.source_label ? (SOURCE_LABEL[prospect.source_label as keyof typeof SOURCE_LABEL] ?? prospect.source_label) : null)} />
                  <Field label="14 - Source info" value={prospect.source_detail ?? null} />
                  <Field label="Company 2 Phone Number" value={primaryContact?.company2_phone ?? null} />
                  <Field label="WhatsApp" value={primaryContact?.whatsapp ? 'Yes' : 'No'} />
                  <Field label="x-Note" value={prospect.x_note ?? null} />
                </div>
              )}
            </div>
            {!editingProfile && (
              <div style={{ display: 'flex', gap: 16, padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--fg-faint)' }}>
                <span>Created {new Date(prospect.external_created_at ?? prospect.created_at).toLocaleDateString('en-US')}</span>
                <span>Last updated {new Date(prospect.updated_at).toLocaleDateString('en-US')}</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Project needs</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('needs')}>View all →</button>
            </div>
            <div className="card-body" style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>
              {needs.length === 0 ? (
                <span>No project needs captured yet. A Lead may have zero, one, or many — each classified independently.</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {needs.map(n => (
                    <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--fg-default)' }}>{n.title}</span> <NeedClassificationPill c={n.classification} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setAddingContact(s => !s)}>+ Add contact</button>
            </div>
          )}
          {addingContact && canEdit && (
            <div style={{ marginBottom: 12 }}>
              <ContactForm onSave={saveContact} onCancel={() => setAddingContact(false)} />
            </div>
          )}
          {contacts.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              No contacts yet.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {contacts.map(c => {
                if (editingContactId === c.id) {
                  return <ContactForm key={c.id} initial={c} onSave={payload => updateContact(c.id, payload)} onCancel={() => setEditingContactId(null)} />;
                }
                return (
                <div key={c.id} className="card"><div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.name}
                        {c.is_primary && <Star size={12} style={{ color: 'var(--status-warning-fg, #92400e)' }} />}
                        {c.is_decision_maker && <span className="pill" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info)', fontSize: 10 }}>Decision maker</span>}
                        {c.whatsapp && <span className="pill" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success)', fontSize: 10 }}>WhatsApp</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{[c.title, c.role_type].filter(Boolean).join(' · ') || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</div>
                      {c.preferred_contact_method && <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>Prefers: {c.preferred_contact_method}</div>}
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingContactId(c.id)}><Pencil size={12} /> Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteContact(c.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div></div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'locations' && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setAddingLocation(s => !s)}>+ Add location</button>
            </div>
          )}
          {addingLocation && canEdit && (
            <div style={{ marginBottom: 12 }}>
              <LocationForm onSave={saveLocation} onCancel={() => setAddingLocation(false)} />
            </div>
          )}
          {locations.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              No locations yet.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {locations.map(l => {
                if (editingLocationId === l.id) {
                  return <LocationForm key={l.id} initial={l} onSave={payload => updateLocation(l.id, payload)} onCancel={() => setEditingLocationId(null)} />;
                }
                return (
                <div key={l.id} className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{l.location_name || [l.city, l.state].filter(Boolean).join(', ') || 'Location'}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                      {[l.address_line_1, l.city, l.state, l.postal_code, l.country].filter(Boolean).join(', ') || '—'}
                    </div>
                    {l.store_status && <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Status: {l.store_status}</div>}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingLocationId(l.id)}><Pencil size={12} /> Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteLocation(l.id)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div></div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'needs' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
            Each project need is classified automatically and independently. A Lead may have zero, one, or many —
            "another project" for this Lead is a new Need here, never edited into an existing Opportunity.
          </p>
          {canEdit && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setAddingNeed(s => !s)}>+ Add project need</button>
            </div>
          )}
          {addingNeed && canEdit && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-body"><NeedForm locations={locations} onSave={saveNeed} onCancel={() => setAddingNeed(false)} /></div>
            </div>
          )}
          {needs.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              No project needs yet.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {needs.map(n => {
                const linkedOpportunity = opportunities.find(o => o.need_id === n.id);
                const linkedPotential = potentials.find(p => p.need_id === n.id && !DONE_POTENTIAL_STATUSES.has(p.status));
                if (editingNeedId === n.id) {
                  return (
                    <div key={n.id} className="card"><div className="card-body">
                      <NeedForm initial={n} locations={locations} onSave={payload => updateNeed(n.id, payload)} onCancel={() => setEditingNeedId(null)} />
                    </div></div>
                  );
                }
                return (
                  <div key={n.id} className="card"><div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                      <NeedClassificationPill c={n.classification} />
                      {canEdit && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingNeedId(n.id)}>
                            <Pencil size={12} /> Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => trashNeed(n.id, n.title)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    {n.description && <div style={{ fontSize: 12.5, color: 'var(--fg-subtle)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{n.description}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {n.project_types.map(t => <span key={t} className="pill" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{PROJECT_TYPE_LABEL[t]}</span>)}
                      {n.scope_types.map(t => <span key={t} className="pill" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{SCOPE_TYPE_LABEL[t]}</span>)}
                    </div>
                    {n.classification_reasons.length > 0 && (
                      <ul style={{ margin: '4px 0 8px', paddingLeft: 18, fontSize: 12 }}>
                        {n.classification_reasons.map(r => <li key={r}>{r}</li>)}
                      </ul>
                    )}
                    <NeedDocumentsSection need={n} canEdit={!!canEdit} prospectId={prospect.id}
                      onNeedChange={updated => setNeeds(prev => prev.map(x => (x.id === updated.id ? { ...x, ...updated } : x)))}
                      onSync={(opp, pot) => {
                        if (opp) {
                          const row = opp as unknown as OpportunityRow;
                          setOpportunities(prev => (prev.some(o => o.id === row.id) ? prev.map(o => (o.id === row.id ? row : o)) : [row, ...prev]));
                        }
                        if (pot) {
                          const row = pot as unknown as Potential;
                          setPotentials(prev => (prev.some(p => p.id === row.id) ? prev.map(p => (p.id === row.id ? row : p)) : [row, ...prev]));
                        }
                      }}
                    />
                    {(linkedOpportunity || linkedPotential) && (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {linkedOpportunity && (
                          <button className="pill" style={{ border: 'none', cursor: 'pointer', background: 'var(--status-info-bg)', color: 'var(--status-info)' }} onClick={() => setTab('opportunities')}>
                            → Opportunity: {OPPORTUNITY_STAGE_LABEL[linkedOpportunity.stage]}
                          </button>
                        )}
                        {linkedPotential && (
                          <button className="pill" style={{ border: 'none', cursor: 'pointer', background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-fg, #92400e)' }} onClick={() => setTab('potentials')}>
                            → Potential: {linkedPotential.status}
                          </button>
                        )}
                      </div>
                    )}
                  </div></div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'potentials' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
            System-created for a Need with future timing — never chosen manually.
          </p>
          {activePotentials.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              No active Potentials{donePotentials.length > 0 ? ' — all attached evidence and became Opportunities' : ' yet'}.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {activePotentials.map(p => (
                <div key={p.id} className="card"><div className="card-body">
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                    Status: {p.status}{p.target_contact_date && ` · Contact by ${p.target_contact_date}`}
                  </div>
                </div></div>
              ))}
            </div>
          )}
          {donePotentials.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 11.5, color: 'var(--fg-faint)', cursor: 'pointer' }}>
                {donePotentials.length} converted/closed Potential{donePotentials.length === 1 ? '' : 's'}
              </summary>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {donePotentials.map(p => (
                  <div key={p.id} className="card" style={{ opacity: 0.7 }}><div className="card-body">
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                      Status: {p.status}{p.converted_opportunity_id && ' · Converted to Opportunity'}
                    </div>
                  </div></div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'opportunities' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
            System-created for a Need with an active, ticketed signal — never chosen manually. This Lead can have
            more than one, if it has more than one distinct project need.
          </p>
          {opportunities.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              No Opportunities yet.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {opportunities.map(o => {
                const expanded = expandedOppId === o.id;
                return (
                  <div key={o.id} className="card">
                    <div
                      className="card-body"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedOppId(expanded ? null : o.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{o.title}</div>
                        <span className="pill" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{OPPORTUNITY_STAGE_LABEL[o.stage]}</span>
                        <Link href="/marketing/opportunities" onClick={e => e.stopPropagation()}
                          style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--brand-teal)', textDecoration: 'none' }}>
                          Open in Opportunities →
                        </Link>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{o.deadline ? `Deadline: ${o.deadline}` : 'No deadline set'}</div>
                    </div>
                    {expanded && (
                      <div className="card-body" style={{ borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 12 }}>
                        <TaskList apiBasePath={`/api/marketing/opportunities/${o.id}`} assignees={assignees} />
                        <ActivityFeed apiBasePath={`/api/marketing/opportunities/${o.id}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'activities' && (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
          <Activity size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>Activity timeline (calls, emails, meetings, status changes) is not built yet — pending a future task.</div>
        </div></div>
      )}

      {tab === 'files' && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: 12 }}>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
              <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                {uploadingFile ? 'Uploading…' : <><Paperclip size={13} /> Attach file</>}
              </button>
            </div>
          )}
          {files.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
              <FileText size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>No files yet.</div>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {files.map(f => (
                <div key={f.id} className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={16} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                      {f.uploaded_by_name ?? 'Unknown'} · {new Date(f.created_at).toLocaleDateString('en-US')}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => viewFile(f.dropbox_path)}>View</button>
                  {canEdit && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => deleteFile(f.id)} title="Delete (temporary, dev-only)">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div></div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface NeedDocument {
  id: string; category: 'layout' | 'photo' | 'matterport' | 'link';
  dropbox_path: string | null; file_name: string | null; url: string | null; created_at: string;
}

const DOC_ICON: Record<NeedDocument['category'], React.ComponentType<{ size?: number }>> = {
  layout: FileText, photo: ImageIcon, matterport: Video, link: Link2,
};

function NeedDocumentsSection({ need, canEdit, prospectId, onNeedChange, onSync }: {
  need: Need; canEdit: boolean; prospectId: string;
  onNeedChange: (n: Partial<Need> & { id: string }) => void;
  onSync: (opportunity: Record<string, unknown> | null, potential: Record<string, unknown> | null) => void;
}) {
  const [docs, setDocs] = useState<NeedDocument[]>([]);
  const [projectCode, setProjectCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [region, setRegion] = useState(need.region ?? '');
  const [serviceLine, setServiceLine] = useState(need.service_line ?? '');
  const [state, setState] = useState(need.state ?? '');
  const [savingSetup, setSavingSetup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkCategory, setLinkCategory] = useState<'matterport' | 'link'>('matterport');
  const [linkUrl, setLinkUrl] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`);
      const body = await res.json();
      setDocs(body.documents ?? []);
      setProjectCode(body.projectCode ?? null);
    } catch { }
    finally { setLoaded(true); }
  }, [prospectId, need.id]);

  useEffect(() => { load(); }, [load]);

  const setupReady = !!(need.region && need.service_line && need.state);
  const draftReady = !!(region && serviceLine && state.trim());

  async function saveSetup() {
    setSavingSetup(true);
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, service_line: serviceLine, state: state.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingSetup(false);
    if (!res.ok) { toast.error(body.error ?? 'Could not save'); return; }
    onNeedChange(body.need);
  }

  async function afterAdd(res: Response) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Could not add'); return; }
    setDocs(prev => [...prev, body.document]);
    if (body.project) {
      setProjectCode(body.project.code);
      onNeedChange({ id: need.id, project_id: body.project.id });
      toast.success(`Evidence attached — became an Opportunity, project ${body.project.code} created`);
    } else {
      toast.success('Evidence attached');
    }
    onSync(body.opportunity ?? null, body.potential ?? null);
  }

  async function uploadFile(category: 'layout' | 'photo', file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('category', category);
    form.append('file', file);
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`, { method: 'POST', body: form });
    await afterAdd(res);
    setUploading(false);
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    setUploading(true);
    const form = new FormData();
    form.append('category', linkCategory);
    form.append('url', linkUrl.trim());
    const res = await fetch(`/api/marketing/prospects/${prospectId}/needs/${need.id}/documents`, { method: 'POST', body: form });
    setLinkUrl('');
    await afterAdd(res);
    setUploading(false);
  }

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Evidence</div>
        {projectCode && <span className="pill" style={{ fontSize: 9.5, background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>{projectCode}</span>}
      </div>

      {docs.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', marginBottom: 6 }}>
          No layout, photo, or reference link yet — stays a Potential until one is added.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          {docs.map(d => {
            const Icon = DOC_ICON[d.category];
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Icon size={13} />
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-navy)' }}>{d.url}</a>
                ) : (
                  <span>{d.file_name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && !setupReady && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>Region</div>
            <select className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">—</option>
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>Service line</div>
            <select className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
              <option value="">—</option>
              {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginBottom: 2 }}>State</div>
            <input className="form-input" style={{ fontSize: 12, padding: '4px 6px' }} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. NY" />
          </div>
          <button className="btn btn-secondary btn-sm" disabled={savingSetup || !draftReady} onClick={saveSetup}>
            {savingSetup ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
          </button>
          <div style={{ gridColumn: '1 / -1', fontSize: 10.5, color: 'var(--fg-faint)' }}>
            Set these once so a project folder can be created the moment a document/link is attached.
          </div>
        </div>
      )}

      {canEdit && setupReady && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            <FileText size={12} /> Layout
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('layout', f); e.target.value = ''; }} />
          </label>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            <ImageIcon size={12} /> Photo
            <input type="file" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('photo', f); e.target.value = ''; }} />
          </label>
          <select className="form-input" style={{ fontSize: 12, padding: '3px 6px', width: 110 }} value={linkCategory} onChange={e => setLinkCategory(e.target.value as 'matterport' | 'link')}>
            <option value="matterport">Matterport</option>
            <option value="link">Link</option>
          </select>
          <input className="form-input" style={{ fontSize: 12, padding: '3px 6px', flex: 1, minWidth: 160 }}
            placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
          <button className="btn btn-secondary btn-sm" disabled={uploading || !linkUrl.trim()} onClick={addLink}>
            {uploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '+ Add'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

function NeedForm({ initial, locations, onSave, onCancel }: { initial?: Need; locations: ProspectLocation[]; onSave: (n: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [locationId, setLocationId] = useState(initial?.location_id ?? '');
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>(initial?.project_types ?? []);
  const [hasActiveProject, setHasActiveProject] = useState<boolean | null>(initial?.has_active_project ?? null);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [expectedStartDate, setExpectedStartDate] = useState(initial?.expected_start_date ?? '');
  const [layoutAvailable, setLayoutAvailable] = useState<boolean | null>(initial?.layout_available ?? null);
  const [budgetMin, setBudgetMin] = useState(initial?.budget_min?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(initial?.budget_max?.toString() ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? '');
  const [timing, setTiming] = useState<LeadTiming | ''>(initial?.timing ?? '');
  const [targetContactDate, setTargetContactDate] = useState(initial?.target_contact_date ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [serviceLine, setServiceLine] = useState(initial?.service_line ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [saving, setSaving] = useState(false);

  function togglePill<T>(list: T[], v: T, setList: (l: T[]) => void) {
    setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  async function submit() {
    if (!title.trim()) return;
    if (timing === 'contact_later' && !targetContactDate) return;
    setSaving(true);
    await onSave({
      title: title.trim(), description: description.trim() || undefined,
      location_id: locationId || undefined,
      project_types: projectTypes, has_active_project: hasActiveProject ?? undefined,
      deadline: deadline || undefined, expected_start_date: expectedStartDate || undefined,
      layout_available: layoutAvailable ?? undefined,
      budget_min: budgetMin ? Number(budgetMin) : undefined,
      budget_max: budgetMax ? Number(budgetMax) : undefined,
      currency: currency.trim() || undefined,
      timing: timing || undefined, target_contact_date: targetContactDate || undefined,
      region: region || undefined, service_line: serviceLine || undefined, state: state.trim() || undefined,
    });
    setSaving(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label className="form-label required" style={{ fontSize: 12 }}>Title</label>
        <input className="form-input" placeholder="e.g. Manhattan Full Remodel" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Project type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROJECT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => togglePill(projectTypes, t, setProjectTypes)}
              className="pill" style={{ cursor: 'pointer', border: 'none', background: projectTypes.includes(t) ? 'var(--brand-navy)' : 'var(--bg-subtle)', color: projectTypes.includes(t) ? 'white' : 'var(--fg-subtle)', fontSize: 11 }}>
              {PROJECT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {locations.length > 0 && (
        <div style={{ marginBottom: 10, maxWidth: 320 }}>
          <label className="form-label" style={{ fontSize: 12 }}>Location</label>
          <select className="form-input" value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">— Not location-specific —</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.location_name || [l.city, l.state].filter(Boolean).join(', ') || 'Location'}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Region</label>
          <select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">—</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Service line</label>
          <select className="form-input" value={serviceLine} onChange={e => setServiceLine(e.target.value)}>
            <option value="">—</option>
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>State</label>
          <input className="form-input" placeholder="e.g. NY" value={state} onChange={e => setState(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Deadline</label>
          <input className="form-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Expected start date</label>
          <input className="form-input" type="date" value={expectedStartDate} onChange={e => setExpectedStartDate(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Budget min</label>
          <input className="form-input" type="number" min={0} value={budgetMin} onChange={e => setBudgetMin(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Budget max</label>
          <input className="form-input" type="number" min={0} value={budgetMax} onChange={e => setBudgetMax(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Currency</label>
          <input className="form-input" placeholder="USD" value={currency} onChange={e => setCurrency(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={hasActiveProject === true} onChange={e => setHasActiveProject(e.target.checked ? true : null)} /> Has an active project
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={layoutAvailable === true} onChange={e => setLayoutAvailable(e.target.checked ? true : null)} /> Layout/drawings available
        </label>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Timing</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TIMINGS.map(t => (
            <button key={t} type="button" onClick={() => setTiming(t)}
              className="pill" style={{ cursor: 'pointer', border: 'none', background: timing === t ? 'var(--brand-navy)' : 'var(--bg-subtle)', color: timing === t ? 'white' : 'var(--fg-subtle)', fontSize: 11 }}>
              {TIMING_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {timing === 'contact_later' && (
        <div style={{ marginBottom: 10, maxWidth: 220 }}>
          <label className="form-label required" style={{ fontSize: 12 }}>Target contact date</label>
          <input className="form-input" type="date" value={targetContactDate} onChange={e => setTargetContactDate(e.target.value)} />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Description</label>
        <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!title.trim() || saving || (timing === 'contact_later' && !targetContactDate)}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save need'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function FormShell({ title, onCancel, children, footer }: { title: string; onCancel: () => void; children: React.ReactNode; footer: React.ReactNode }) {
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

function FieldSection({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
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

function ContactForm({ initial, onSave, onCancel }: { initial?: Contact; onSave: (c: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedin_url ?? '');
  const [otherContact, setOtherContact] = useState(initial?.other_contact ?? '');
  const [company2Phone, setCompany2Phone] = useState(initial?.company2_phone ?? '');
  const [preferredContactMethod, setPreferredContactMethod] = useState(initial?.preferred_contact_method ?? '');
  const [isDecisionMaker, setIsDecisionMaker] = useState(initial?.is_decision_maker ?? false);
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(), title: title.trim(), email: email.trim(), phone: phone.trim(),
      linkedin_url: linkedinUrl.trim(), other_contact: otherContact.trim(), company2_phone: company2Phone.trim(),
      preferred_contact_method: preferredContactMethod, is_decision_maker: isDecisionMaker, is_primary: isPrimary,
      whatsapp,
    });
    setSaving(false);
  }

  return (
    <FormShell
      title={initial ? `Edit ${initial.name}` : 'New contact'}
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!name.trim() || saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save contact'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Title / Role</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label>
          <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>LinkedIn</label>
          <input className="form-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Other contact</label>
          <input className="form-input" value={otherContact} onChange={e => setOtherContact(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Company 2 phone</label>
          <input className="form-input" value={company2Phone} onChange={e => setCompany2Phone(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Preferred contact method</label>
          <select className="form-input" value={preferredContactMethod} onChange={e => setPreferredContactMethod(e.target.value)}>
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0 14px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={isDecisionMaker} onChange={e => setIsDecisionMaker(e.target.checked)} /> Decision maker
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} /> Primary contact
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} /> WhatsApp available
        </label>
      </div>
    </FormShell>
  );
}

function LocationForm({ initial, onSave, onCancel }: { initial?: ProspectLocation; onSave: (l: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [locationName, setLocationName] = useState(initial?.location_name ?? '');
  const [addressLine1, setAddressLine1] = useState(initial?.address_line_1 ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [storeStatus, setStoreStatus] = useState(initial?.store_status ?? '');
  const [mailingAddress, setMailingAddress] = useState(initial?.mailing_address ?? '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      location_name: locationName.trim(), address_line_1: addressLine1.trim(), city: city.trim(), state: state.trim(),
      store_status: storeStatus.trim(), mailing_address: mailingAddress.trim() || null,
    });
    setSaving(false);
  }

  return (
    <FormShell
      title={initial ? `Edit ${initial.location_name || 'location'}` : 'New location'}
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save location'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Location name</label>
          <input className="form-input" placeholder="e.g. Flagship store" value={locationName} onChange={e => setLocationName(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Store status</label>
          <input className="form-input" placeholder="open, planned…" value={storeStatus} onChange={e => setStoreStatus(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Address</label>
          <input className="form-input" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>City</label>
          <input className="form-input" value={city} onChange={e => setCity(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>State</label>
          <input className="form-input" value={state} onChange={e => setState(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>12 - Mailing address</label>
        <input className="form-input" value={mailingAddress} onChange={e => setMailingAddress(e.target.value)} />
      </div>
    </FormShell>
  );
}

function ProfileForm({ prospect, primaryContact, onSave, onSaveContact, onCancel }: {
  prospect: Prospect; primaryContact: Contact | null;
  onSave: (p: Record<string, unknown>) => Promise<void>;
  onSaveContact: (c: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [organizationName, setOrganizationName] = useState(prospect.organization_name ?? '');
  const [personName, setPersonName] = useState(prospect.person_name ?? '');
  const [businessTypes, setBusinessTypes] = useState<string[]>(prospect.business_types ?? []);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/business-type-options').then(r => r.json()).then(b => setBusinessTypeOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [tags, setTags] = useState<string[]>((prospect.tags ?? []).map(t => t.name));
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/tag-options').then(r => r.json()).then(b => setTagOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [industry, setIndustry] = useState(prospect.industry ?? '');
  const [website, setWebsite] = useState(prospect.website ?? '');
  const [mainEmail, setMainEmail] = useState(prospect.main_email ?? '');
  const [mainPhone, setMainPhone] = useState(prospect.main_phone ?? '');
  const [companySize, setCompanySize] = useState(prospect.company_size ?? '');
  const [xNote, setXNote] = useState(prospect.x_note ?? '');
  const [sourceRawLabel, setSourceRawLabel] = useState(prospect.source_raw_label ?? '');
  const [sourceDetail, setSourceDetail] = useState(prospect.source_detail ?? '');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/marketing/prospects/source-options').then(r => r.json()).then(b => setSourceOptions(b.options ?? [])).catch(() => {});
  }, []);
  const [role, setRole] = useState(primaryContact?.title ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(primaryContact?.linkedin_url ?? '');
  const [otherContact, setOtherContact] = useState(primaryContact?.other_contact ?? '');
  const [company2Phone, setCompany2Phone] = useState(primaryContact?.company2_phone ?? '');
  const [whatsapp, setWhatsapp] = useState(primaryContact?.whatsapp ?? false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      organization_name: organizationName.trim() || null, person_name: personName.trim() || null,
      business_types: businessTypes,
      tags: tags.map(name => {
        const existing = (prospect.tags ?? []).find(t => t.name === name);
        return { name, color: existing?.color ?? hashColor(name) };
      }),
      industry: industry.trim() || null, website: website.trim() || null,
      main_email: mainEmail.trim() || null, main_phone: mainPhone.trim() || null,
      company_size: companySize.trim() || null, x_note: xNote.trim() || null,
      source_raw_label: sourceRawLabel.trim() || null, source_detail: sourceDetail.trim() || null,
    });
    if (primaryContact) {
      await onSaveContact({
        title: role.trim() || null, linkedin_url: linkedinUrl.trim() || null,
        other_contact: otherContact.trim() || null, company2_phone: company2Phone.trim() || null,
        whatsapp,
      });
    }
    setSaving(false);
  }

  return (
    <FormShell
      title="Edit profile"
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <FieldSection icon={Building2} title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Organization name</label>
            <input className="form-input" value={organizationName} onChange={e => setOrganizationName(e.target.value)} autoFocus /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Person name</label>
            <input className="form-input" value={personName} onChange={e => setPersonName(e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label" style={{ fontSize: 12 }}>Business type</label>
          <div><TagMultiSelect values={businessTypes} options={businessTypeOptions} onChange={setBusinessTypes} placeholder="Add business type…" /></div>
        </div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Tags</label>
          <div><TagMultiSelect values={tags} options={tagOptions} onChange={setTags} placeholder="Add tag…" /></div>
        </div>
      </FieldSection>

      <FieldSection icon={Globe} title="Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Industry</label>
            <input className="form-input" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Website</label>
            <input className="form-input" value={website} onChange={e => setWebsite(e.target.value)} /></div>
        </div>
      </FieldSection>

      <FieldSection icon={Users} title="Contact">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Email</label>
            <input className="form-input" type="email" value={mainEmail} onChange={e => setMainEmail(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label>
            <input className="form-input" value={mainPhone} onChange={e => setMainPhone(e.target.value)} /></div>
        </div>
        {primaryContact && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 12 }}>04 - Role/Position</label>
                <input className="form-input" value={role} onChange={e => setRole(e.target.value)} /></div>
              <div><label className="form-label" style={{ fontSize: 12 }}>05 - LinkedIn</label>
                <input className="form-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 12 }}>07 - Other contact</label>
                <input className="form-input" value={otherContact} onChange={e => setOtherContact(e.target.value)} /></div>
              <div><label className="form-label" style={{ fontSize: 12 }}>Company 2 Phone Number</label>
                <input className="form-input" value={company2Phone} onChange={e => setCompany2Phone(e.target.value)} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} /> WhatsApp available
            </label>
          </>
        )}
      </FieldSection>

      <FieldSection icon={Tag} title="Source & notes">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>13 - Source</label>
            <div><SourceSelect value={sourceRawLabel || null} options={sourceOptions} onChange={setSourceRawLabel} placeholder="Select or type a source…" /></div>
          </div>
          <div><label className="form-label" style={{ fontSize: 12 }}>14 - Source info</label>
            <input className="form-input" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="form-label" style={{ fontSize: 12 }}>Company size</label>
            <input className="form-input" value={companySize} onChange={e => setCompanySize(e.target.value)} /></div>
          <div><label className="form-label" style={{ fontSize: 12 }}>x-Note</label>
            <input className="form-input" value={xNote} onChange={e => setXNote(e.target.value)} /></div>
        </div>
      </FieldSection>
    </FormShell>
  );
}
