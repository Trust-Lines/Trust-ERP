'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  ChevronDown,
  Lock,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Paperclip,
  Upload,
  Link2,
} from 'lucide-react';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, SERVICE_LINES, composeProjectCode } from '@/lib/regions';
import { PROJECT_TYPES, LEAD_SOURCES } from '@/lib/sales/projectTypes';

interface DocRow {
  id: string;
  category: string;
  dropbox_path: string;
  file_name: string;
  created_at: string;
}

interface Props {
  intakeId: string;
  assignees: { id: string; full_name: string }[];
}

type Scope = { shelving: boolean; millwork: boolean; image: boolean; ceiling: boolean };
type Notes = {
  shelving: string;
  millwork: string;
  image: string;
  ceiling: string;
  areas: string;
  client_special_request: string;
};
type ChecklistItem = { id: string; text: string; done: boolean };

interface FormState {
  company: string;
  region: string;
  service_line: string;
  project_type: string;
  customer_name: string;
  brand: string;
  customer_email: string;
  contact_person: string;
  contact_phone: string;
  industry: string;
  customer_address: string;
  street: string;
  city: string;
  state: string;
  scope_of_work: Scope;
  notes: Notes;
  matterport_link: string;
  priority: string;
  assignee_id: string;
  deal_size: string;
  source: string;
  follow_up_date: string;
  next_action: string;
  tags: string;
  checklist: ChecklistItem[];
}

const EMPTY: FormState = {
  company: '',
  region: '',
  service_line: 'ST',
  project_type: '',
  customer_name: '',
  brand: '',
  customer_email: '',
  contact_person: '',
  contact_phone: '',
  industry: '',
  customer_address: '',
  street: '',
  city: '',
  state: '',
  scope_of_work: { shelving: false, millwork: false, image: false, ceiling: false },
  notes: { shelving: '', millwork: '', image: '', ceiling: '', areas: '', client_special_request: '' },
  matterport_link: '',
  priority: 'medium',
  assignee_id: '',
  deal_size: '',
  source: '',
  follow_up_date: '',
  next_action: '',
  tags: '',
  checklist: [],
};

const WIZARD_STEPS = [
  { step: 1, title: 'Project setup', subtitle: 'Company, region & site' },
  { step: 2, title: 'Customer', subtitle: 'Customer & contact info' },
  { step: 3, title: 'Lead details', subtitle: 'Priority, source & follow-up' },
  { step: 4, title: 'Scope of work', subtitle: 'Shelving, millwork, images' },
  { step: 5, title: 'Additional notes', subtitle: 'Areas & client requests' },
  { step: 6, title: 'Dimensions & media', subtitle: 'Plans, photos & 360 link' },
  { step: 7, title: 'Checklist', subtitle: 'Subtasks & next steps' },
];

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
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-1">
          {WIZARD_STEPS.map((s) => {
            const isActive = activeStep === s.step;
            const isDone = activeStep > s.step;

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveStep(s.step)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer relative ${
                  isActive
                    ? 'bg-blue-50/70'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? <Check size={12} strokeWidth={2.5} /> : s.step}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold leading-tight ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                    {s.title}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── 2. Center Column: Form Step Content ───────────────────── */}
        <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-6">
          {/* Step 1: Project setup */}
          {activeStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Project setup</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up the basics for this lead to generate a project code and site address.
                </p>
              </div>

              {/* 3-column row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.company || form.service_line}
                      onChange={e => setForm(f => ({ ...f, company: e.target.value, service_line: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select company...</option>
                      {SERVICE_LINES.map(sl => (
                        <option key={sl.value} value={sl.value}>{sl.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Region <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.region}
                      onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select region...</option>
                      {REGIONS.map(r => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Project type <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.project_type}
                      onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select project type...</option>
                      {PROJECT_TYPES.map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Project code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project code</label>
                <div className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono">
                  {form.region ? generatedProjectCode : '-- -- --'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Auto-generated: company + region + running number (e.g. STW 460).
                </p>
              </div>

              {/* Project site address */}
              <div className="space-y-3 pt-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Project site address</h3>
                  <p className="text-[11px] text-slate-500">The job-site address — used to name the project.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Street <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter street address"
                    value={form.street}
                    onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter city"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Select state...</option>
                        {US_STATES.map(s => (
                          <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                  <span className="text-blue-600 font-bold">ⓘ</span>
                  <span>{formattedAddressPreview}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(2); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Continue to Customer</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(true); router.push('/leads'); }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Save and exit
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Customer */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Customer information</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter the customer or client brand details.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Retail LLC"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Brand / Franchise name"
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact person</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.contact_person}
                    onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact email</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={form.customer_email}
                    onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(3); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span>Continue to Lead details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Lead details */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Lead details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Set priority, sales owner, and deal expectations.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assignee / Owner</label>
                  <select
                    value={form.assignee_id}
                    onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deal size ($ USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={form.deal_size}
                    onChange={e => setForm(f => ({ ...f, deal_size: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead source</label>
                  <select
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="">Select source...</option>
                    {LEAD_SOURCES.map(ls => (
                      <option key={ls} value={ls}>{ls}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(4); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span>Continue to Scope of work</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Scope of work */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Scope of work</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select trade disciplines requested by customer.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['shelving', 'millwork', 'image', 'ceiling'] as const).map(trade => (
                  <label
                    key={trade}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      form.scope_of_work[trade]
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.scope_of_work[trade]}
                      onChange={e => setForm(f => ({ ...f, scope_of_work: { ...f.scope_of_work, [trade]: e.target.checked } }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mb-2"
                    />
                    <span className="text-xs capitalize">{trade}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(5); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span>Continue to Additional notes</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Additional notes */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Additional notes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Area details & customer specific requests.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Areas / Rooms</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Sales floor, backroom, drive-thru counter..."
                  value={form.notes.areas}
                  onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, areas: e.target.value } }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client Special Requests</label>
                <textarea
                  rows={3}
                  placeholder="Any special material or timing requirements..."
                  value={form.notes.client_special_request}
                  onChange={e => setForm(f => ({ ...f, notes: { ...f.notes, client_special_request: e.target.value } }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(6); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span>Continue to Dimensions & media</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Dimensions & media */}
          {activeStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dimensions & media</h2>
                <p className="text-xs text-slate-500 mt-0.5">Attach Matterport 360 link and initial site files.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Matterport 360 Virtual Tour Link</label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://my.matterport.com/show/?m=..."
                    value={form.matterport_link}
                    onChange={e => setForm(f => ({ ...f, matterport_link: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50">
                <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700">Drop files or plans to upload</p>
                <p className="text-[10px] text-slate-400 mt-0.5">PDF, DWG, PNG, or JPG up to 50MB</p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => { handleSave(false); setActiveStep(7); }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span>Continue to Checklist</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Checklist */}
          {activeStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Checklist & next steps</h2>
                <p className="text-xs text-slate-500 mt-0.5">Track immediate action items for this opportunity.</p>
              </div>

              <div className="space-y-2">
                {form.checklist.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={e => {
                        const next = [...form.checklist];
                        next[idx].done = e.target.checked;
                        setForm(f => ({ ...f, checklist: next }));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add checklist item..."
                    value={newChecklistText}
                    onChange={e => setNewChecklistText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newChecklistText.trim()) {
                        e.preventDefault();
                        setForm(f => ({
                          ...f,
                          checklist: [...f.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }],
                        }));
                        setNewChecklistText('');
                      }
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newChecklistText.trim()) return;
                      setForm(f => ({
                        ...f,
                        checklist: [...f.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }],
                      }));
                      setNewChecklistText('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveStep(6)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateLead}
                  disabled={!canCreate}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <span>Complete & Create Lead</span>
                  <Check size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Right Column: Lead Summary Card ────────────────────── */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Lead summary</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {savedAt ? 'Saved' : 'Not saved yet'}
            </span>
          </div>

          {/* Project code box */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Project code
            </label>
            <div className="w-full bg-slate-100/70 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700">
              {generatedProjectCode}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">{filledRequiredCount} of 4 required fields</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(filledRequiredCount / 4) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Fill Company · Region · Customer · Address to start
            </p>
          </div>

          {/* Checklist of required items */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                hasCompany ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
              }`}>
                ✓
              </span>
              <span className={hasCompany ? 'text-slate-900 font-semibold' : 'text-slate-500'}>Company</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                hasRegion ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
              }`}>
                ✓
              </span>
              <span className={hasRegion ? 'text-slate-900 font-semibold' : 'text-slate-500'}>Region</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                hasCustomer ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
              }`}>
                ✓
              </span>
              <span className={hasCustomer ? 'text-slate-900 font-semibold' : 'text-slate-500'}>Customer</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                hasAddress ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
              }`}>
                ✓
              </span>
              <span className={hasAddress ? 'text-slate-900 font-semibold' : 'text-slate-500'}>Address</span>
            </div>
          </div>

          {/* Create Lead Button */}
          <div className="pt-3">
            <button
              type="button"
              onClick={handleCreateLead}
              disabled={!canCreate}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                canCreate
                  ? 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/60'
              }`}
            >
              {!canCreate && <Lock size={13} />}
              <span>Create lead</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
