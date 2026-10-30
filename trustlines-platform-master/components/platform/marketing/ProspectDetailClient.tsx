'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Users, MapPin, Trash2, Archive, ArchiveRestore, Target, Clock, ArrowRightCircle, Activity, FileText, Loader2, History, Gem, BriefcaseBusiness, CloudSync, CircleDashed, Pause, X } from 'lucide-react';
import { toast } from 'sonner';
import { computeProspectCompleteness } from '@/lib/marketing/prospectCompleteness';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { NeedClassification } from '@/types/database';
import { Select } from '@/components/platform/shared/Select';
import {
  NEED_CLASSIFICATION_LABEL, STATUSES, STATUS_LABEL,
  type Contact, type ContactNote, type HistoricalProject, type Need, type OpportunityRow, type Potential,
  type Prospect, type ProspectFile, type ProspectLocation, type Tab,
} from './prospect-detail/types';
import { OverviewTab } from './prospect-detail/OverviewTab';
import { ContactsTab } from './prospect-detail/ContactsTab';
import { LocationsTab } from './prospect-detail/LocationsTab';
import { NeedsTab } from './prospect-detail/NeedsTab';
import { PotentialsTab } from './prospect-detail/PotentialsTab';
import { OpportunitiesTab } from './prospect-detail/OpportunitiesTab';
import { ActivitiesTab } from './prospect-detail/ActivitiesTab';
import { FilesTab } from './prospect-detail/FilesTab';
import { HistoryTab } from './prospect-detail/HistoryTab';
import { feedback } from '@/components/ui/feedback-toast';
import { cn } from '@/lib/utils';

const ADD_BUTTON = 'inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface-elevated pl-4 pr-[22px] text-[13px] font-semibold leading-[1.4] text-ui-body';
const ACTION_BUTTON = 'inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border pl-5 pr-6 text-[13px] font-medium';
const NEED_TONE: Record<NeedClassification, string> = { unclassified: 't0', potential: 't7', opportunity: 't7', disqualified: 't10' };
const STAGE_TONE: Partial<Record<OpportunityRow['stage'], string>> = { closed_won: 't9', closed_lost: 't10', on_hold: 't0' };

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
  aside?: React.ReactNode;
}

export function ProspectDetailClient({
  initialProspect, initialContacts, initialLocations, initialNeeds, initialPotentials, initialOpportunities,
  initialFiles = [], showsAttended = [], assignees = [], canEdit, onClose, aside,
}: Props) {
  const router = useRouter();
  const [prospect, setProspect] = useState<Prospect>(initialProspect);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [locations, setLocations] = useState<ProspectLocation[]>(initialLocations);
  const [needs, setNeeds] = useState<Need[]>(initialNeeds);
  const [potentials, setPotentials] = useState<Potential[]>(initialPotentials);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>(initialOpportunities);
  const [files, setFiles] = useState<ProspectFile[]>(initialFiles);
  const [backingUp, setBackingUp] = useState(false);
  async function backUpThisContact() {
    setBackingUp(true);
    try {
      const res = await fetch(`/api/marketing/prospects/${prospect.id}/backup`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Backup failed'); return; }
      toast.success(`Backed up to Dropbox: ${body.xlsxPath}`);
    } finally { setBackingUp(false); }
  }
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const VALID_TABS: Tab[] = ['overview', 'contacts', 'locations', 'needs', 'potentials', 'opportunities', 'history', 'activities', 'files'];
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return (VALID_TABS as string[]).includes(t ?? '') ? (t as Tab) : 'overview';
  });
  const [addingContact, setAddingContact] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [addingNeed, setAddingNeed] = useState(false);
  // Same NeedForm either way — classification is already fully automatic (no document =
  // Potential, document attached = Opportunity, see classifyLead()). This just tracks which
  // button was clicked so the copy/toast can tell the user what to do next.
  const [addingNeedIntent, setAddingNeedIntent] = useState<'potential' | 'opportunity'>('potential');
  const [historicalProjects, setHistoricalProjects] = useState<HistoricalProject[]>([]);
  const [historicalProjectsLoaded, setHistoricalProjectsLoaded] = useState(false);
  const [addingHistoricalProject, setAddingHistoricalProject] = useState(false);
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (tab === 'history' && !historicalProjectsLoaded) loadHistoricalProjects();
  }, [tab, historicalProjectsLoaded]);

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
    setProspect(prev => ({ ...json.prospect, created_by_label: json.prospect.created_by_label ?? prev.created_by_label })); // PATCH does not return the label
  }

  async function trashProspect() {
    if (!window.confirm(`Delete "${prospect.display_name}"? It stays in the database (recoverable), but disappears everywhere in the UI — Contacts, its Needs/Potentials/Opportunities, all of it.`)) return;
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
    if (addingNeedIntent === 'opportunity' && body.need.classification !== 'opportunity') {
      toast.success('Saved as a Potential — attach a document/layout below to confirm it as an Opportunity.');
    } else {
      toast.success(`Need classified as ${NEED_CLASSIFICATION_LABEL[body.need.classification as NeedClassification]}`);
    }
    return true;
  }

  async function loadHistoricalProjects() {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/historical-projects`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setHistoricalProjects(body.projects ?? []);
    setHistoricalProjectsLoaded(true);
  }

  async function saveHistoricalProject(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/historical-projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save project'); return false; }
    setHistoricalProjects(prev => [body.project, ...prev]);
    setAddingHistoricalProject(false);
    toast.success(`Logged as ${body.project.code}`);
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

  // Opportunities land here already in stage='sales_handoff' (auto — see
  // opportunityEngine.ts) the moment document evidence gets attached, so Sales can Accept
  // it right away without anyone clicking anything. This button is the manual fallback for
  // the rest: an Opportunity returned to Marketing (back to 'new'/'marketing_qualification')
  // needs a human to re-send it once whatever Sales flagged is fixed.
  const [handingOffId, setHandingOffId] = useState<string | null>(null);
  async function handOffOpportunity(oppId: string, title: string) {
    setHandingOffId(oppId);
    try {
      const res = await fetch(`/api/marketing/opportunities/${oppId}/handoff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not hand off to Sales'); return; }
      setOpportunities(prev => prev.map(o => (o.id === oppId ? { ...o, ...body.opportunity } : o)));
      toast.success(`"${title}" handed off — Sales can Accept it from their Handoffs board now.`);
    } catch {
      toast.error('Could not hand off to Sales');
    } finally {
      setHandingOffId(null);
    }
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
      if (!res.ok) {
        feedback.error('Upload interrupted', {
          description: `${file.name} could not be uploaded.${body.error ? ` ${body.error}` : ''}`,
          action: { label: 'Retry upload', onClick: () => void uploadFile(file) },
        });
        return;
      }
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

  const onHold = opportunities.some(o => o.stage === 'on_hold');
  const subtitle = [...(prospect.business_types ?? []), prospect.brand_name, prospect.entity_type === 'person' ? prospect.organization_name : null, prospect.entity_type === 'person' ? 'Person' : 'Organization'].filter(Boolean).join(' · ');
  const address = primaryLocation ? [primaryLocation.city, primaryLocation.address_line_1, primaryLocation.state].filter(Boolean).join(', ') : '';

  function openNeed(id: string) {
    setTab('needs');
    requestAnimationFrame(() => document.getElementById(`need-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-6', onClose && 'h-full')}>
      {!onClose && (
        <Link href="/marketing/prospects" className="btn btn-ghost btn-sm self-start">
          <ArrowLeft size={14} /> Contacts
        </Link>
      )}
      <div className="flex flex-wrap items-stretch justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start gap-4">
          <div className="flex min-w-0 flex-col items-start">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{prospect.display_name}</h1>
              {onHold && (
                <span className="inline-flex h-[22px] items-center gap-1 rounded-[4px] px-2.5 text-[12px] font-medium leading-4" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
                  <Pause size={14} aria-hidden /> On Hold
                </span>
              )}
            </div>
            <p className="m-0 text-[14px] font-medium leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">{subtitle}</p>
          </div>
          {opportunities.length > 0 && (
            <span className="inline-flex h-[22px] items-center gap-2 rounded-[4px] bg-[#DAE6F0] px-2.5 text-[12px] font-medium leading-4 text-[#1D5078]">
              <span className="size-1.5 rounded-full bg-current" aria-hidden /> Clients Opportunity
            </span>
          )}
          {address && <p className="m-0 text-[14px] leading-[1.35] text-ui-text-secondary">{address}</p>}
        </div>
        <div className="flex flex-col items-end justify-between gap-4">
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close" className="border-0 bg-transparent p-0 text-[var(--color-secondary-700)] dark:text-ui-heading">
              <X size={32} strokeWidth={1.5} aria-hidden />
            </button>
          ) : <span />}
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  <button type="button" className={ADD_BUTTON} title="Add Potential" onClick={() => { setTab('needs'); setAddingNeedIntent('potential'); setAddingNeed(true); }}>
                    <Clock size={16} aria-hidden /> Potential
                  </button>
                  <button type="button" className={ADD_BUTTON} title="Add Opportunity" onClick={() => { setTab('needs'); setAddingNeedIntent('opportunity'); setAddingNeed(true); }}>
                    <Gem size={16} aria-hidden /> Opportunity
                  </button>
                  <button type="button" className={ADD_BUTTON} title="Add Project" onClick={() => { setTab('history'); setAddingHistoricalProject(true); }}>
                    <BriefcaseBusiness size={16} aria-hidden /> Project
                  </button>
                </>
              )}
              {canEdit ? (
                <Select className="form-input" style={{ fontSize: 13, height: 36, width: 'auto', minWidth: 101 }} value={prospect.status}
                  onChange={e => patch({ status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              ) : (
                <span className="inline-flex h-9 items-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:text-ui-heading">{STATUS_LABEL[prospect.status]}</span>
              )}
            </div>
            <span className="h-9 w-px bg-ui-divider" aria-hidden />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && (
                <button type="button" className={cn(ACTION_BUTTON, 'border-[var(--status-t10-fg)]')} style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }} onClick={trashProspect}>
                  <Trash2 size={16} aria-hidden /> Delete
                </button>
              )}
              <button type="button" className={cn(ACTION_BUTTON, 'border-[var(--color-secondary-700)] bg-transparent text-[var(--color-secondary-700)] dark:border-[#EEF2F6] dark:text-[#EEF2F6]')} disabled={backingUp} onClick={backUpThisContact} title="Save this Contact's whole card (people, locations, needs, potentials, notes…) to Dropbox as Excel + JSON">
                {backingUp ? <Loader2 size={16} className="spin" /> : <CloudSync size={16} aria-hidden />} Back up
              </button>
              {canEdit && (
                <button type="button" className={cn(ACTION_BUTTON, 'border-transparent bg-[var(--color-secondary-700)] text-white dark:bg-[#EEF2F6] dark:text-[#0A0C0F]')} onClick={() => patch({ is_archived: !prospect.is_archived })}>
                  {prospect.is_archived ? <><ArchiveRestore size={16} aria-hidden /> Unarchive</> : <><Archive size={16} aria-hidden /> Archive</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-[262px] shrink-0 flex-col gap-2 overflow-y-auto rounded-[8px] bg-ui-surface p-2">
          {needs.length === 0 && <p className="m-auto p-4 text-center text-[13px] text-ui-text-secondary">No needs yet.</p>}
          {needs.map(n => {
            const stage = opportunities.find(o => o.need_id === n.id)?.stage;
            const tone = stage ? STAGE_TONE[stage] ?? 't7' : NEED_TONE[n.classification];
            return (
              <button key={n.id} type="button" onClick={() => openNeed(n.id)} className="flex w-full shrink-0 flex-col items-start gap-2 rounded-[6px] border-0 bg-ui-page-bg px-5 py-3 text-left">
                <span className="flex w-full flex-col gap-[3px] leading-[1.4]">
                  <span className="truncate text-[13px] font-semibold text-ui-body">{n.title}</span>
                  {(n.description || n.source) && <span className="truncate text-[11px] text-ui-text-secondary">{n.description || n.source}</span>}
                </span>
                <span className="inline-flex max-w-full items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4" style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
                  <CircleDashed size={14} aria-hidden className="shrink-0" />
                  <span className="truncate">{stage ? OPPORTUNITY_STAGE_LABEL[stage] : NEED_CLASSIFICATION_LABEL[n.classification]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface">
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <div style={{ marginBottom: 12, maxWidth: 360 }} title={completeness.checks.filter(c => !c.done).map(c => c.label).join(', ') || 'All fields filled'}>
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 18 }}>
              {([
                { key: 'overview', label: 'Overview', icon: Building2 },
                { key: 'contacts', label: `Contacts (${contacts.length})`, icon: Users },
                { key: 'locations', label: `Locations (${locations.length})`, icon: MapPin },
                { key: 'needs', label: `Needs (${needs.length})`, icon: Target },
                { key: 'potentials', label: `Potentials (${activePotentials.length})`, icon: Clock },
                { key: 'opportunities', label: `Opportunities (${opportunities.length})`, icon: ArrowRightCircle },
                { key: 'activities', label: 'Emails & activity', icon: Activity },
                { key: 'files', label: 'Files', icon: FileText },
                { key: 'history', label: `Past Projects (${historicalProjects.length})`, icon: History },
              ] as { key: Tab; label: string; icon: typeof Building2 }[]).map(t => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      borderRadius: 0, borderBottom: active ? '2px solid var(--ui-tab-accent, var(--brand-navy))' : '2px solid transparent',
                      boxShadow: active ? 'var(--ui-tab-glow, none)' : 'none',
                      color: active ? 'var(--ui-tab-accent-text, var(--fg-default))' : 'var(--fg-subtle)', fontWeight: active ? 600 : 500,
                    }}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'overview' && (
              <OverviewTab
                prospect={prospect}
                primaryContact={primaryContact}
                primaryLocation={primaryLocation}
                showsAttended={showsAttended}
                needs={needs}
                canEdit={canEdit}
                editingProfile={editingProfile}
                setEditingProfile={setEditingProfile}
                onPatch={patch}
                onUpdateContact={updateContact}
                onViewNeeds={() => setTab('needs')}
              />
            )}

            {tab === 'contacts' && (
              <ContactsTab
                contacts={contacts}
                canEdit={canEdit}
                addingContact={addingContact}
                setAddingContact={setAddingContact}
                editingContactId={editingContactId}
                setEditingContactId={setEditingContactId}
                onSave={saveContact}
                onUpdate={updateContact}
                onDelete={deleteContact}
              />
            )}

            {tab === 'locations' && (
              <LocationsTab
                locations={locations}
                canEdit={canEdit}
                addingLocation={addingLocation}
                setAddingLocation={setAddingLocation}
                editingLocationId={editingLocationId}
                setEditingLocationId={setEditingLocationId}
                onSave={saveLocation}
                onUpdate={updateLocation}
                onDelete={deleteLocation}
              />
            )}

            {tab === 'needs' && (
              <NeedsTab
                prospect={prospect}
                needs={needs}
                opportunities={opportunities}
                potentials={potentials}
                locations={locations}
                canEdit={canEdit}
                addingNeed={addingNeed}
                setAddingNeed={setAddingNeed}
                addingNeedIntent={addingNeedIntent}
                editingNeedId={editingNeedId}
                setEditingNeedId={setEditingNeedId}
                onSave={saveNeed}
                onUpdate={updateNeed}
                onTrash={trashNeed}
                setNeeds={setNeeds}
                setOpportunities={setOpportunities}
                setPotentials={setPotentials}
                setTab={setTab}
              />
            )}

            {tab === 'potentials' && <PotentialsTab activePotentials={activePotentials} donePotentials={donePotentials} />}

            {tab === 'opportunities' && (
              <OpportunitiesTab
                opportunities={opportunities}
                canEdit={canEdit}
                assignees={assignees}
                expandedOppId={expandedOppId}
                setExpandedOppId={setExpandedOppId}
                handingOffId={handingOffId}
                onHandOff={handOffOpportunity}
              />
            )}

            {tab === 'activities' && <ActivitiesTab prospect={prospect} contacts={contacts} canEdit={canEdit} />}

            {tab === 'files' && (
              <FilesTab
                files={files}
                canEdit={canEdit}
                fileInputRef={fileInputRef}
                uploadingFile={uploadingFile}
                onUpload={uploadFile}
                onView={viewFile}
                onDelete={deleteFile}
              />
            )}

            {tab === 'history' && (
              <HistoryTab
                canEdit={canEdit}
                addingHistoricalProject={addingHistoricalProject}
                setAddingHistoricalProject={setAddingHistoricalProject}
                historicalProjectsLoaded={historicalProjectsLoaded}
                historicalProjects={historicalProjects}
                onSave={saveHistoricalProject}
              />
            )}
          </div>
          {aside}
        </div>
      </div>
    </div>
  );
}
