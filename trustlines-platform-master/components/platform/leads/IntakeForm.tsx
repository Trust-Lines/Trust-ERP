'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { composeProjectCode } from '@/lib/regions';
import { US_STATES } from '@/lib/usStates';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
import { EMPTY, type ChecklistItem, type DocRow, type FormState, type Notes, type Scope } from './intake/types';
import { StepNav } from './intake/StepNav';
import { Step1ProjectSetup } from './intake/Step1ProjectSetup';
import { Step2Customer } from './intake/Step2Customer';
import { Step3LeadDetails } from './intake/Step3LeadDetails';
import { Step4ScopeOfWork } from './intake/Step4ScopeOfWork';
import { Step6DimensionsMedia } from './intake/Step6DimensionsMedia';
import { Step7Checklist } from './intake/Step7Checklist';
import { LeadSummary } from './intake/LeadSummary';

interface Props {
  intakeId: string;
  assignees: { id: string; full_name: string }[];
  /** Set when editing a lead that already has a lead_intake row. */
  leadName?: string | null;
}

export function IntakeForm({ intakeId, assignees, leadName }: Props) {
  const isExisting = leadName !== undefined;
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Load intake data if exists
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${intakeId}/intake`);
        const data = (await res.json()) as { intake: Record<string, unknown> | null; documents: DocRow[] };
        if (!live) return;
        if (data.intake) {
          const i = data.intake;
          setForm({
            company: (i.company as string) ?? '',
            region: (i.region as string) ?? '',
            service_line: (i.service_line as string) ?? 'ST',
            project_type: (i.project_type as string) ?? '',
            customer_name: (i.customer_name as string) ?? '',
            brand: (i.brand as string) ?? '',
            customer_email: (i.customer_email as string) ?? '',
            contact_person: (i.contact_person as string) ?? '',
            contact_phone: (i.contact_phone as string) ?? '',
            industry: (i.industry as string) ?? '',
            customer_address: (i.customer_address as string) ?? '',
            street: (i.street as string) ?? '',
            city: (i.city as string) ?? '',
            state: (i.state as string) ?? '',
            scope_of_work: (i.scope_of_work as Scope) ?? EMPTY.scope_of_work,
            notes: (i.notes as Notes) ?? EMPTY.notes,
            matterport_link: (i.matterport_link as string) ?? '',
            priority: (i.priority as string) ?? 'medium',
            assignee_id: (i.assignee_id as string) ?? '',
            deal_size: i.deal_size ? String(i.deal_size) : '',
            source: (i.source as string) ?? '',
            follow_up_date: (i.follow_up_date as string) ?? '',
            next_action: (i.next_action as string) ?? '',
            tags: Array.isArray(i.tags) ? (i.tags as string[]).join(', ') : '',
            checklist: (i.checklist as ChecklistItem[]) ?? [],
          });
          setSavedAt(new Date());
        }
        if (data.documents) setDocuments(data.documents);
      } catch { }
    })();
    return () => { live = false; };
  }, [intakeId]);

  // Derived project code
  const generatedProjectCode = useMemo(() => {
    if (!form.region) return 'Pending setup';
    const sLine = form.service_line || 'ST';
    return composeProjectCode(sLine, form.region, 460);
  }, [form.service_line, form.region]);

  // Address formatted name preview
  const formattedAddressPreview = useMemo(() => {
    const parts = [form.city, form.street, form.state].map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return '3 - {city} - {street} - {state}';
    return `3 - ${parts.join(' - ')}`;
  }, [form.city, form.street, form.state]);

  // Required fields count
  const hasCompany = !!form.company || !!form.service_line;
  const hasRegion = !!form.region;
  const hasCustomer = !!form.customer_name || !!form.brand;
  const hasAddress = !!form.street && !!form.city && !!form.state;

  const filledRequiredCount = [hasCompany, hasRegion, hasCustomer, hasAddress].filter(Boolean).length;
  const canCreate = filledRequiredCount === 4;

  // A step is ticked only when its required fields are valid; steps without
  // required fields are ticked once the user has moved past them.
  const [furthestStep, setFurthestStep] = useState(1);
  const requiredByStep: Record<number, boolean> = {
    1: hasCompany && hasRegion && hasAddress,
    2: hasCustomer,
  };
  const isStepDone = (step: number) =>
    step in requiredByStep ? requiredByStep[step] : furthestStep > step;
  const goTo = (step: number) => {
    setActiveStep(step);
    setFurthestStep(s => Math.max(s, step));
  };

  // Returns true only when a lead_intake row actually exists after the call.
  async function handleSave(showToast = true): Promise<boolean> {
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal_size: form.deal_size ? parseFloat(form.deal_size) : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      // The route creates the row on the first PATCH (PROJECT-MASTER-PLAN.md:2321).
      const res = await fetch(`/api/leads/${intakeId}/intake`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { intake?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (!data.intake) {
        if (showToast) toast.info('Nothing to save yet — fill in some lead details first');
        return false;
      }
      setSavedAt(new Date());
      if (showToast) toast.success('Draft saved');
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message !== 'Save failed' ? `Could not save draft: ${e.message}` : 'Could not save draft');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLead() {
    const ok = await handleSave(false);
    if (!ok) return;
    toast.success('Lead created successfully');
    router.push('/leads');
  }

  // "Continue" saves the draft silently, then moves on; "Back" only moves.
  const continueTo = (step: number) => { handleSave(false); goTo(step); };
  const stepProps = (step: number) => ({
    form, setForm,
    onBack: () => setActiveStep(step - 1),
    onNext: () => continueTo(step + 1),
    onSaveDraft: () => handleSave(true),
  });

  // Dimensions & media uploads: the intake row must exist first (a fresh /leads/new id has none),
  // so the draft is saved once before the first file goes up.
  const [uploading, setUploading] = useState<string[]>([]);
  async function uploadDocs(files: File[]) {
    if (!savedAt) await handleSave(false);
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) { toast.error(`${file.name} is over 50 MB`); continue; }
      setUploading(u => [...u, file.name]);
      try {
        const body = new FormData();
        body.set('file', file);
        body.set('category', file.type.startsWith('image/') ? 'photos' : 'plan_layout');
        const res = await fetch(`/api/leads/${intakeId}/intake/upload`, { method: 'POST', body }).catch(() => null);
        const json = res ? await res.json().catch(() => ({})) : {};
        if (!res || !res.ok || !json.document) { toast.error(`${file.name}: ${json.error ?? 'Upload failed'}`); continue; }
        setDocuments(d => [json.document as DocRow, ...d]);
      } finally {
        setUploading(u => u.filter(n => n !== file.name));
      }
    }
  }

  // Last step's "Save and Exit": creates the lead when the required fields are there; otherwise
  // keeps it as a draft and says what's missing, so nothing typed is lost.
  async function finish() {
    if (canCreate) { await handleCreateLead(); return; }
    await handleSave(false);
    toast.info(`Saved as draft — still needed to create the lead: ${missing.join(', ')}`);
    router.push('/leads');
  }

  // "Cancel" keeps what was typed (saved as a draft) and leaves the wizard.
  async function cancel() {
    await handleSave(false);
    router.push('/leads');
  }

  async function deleteLead() {
    // Nothing stored yet (a fresh /leads/new id) — just discard the form.
    if (!savedAt) {
      if (window.confirm('Discard this new lead? Nothing has been saved yet.')) router.push('/leads');
      return;
    }
    if (!window.confirm('Delete this lead? It moves to Trash and can be restored for 30 days.')) return;
    setDeleting(true);
    const res = await fetch(`/api/leads/${intakeId}/trash`, { method: 'POST' }).catch(() => null);
    setDeleting(false);
    if (!res || !res.ok) { toast.error('Could not delete lead'); return; }
    toast.success('Lead moved to Trash');
    router.push('/leads');
  }

  const missing = [
    !hasCompany && 'Company', !hasRegion && 'Region', !hasCustomer && 'Customer', !hasAddress && 'Address',
  ].filter(Boolean) as string[];
  const previewRows = [
    { label: 'Name', value: form.customer_name || form.brand || null },
    { label: 'State', value: US_STATES.find(s => s.abbr === form.state)?.name ?? (form.state || null) },
    { label: 'Source', value: form.source || null },
    { label: 'Business Type', value: form.industry || null },
    { label: 'Assignee', value: assignees.find(a => a.id === form.assignee_id)?.full_name ?? null },
    { label: 'Due Date', value: form.follow_up_date ? new Date(`${form.follow_up_date}T00:00:00`).toLocaleDateString('en-US') : null },
  ];

  // Figma "New lead" (node 290:36781): heading, six step tabs, form card + Lead Preview.
  return (
    <div className="mx-auto flex w-full max-w-[1416px] flex-col gap-6 pb-16">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-[5px] leading-[1.35]">
            <h1 className="m-0 text-[28px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
              {isExisting ? (leadName?.trim() || 'Edit lead') : 'New lead'}
            </h1>
            <p className="m-0 text-[13px] text-ui-body">
              Meeting / Intake form
              <span className="text-ui-text-secondary"> · {saving ? 'Saving…' : savedAt ? (isExisting ? 'Saved' : 'Draft saved') : 'Not saved yet'}</span>
            </p>
          </div>
          <button
            type="button" onClick={deleteLead} disabled={deleting}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--status-t10-bg)] bg-[var(--status-t10-bg)] pl-3.5 pr-6 text-[13px] font-medium text-[var(--status-t10-fg)] transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            <Trash2 size={16} aria-hidden /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        <StepNav activeStep={activeStep} onSelect={goTo} isStepDone={isStepDone} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1027fr_365fr]">
        {/* Same height as the Lead Preview at least, so the step footer sits at the card's bottom. */}
        <div className="flex min-h-[502px] flex-col rounded-[8px] border border-ui-divider bg-ui-page-bg p-5">
          {activeStep === 1 && (
            <Step1ProjectSetup
              form={form}
              setForm={setForm}
              generatedProjectCode={generatedProjectCode}
              formattedAddressPreview={formattedAddressPreview}
              onNext={() => continueTo(2)}
              onCancel={cancel}
            />
          )}
          {activeStep === 2 && <Step2Customer {...stepProps(2)} />}
          {activeStep === 3 && <Step3LeadDetails {...stepProps(3)} assignees={assignees} />}
          {activeStep === 4 && <Step4ScopeOfWork {...stepProps(4)} />}
          {activeStep === 5 && <Step6DimensionsMedia {...stepProps(5)} documents={documents} uploading={uploading} onUpload={uploadDocs} />}
          {activeStep === 6 && (
            <Step7Checklist
              form={form}
              setForm={setForm}
              newChecklistText={newChecklistText}
              setNewChecklistText={setNewChecklistText}
              onBack={() => setActiveStep(5)}
              onFinish={finish}
            />
          )}
        </div>

        <LeadSummary projectCode={form.region ? generatedProjectCode : null} rows={previewRows} missing={missing} />
      </div>
    </div>
  );
}
