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

interface Props {
  intakeId: string;
  assignees: { id: string; full_name: string }[];
}

export function IntakeForm({ intakeId, assignees }: Props) {
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

  async function handleSave(showToast = true) {
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal_size: form.deal_size ? parseFloat(form.deal_size) : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await fetch(`/api/leads/${intakeId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedAt(new Date());
      if (showToast) toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLead() {
    await handleSave(false);
    toast.success('Lead created successfully');
    router.push('/leads');
  }

  // "Continue" saves the draft silently, then moves on; "Back" only moves.
  const continueTo = (step: number) => { handleSave(false); setActiveStep(step); };
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
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 mb-1"
          >
            ← Leads
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New lead</h1>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {savedAt ? 'Draft saved' : 'Not saved yet'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">Meeting / Intake form</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/leads')}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save draft'}
          </button>
        </div>
      </div>

      {/* ── 3-Column Layout: Steps Sidebar + Main Form + Lead Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── 1. Left Column: 7-Step Navigation ────────────────────── */}
        <StepNav activeStep={activeStep} onSelect={setActiveStep} />

        {/* ── 2. Center Column: Form Step Content ───────────────────── */}
        <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-6">
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
