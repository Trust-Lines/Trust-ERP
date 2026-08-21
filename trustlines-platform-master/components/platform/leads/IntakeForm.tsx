'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Paperclip, Loader2, Link2 } from 'lucide-react';
import { LocationSearch } from '@/components/platform/projects/LocationSearch';
import { US_STATES } from '@/lib/usStates';
import { REGIONS, SERVICE_LINES, regionLabel, serviceLineLabel, composeProjectCode } from '@/lib/regions';
import { PROJECT_TYPES, LEAD_SOURCES } from '@/lib/sales/projectTypes';

interface DocRow { id: string; category: string; dropbox_path: string; file_name: string; created_at: string }

interface Props {
  intakeId: string;
  assignees: { id: string; full_name: string }[];
}

type Scope = { shelving: boolean; millwork: boolean; image: boolean; ceiling: boolean };
type Notes = { shelving: string; millwork: string; image: string; ceiling: string; areas: string; client_special_request: string };
type ChecklistItem = { id: string; text: string; done: boolean };




interface FormState {
  region: string; service_line: string;
  customer_name: string; brand: string; customer_email: string;
  contact_person: string; contact_phone: string; industry: string; project_type: string; customer_address: string;
  city: string; street: string; state: string;
  scope_of_work: Scope; notes: Notes; matterport_link: string;

  priority: string; assignee_id: string; deal_size: string; source: string;
  follow_up_date: string; next_action: string; tags: string;
  checklist: ChecklistItem[];
}

const EMPTY: FormState = {
  region: '', service_line: '',
  customer_name: '', brand: '', customer_email: '', contact_person: '', contact_phone: '', industry: '', project_type: '', customer_address: '',
  city: '', street: '', state: '',
  scope_of_work: { shelving: false, millwork: false, image: false, ceiling: false },
  notes: { shelving: '', millwork: '', image: '', ceiling: '', areas: '', client_special_request: '' },
  matterport_link: '',
  priority: 'medium', assignee_id: '', deal_size: '', source: '',
  follow_up_date: '', next_action: '', tags: '', checklist: [],
};

const SCOPE_ITEMS: { key: keyof Scope; label: string; noteCategory: string }[] = [
  { key: 'shelving', label: 'Shelving', noteCategory: 'shelving_note' },
  { key: 'millwork', label: 'Millwork', noteCategory: 'millwork_note' },
  { key: 'image',    label: 'Image',    noteCategory: 'image_note' },
  { key: 'ceiling',  label: 'Ceiling',  noteCategory: 'ceiling_note' },
];

const compose = (c: string, s: string, st: string) => [c, s, st].map(x => x.trim()).filter(Boolean).join(' - ');

export function IntakeForm({ intakeId, assignees }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm]           = useState<FormState>(EMPTY);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [savedAt, setSavedAt]     = useState<Date | null>(null);
  const [projectId, setProjectId]         = useState<string | null>(null);
  const [projectNumber, setProjectNumber] = useState<number | null>(null);
  const [delivered, setDelivered]         = useState(false);





  const [persisted, setPersisted] = useState(false);
  const persistedRef = useRef(false);

  const [numberPreview, setNumberPreview] = useState<number | null>(null);

  const [searchState, setSearchState] = useState('');
  const [newChkItem, setNewChkItem]   = useState('');


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${intakeId}/intake`);
        const data = await res.json() as { intake: Record<string, unknown> | null; documents: DocRow[] };
        if (cancelled) return;
        if (data.intake) {
          const i = data.intake;
          setForm({
            region: (i.region as string) ?? '', service_line: (i.service_line as string) ?? '',
            customer_name: (i.customer_name as string) ?? '', brand: (i.brand as string) ?? '',
            customer_email: (i.customer_email as string) ?? '', contact_person: (i.contact_person as string) ?? '',
            contact_phone: (i.contact_phone as string) ?? '', industry: (i.industry as string) ?? '',
            project_type: (i.project_type as string) ?? '',
            customer_address: (i.customer_address as string) ?? '',
            city: (i.city as string) ?? '', street: (i.street as string) ?? '', state: (i.state as string) ?? '',
            scope_of_work: { ...EMPTY.scope_of_work, ...(i.scope_of_work as Scope ?? {}) },
            notes: { ...EMPTY.notes, ...(i.notes as Notes ?? {}) },
            matterport_link: (i.matterport_link as string) ?? '',
            priority: (i.priority as string) || 'medium',
            assignee_id: (i.assignee_id as string) ?? '',
            deal_size: i.deal_size != null ? String(i.deal_size) : '',
            source: (i.source as string) ?? '',
            follow_up_date: (i.follow_up_date as string) ?? '',
            next_action: (i.next_action as string) ?? '',
            tags: Array.isArray(i.tags) ? (i.tags as string[]).join(', ') : '',
            checklist: Array.isArray(i.checklist) ? (i.checklist as ChecklistItem[]) : [],
          });
          setProjectId((i.project_id as string) ?? null);
          setProjectNumber((i.project_number as number) ?? null);
          setDelivered(!!i.is_delivered);
          setSearchState((i.state as string) ?? '');
          setDocuments(data.documents ?? []);
          persistedRef.current = true;
          setPersisted(true);
        } else {





          const region = searchParams.get('region');
          if (region) setForm(f => ({ ...f, region }));
        }
      } catch { }
      finally {
        if (!cancelled) {
          setLoaded(true);




          requestAnimationFrame(() => { if (!nameInputRef.current?.value) nameInputRef.current?.focus(); });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [intakeId]);





  const save = useCallback(async (state: FormState): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = {
        ...state,
        deal_size: state.deal_size === '' ? null : Number(state.deal_size),
        tags: state.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/leads/${intakeId}/intake`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || data.error || 'Autosave failed'); return persistedRef.current; }
      if (data.intake) {
        setProjectId(data.intake.project_id ?? null);
        setProjectNumber(data.intake.project_number ?? null);
        setSavedAt(new Date());
        const justCreated = !persistedRef.current;
        persistedRef.current = true;
        setPersisted(true);



        if (justCreated) router.refresh();
      }
      return persistedRef.current;
    } catch { toast.error('Autosave failed'); return persistedRef.current; }
    finally { setSaving(false); }
  }, [intakeId, router]);

  const firstRender = useRef(true);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!loaded || delivered) return;
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => { save(form); }, 1500);
    return () => clearTimeout(t);
  }, [form, loaded, delivered, save]);


  useEffect(() => {
    if (!loaded || projectNumber != null) return;
    let cancelled = false;
    fetch('/api/sales/next-number')
      .then(r => r.json())
      .then((d: { nextNumber: number | null }) => { if (!cancelled) setNumberPreview(d.nextNumber ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loaded, projectNumber]);


  const [uploading, setUploading] = useState<string | null>(null);
  const uploadFile = useCallback(async (file: File, category: string) => {
    if (!projectId) { toast.error('Complete Region + Service + Customer + Address first.'); return; }
    setUploading(category);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('category', category);
      const res = await fetch(`/api/leads/${intakeId}/intake/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
      setDocuments(prev => [...prev, data.document]);
      toast.success(`Uploaded ${data.document.file_name}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(null); }
  }, [intakeId, projectId]);

  const docsFor = (category: string) => documents.filter(d => d.category === category);
  const displayNumber = projectNumber ?? numberPreview;
  const displayCode = displayNumber != null ? composeProjectCode(form.service_line, form.region, displayNumber) : '';
  const addr = compose(form.city, form.street, form.state);
  const block1Complete = !!(form.region && form.service_line && form.customer_name && form.city && form.state);






  const [savingDraft, setSavingDraft] = useState(false);
  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const ok = await save(form);
      if (ok) toast.success('Draft saved.');
      else toast.error('Fill in at least one field before saving.');
      router.push('/leads');
    } finally { setSavingDraft(false); }
  }

  if (!loaded) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}><Loader2 className="spin" size={18} /> Loading…</div>;
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const patchNote = (key: keyof Notes, val: string) => setForm(f => ({ ...f, notes: { ...f.notes, [key]: val } }));
  const toggleScope = (key: keyof Scope) => setForm(f => ({ ...f, scope_of_work: { ...f.scope_of_work, [key]: !f.scope_of_work[key] } }));
  const addChkItem = () => {
    const text = newChkItem.trim();
    if (!text) return;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id, text, done: false }] }));
    setNewChkItem('');
  };
  const toggleChkItem = (id: string) => setForm(f => ({ ...f, checklist: f.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c) }));
  const removeChkItem = (id: string) => setForm(f => ({ ...f, checklist: f.checklist.filter(c => c.id !== id) }));
  const chkDone = form.checklist.filter(c => c.done).length;

  return (
    <>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
          {delivered ? 'Delivered — read only'
            : saving ? <span><Loader2 className="spin" size={12} /> Saving…</span>
            : savedAt ? `Saved ${savedAt.toLocaleTimeString()}`
            : persisted ? 'Autosaves as you type'
            : 'Not saved yet'}
        </div>
      </div>

      {delivered && (
        <div className="info-box" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--status-success) 10%, transparent)', borderColor: 'var(--status-success)', color: 'var(--status-success-fg)' }}>
          ✓ This intake was delivered to Trust-Lines. It is now read-only.
        </div>
      )}

      <fieldset disabled={delivered} style={{ border: 'none', padding: 0, margin: 0 }}>
      <div className="form-section-stack">


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 1</div><div className="form-section-title">Project setup</div></div></div>
          <div className="card-body">

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Company</label>
                <select className="form-input form-select" value={form.service_line} onChange={e => set('service_line', e.target.value)}>
                  <option value="">Select company...</option>
                  {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label} ({s.codeShort})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Region</label>
                <select className="form-input form-select" value={form.region} onChange={e => set('region', e.target.value)}>
                  <option value="">Select region...</option>
                  {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label} ({r.codeShort})</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project code</label>
              <input className="form-input" readOnly value={displayCode}
                placeholder={form.service_line && form.region ? 'Calculating…' : 'Pick company + region'}
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', cursor: 'not-allowed', maxWidth: 200 }} />
              <div className="form-hint">Auto-generated: company + region + running number (e.g. <b>STW 460</b>).</div>
            </div>

            <div className="form-group">
              <label className="form-label">Project type</label>
              <select className="form-input form-select" value={form.project_type} onChange={e => set('project_type', e.target.value)} style={{ maxWidth: 260 }}>
                <option value="">Select project type...</option>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>


            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Project site address</label>
              <div className="form-hint" style={{ marginTop: 0, marginBottom: 6 }}>The job-site address — used to name the project. (The customer&apos;s own address is entered below.)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <select className="form-input form-select" style={{ width: 150, flexShrink: 0 }} value={searchState} onChange={e => { setSearchState(e.target.value); set('state', e.target.value); }}>
                  <option value="">State…</option>
                  {US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>)}
                </select>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <LocationSearch stateAbbr={searchState} placeholder="Search city OR full street address"
                    onSelect={r => setForm(f => ({ ...f, city: r.city || f.city, street: r.street || f.street, state: r.stateAbbr || f.state }))} />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">City</label>
                  <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Briarcliff Manor" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Street</label>
                  <input className="form-input" value={form.street} onChange={e => set('street', e.target.value)} placeholder="e.g. 199 S Highland Ave" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 120 }}>
                  <label className="form-label">State</label>
                  <input className="form-input" value={form.state} onChange={e => { set('state', e.target.value); setSearchState(e.target.value); }} placeholder="e.g. NY" />
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)' }}>
                {displayCode || '{code}'} - {addr || '{city} - {street} - {state}'}
              </div>
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 2</div><div className="form-section-title">Customer</div></div></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Customer / company name</label>
                <input
                  ref={nameInputRef} className="form-input" value={form.customer_name}
                  onChange={e => set('customer_name', e.target.value)}
                  placeholder="e.g. Lumen Optics LLC — used as the lead's title"
                  style={!form.customer_name.trim() ? { borderColor: 'var(--status-warning)', boxShadow: '0 0 0 1px var(--status-warning)' } : undefined}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Lumen (if the store carries a brand)" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer email</label>
                <input className="form-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="contact@customer.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <input className="form-input" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Retail, F&B" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact person</label>
                <input className="form-input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="e.g. John Smith (store owner)" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact phone</label>
                <input className="form-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="e.g. +1 555 123 4567" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0, marginTop: 16 }}>
              <label className="form-label">Customer address</label>
              <input className="form-input" value={form.customer_address} onChange={e => set('customer_address', e.target.value)} placeholder="Customer's own / billing address (optional)" />
              <div className="form-hint">The customer&apos;s own address — separate from the project site address above. Does not affect the project name.</div>
            </div>
            <div className="form-hint" style={{ marginTop: 10 }}>This is the real T-Lines customer — not an internal client record.</div>
          </div>
        </div>


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 3</div><div className="form-section-title">Lead details</div></div></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assignee</label>
                <select className="form-input form-select" value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                  <option value="">Unassigned</option>
                  {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Estimated deal size</label>
                <input className="form-input num" type="number" min="0" step="any" placeholder="e.g. 250000" value={form.deal_size} onChange={e => set('deal_size', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Source</label>
                <select className="form-input form-select" value={form.source} onChange={e => set('source', e.target.value)}>
                  <option value="">Select source...</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Follow-up date</label>
                <input className="form-input" type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Next action</label>
                <input className="form-input" placeholder="e.g. Send estimate, Schedule call" value={form.next_action} onChange={e => set('next_action', e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tags</label>
              <input className="form-input" placeholder="Comma-separated, e.g. urgent, franchise, repeat" value={form.tags} onChange={e => set('tags', e.target.value)} />
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 4</div><div className="form-section-title">Scope of work</div></div></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCOPE_ITEMS.map(item => {
                const on = form.scope_of_work[item.key];
                return (
                  <div key={item.key} style={{ border: `1px solid ${on ? 'var(--brand-teal)' : 'var(--border-subtle)'}`, borderRadius: 8, background: on ? '#f0fdfa' : '#fff' }}>
                    <div onClick={() => toggleScope(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? 'var(--brand-teal)' : 'var(--border-default)'}`, background: on ? 'var(--brand-teal)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Check size={10} strokeWidth={3} color="white" />}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.label}</span>
                    </div>
                    {on && (
                      <div style={{ padding: '0 12px 12px' }}>
                        <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
                          placeholder={`${item.label} notes — e.g. quantities, dimensions, finish/material, what the customer asked for. Paste or attach photos below.`}
                          value={form.notes[item.key]} onChange={e => patchNote(item.key, e.target.value)} />
                        <UploadRow category={item.noteCategory} label="Add image" docs={docsFor(item.noteCategory)} onUpload={uploadFile} uploading={uploading} disabled={!projectId} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 5</div><div className="form-section-title">Additional notes</div></div></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Areas</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
                placeholder="e.g. Sales floor 1,200 sq ft · Back storage 300 sq ft · Coffee corner near entrance"
                value={form.notes.areas} onChange={e => patchNote('areas', e.target.value)} />
              <UploadRow category="areas_note" label="Add image" docs={docsFor('areas_note')} onUpload={uploadFile} uploading={uploading} disabled={!projectId} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Client special request</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
                placeholder="e.g. Wants the store open before Black Friday · Prefers walnut finish · Budget cap $180k"
                value={form.notes.client_special_request} onChange={e => patchNote('client_special_request', e.target.value)} />
              <UploadRow category="client_special_request_note" label="Add image" docs={docsFor('client_special_request_note')} onUpload={uploadFile} uploading={uploading} disabled={!projectId} />
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head"><div><div className="text-eyebrow">Block 6</div><div className="form-section-title">Dimensions</div></div></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Plan / layout</label>
              <UploadRow category="plan_layout" label="Upload plan" docs={docsFor('plan_layout')} onUpload={uploadFile} uploading={uploading} disabled={!projectId} />
            </div>
            <div className="form-group">
              <label className="form-label">Photos</label>
              <UploadRow category="photos" label="Upload photo" docs={docsFor('photos')} onUpload={uploadFile} uploading={uploading} disabled={!projectId} multiple />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label"><Link2 size={13} style={{ verticalAlign: -2 }} /> 360 Matterport walkthrough (URL only)</label>
              <input className="form-input" type="url" placeholder="https://my.matterport.com/show/?m=…" value={form.matterport_link} onChange={e => set('matterport_link', e.target.value)} />
              <div className="form-hint">Stored as a link — never uploaded to Dropbox.</div>
            </div>
          </div>
        </div>


        <div className="card">
          <div className="card-head">
            <div>
              <div className="text-eyebrow">Block 7</div>
              <div className="form-section-title">Checklist{form.checklist.length > 0 ? ` · ${chkDone}/${form.checklist.length}` : ''}</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {form.checklist.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={() => toggleChkItem(item.id)} style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${item.done ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                    background: item.done ? 'var(--brand-teal)' : 'white',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.done && <Check size={10} strokeWidth={3} color="#fff" />}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: item.done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  <button type="button" onClick={() => removeChkItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', fontSize: 15, lineHeight: 1, padding: '0 4px' }} aria-label="Remove">✕</button>
                </div>
              ))}
              {form.checklist.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No items yet — add subtasks below.</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" placeholder="e.g. Call the owner · Get floor plan · Confirm budget" value={newChkItem}
                onChange={e => setNewChkItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChkItem(); } }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addChkItem} disabled={!newChkItem.trim()}>Add</button>
            </div>
          </div>
        </div>

      </div>
      </fieldset>


      <div className="sticky-form-footer">
        <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
          {block1Complete ? `${displayCode || 'Project'} · ${serviceLineLabel(form.service_line)} · ${regionLabel(form.region)}` : 'Fill Company · Region · Customer · Address to start'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSaveDraft} disabled={delivered || savingDraft || saving}>
            {savingDraft ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>

    </>
  );
}


function UploadRow({ category, label, docs, onUpload, uploading, disabled, multiple }: {
  category: string; label: string; docs: DocRow[];
  onUpload: (file: File, category: string) => void; uploading: string | null; disabled?: boolean; multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = uploading === category;
  return (
    <div style={{ marginTop: 8 }}>
      <input ref={inputRef} type="file" hidden multiple={multiple}
        onChange={e => { const files = e.target.files; if (files) for (const f of Array.from(files)) onUpload(f, category); if (inputRef.current) inputRef.current.value = ''; }} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || busy}
        onClick={() => inputRef.current?.click()} title={disabled ? 'Complete the setup fields first' : undefined}>
        {busy ? <Loader2 className="spin" size={13} /> : <Paperclip size={13} />} {label}
      </button>
      {docs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {docs.map(d => (
            <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 11.5, background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>
              <Paperclip size={11} /> {d.file_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
