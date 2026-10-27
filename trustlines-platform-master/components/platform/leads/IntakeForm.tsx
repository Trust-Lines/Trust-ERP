'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { composeProjectCode } from '@/lib/regions';
import { EMPTY, type ChecklistItem, type DocRow, type FormState, type Notes, type Scope } from './intake/types';
import { StepNav } from './intake/StepNav';
import { Step1ProjectSetup } from './intake/Step1ProjectSetup';
import { Step2Customer } from './intake/Step2Customer';
import { Step3LeadDetails } from './intake/Step3LeadDetails';
import { Step4ScopeOfWork } from './intake/Step4ScopeOfWork';
import { Step5AdditionalNotes } from './intake/Step5AdditionalNotes';
import { Step6DimensionsMedia } from './intake/Step6DimensionsMedia';
import { Step7Checklist } from './intake/Step7Checklist';
import { LeadSummary } from './intake/LeadSummary';
import { Button } from '@/components/ui/button';

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
  });

  return (
    <div className="w-full space-y-5 pb-16">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/leads"
            className="text-xs font-semibold text-primary-500 dark:text-primary-200 hover:text-primary-800 transition-colors flex items-center gap-1 mb-1"
          >
            ← Leads
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-50 tracking-tight">
              {isExisting ? (leadName?.trim() || 'Edit lead') : 'New lead'}
            </h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-700 text-primary-600 dark:text-primary-200 border border-ui-divider">
              {savedAt ? (isExisting ? 'Saved' : 'Draft saved') : 'Not saved yet'}
            </span>
          </div>
          <p className="text-xs text-primary-500 dark:text-primary-200 font-normal mt-0.5">Meeting / Intake form</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={() => router.push('/leads')}>
            Cancel
          </Button>
          <Button onClick={() => handleSave(true)} loading={saving} disabled={saving}>
            Save draft
          </Button>
        </div>
      </div>

      {/* ── 3-Column Layout: Steps Sidebar + Main Form + Lead Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── 1. Left Column: 7-Step Navigation ────────────────────── */}
        <StepNav activeStep={activeStep} onSelect={goTo} isStepDone={isStepDone} />

        {/* ── 2. Center Column: Form Step Content ───────────────────── */}
        <div className="lg:col-span-6 bg-ui-surface-elevated border border-ui-divider rounded-2xl p-6 shadow-2xs space-y-6">
          {activeStep === 1 && (
            <Step1ProjectSetup
              form={form}
              setForm={setForm}
              generatedProjectCode={generatedProjectCode}
              formattedAddressPreview={formattedAddressPreview}
              onNext={() => continueTo(2)}
              onSaveAndExit={() => { handleSave(true); router.push('/leads'); }}
            />
          )}
          {activeStep === 2 && <Step2Customer {...stepProps(2)} />}
          {activeStep === 3 && <Step3LeadDetails {...stepProps(3)} assignees={assignees} />}
          {activeStep === 4 && <Step4ScopeOfWork {...stepProps(4)} />}
          {activeStep === 5 && <Step5AdditionalNotes {...stepProps(5)} />}
          {activeStep === 6 && <Step6DimensionsMedia {...stepProps(6)} />}
          {activeStep === 7 && (
            <Step7Checklist
              form={form}
              setForm={setForm}
              newChecklistText={newChecklistText}
              setNewChecklistText={setNewChecklistText}
              canCreate={canCreate}
              onBack={() => setActiveStep(6)}
              onCreate={handleCreateLead}
            />
          )}
        </div>

        {/* ── 3. Right Column: Lead Summary Card ────────────────────── */}
        <LeadSummary
          savedAt={savedAt}
          generatedProjectCode={generatedProjectCode}
          filledRequiredCount={filledRequiredCount}
          hasCompany={hasCompany}
          hasRegion={hasRegion}
          hasCustomer={hasCustomer}
          hasAddress={hasAddress}
          canCreate={canCreate}
          onCreate={handleCreateLead}
        />
      </div>
    </div>
  );
}
