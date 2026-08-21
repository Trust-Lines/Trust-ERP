'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { X, Plus, Trash2, Check, Loader2, ExternalLink } from 'lucide-react';
import { LeadActivity } from './LeadActivity';
import { PROJECT_TYPES, LEAD_SOURCES } from '@/lib/sales/projectTypes';
import { composeProjectCode, serviceLineLabel, regionLabel } from '@/lib/regions';
import { STATUS_ORDER, LEAD_INTAKE_STATUS_KEYS } from './types';

interface TaskRow {
  id: string; title: string; status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null; assignee_name: string | null; due_date: string | null;
}

type Intake = Record<string, unknown>;

const UPDATE_FIELDS = new Set([
  'priority', 'assignee_id', 'opportunity_status', 'next_action',
  'follow_up_date', 'deal_size', 'source', 'project_type',
]);

export function LeadQuickView({ intakeId, assignees, onClose }: {
  intakeId: string;
  assignees: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mouseDownOnBackdrop = useRef(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState('');

  const load = useCallback(async () => {
    try {
      const [iRes, tRes] = await Promise.all([
        fetch(`/api/leads/${intakeId}/intake`).then(r => r.json()),
        fetch(`/api/leads/${intakeId}/tasks`).then(r => r.json()),
      ]);
      setIntake(iRes.intake ?? null);
      setTasks(tRes.tasks ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [intakeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveField(name: string, value: unknown) {
    setIntake(prev => (prev ? { ...prev, [name]: value } : prev));
    setSaving(true);
    try {
      const useUpdate = UPDATE_FIELDS.has(name);
      const url = useUpdate ? `/api/leads/${intakeId}/update` : `/api/leads/${intakeId}/intake`;
      const res = await fetch(url, {
        method: useUpdate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value }),
      });
      if (!res.ok) throw new Error();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setNewTask('');
    const res = await fetch(`/api/leads/${intakeId}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not add task'); return; }
    const d = await res.json();
    setTasks(t => [...t, { ...d.task, assignee_name: null }]);
  }

  async function patchTask(task: TaskRow, patch: Partial<TaskRow>) {
    setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/leads/${intakeId}/tasks/${task.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not save task'); load(); }
  }

  async function removeTask(task: TaskRow) {
    setTasks(ts => ts.filter(t => t.id !== task.id));
    await fetch(`/api/leads/${intakeId}/tasks/${task.id}`, { method: 'DELETE' }).catch(() => {});
  }

  const v = (k: string) => (intake?.[k] as string | number | null) ?? '';
  const code = intake?.project_number != null
    ? composeProjectCode(intake.service_line as string, intake.region as string, intake.project_number as number)
    : '—';
  const title = (intake?.customer_name as string)?.trim()
    || (intake?.brand as string)?.trim()
    || 'Untitled lead';
  const openTasks = tasks.filter(t => t.status !== 'done').length;

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: 'min(940px, 100%)', boxShadow: '0 12px 48px rgba(0,0,0,.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>{code}</div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: '2px 0 0' }}>{title}</h2>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
              {serviceLineLabel(intake?.service_line as string) || '—'} · {regionLabel(intake?.region as string) || '—'}
              {openTasks > 0 && <> · <b style={{ color: 'var(--status-warning-fg)' }}>{openTasks} open task{openTasks === 1 ? '' : 's'}</b></>}
            </div>
          </div>
          {saving && <Loader2 size={14} className="qv-spin" style={{ color: 'var(--fg-faint)', marginTop: 6 }} />}
          <Link href={`/leads/${intakeId}`} className="btn btn-secondary btn-sm"><ExternalLink size={13} /> Full form</Link>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 4 }} aria-label="Close"><X size={18} /></button>
        </div>

        <style>{`.qv-spin{animation:qv-spin 1s linear infinite}@keyframes qv-spin{to{transform:rotate(360deg)}}`}</style>

        {!loaded ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}><Loader2 size={18} className="qv-spin" /> Loading…</div>
        ) : (
          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Fields</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2px 24px', marginBottom: 20 }}>
              <Row label="Customer name"><Inp value={v('customer_name')} ph="e.g. Lumen Optics" onSave={x => saveField('customer_name', x)} /></Row>
              <Row label="Status OP">
                <Sel value={String(v('opportunity_status') || 'new_opportunity')} onChange={x => saveField('opportunity_status', x)}
                  opts={STATUS_ORDER.filter(s => LEAD_INTAKE_STATUS_KEYS.includes(s.key)).map(s => [s.key, s.label])} />
              </Row>
              <Row label="Assignee">
                <Sel value={String(v('assignee_id'))} onChange={x => saveField('assignee_id', x)}
                  opts={[['', 'Unassigned'], ...assignees.map(a => [a.id, a.full_name] as [string, string])]} />
              </Row>
              <Row label="Priority">
                <Sel value={String(v('priority') || 'medium')} onChange={x => saveField('priority', x)}
                  opts={[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
              </Row>
              <Row label="Project Type">
                <Sel value={String(v('project_type'))} onChange={x => saveField('project_type', x)}
                  opts={[['', '—'], ...PROJECT_TYPES.map(t => [t, t] as [string, string])]} />
              </Row>
              <Row label="Source">
                <Sel value={String(v('source'))} onChange={x => saveField('source', x)}
                  opts={[['', '—'], ...LEAD_SOURCES.map(s => [s, s] as [string, string])]} />
              </Row>
              <Row label="Deal Size"><Inp type="number" value={v('deal_size')} ph="e.g. 250000" onSave={x => saveField('deal_size', x === '' ? null : Number(x))} /></Row>
              <Row label="Direct Contact"><Inp value={v('contact_person')} ph="e.g. John Smith" onSave={x => saveField('contact_person', x)} /></Row>
              <Row label="Phone"><Inp value={v('contact_phone')} ph="e.g. +1 555 123 4567" onSave={x => saveField('contact_phone', x)} /></Row>
              <Row label="Email"><Inp type="email" value={v('customer_email')} ph="e.g. john@lumenoptics.com" onSave={x => saveField('customer_email', x)} /></Row>
              <Row label="Brand"><Inp value={v('brand')} ph="e.g. Lumen" onSave={x => saveField('brand', x)} /></Row>
              <Row label="Industry"><Inp value={v('industry')} ph="e.g. Retail, F&B" onSave={x => saveField('industry', x)} /></Row>
              <Row label="Location (City)"><Inp value={v('city')} ph="e.g. Briarcliff Manor" onSave={x => saveField('city', x)} /></Row>
              <Row label="State"><Inp value={v('state')} ph="e.g. NY" onSave={x => saveField('state', x)} /></Row>
              <Row label="Follow-up"><Inp type="date" value={v('follow_up_date')} onSave={x => saveField('follow_up_date', x)} /></Row>
              <Row label="To Do / Next action"><Inp value={v('next_action')} ph="e.g. Send estimate" onSave={x => saveField('next_action', x)} /></Row>
              <Row label="Request"><span style={ro}>{serviceLineLabel(intake?.service_line as string) || '—'}</span></Row>
              <Row label="PROJECT #"><span style={{ ...ro, fontFamily: 'var(--font-mono)' }}>{code}</span></Row>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Subtasks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {tasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No subtasks.</div>}
              {tasks.map(t => {
                const done = t.status === 'done';
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div onClick={() => patchTask(t, { status: done ? 'todo' : 'done' })} style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                      border: `1.5px solid ${done ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                      background: done ? 'var(--brand-teal)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{done && <Check size={10} strokeWidth={3} color="#fff" />}</div>
                    <span style={{ flex: 1, fontSize: 13, color: done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                    <select value={t.assignee_id ?? ''} onChange={e => patchTask(t, { assignee_id: e.target.value || null })}
                      style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)', maxWidth: 150 }}>
                      <option value="">Unassigned</option>
                      {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                    <button onClick={() => removeTask(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 2 }} aria-label="Delete task"><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              <input className="form-input" placeholder="Add a subtask (e.g. Collect Information)…" value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} style={{ fontSize: 13 }} />
              <button className="btn btn-secondary btn-sm" onClick={addTask} disabled={!newTask.trim()}><Plus size={13} /> Add</button>
            </div>

            <LeadActivity intakeId={intakeId} />
          </div>
        )}
      </div>
    </div>
  );
}

const ro: React.CSSProperties = { fontSize: 13, color: 'var(--fg-muted)' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', minHeight: 34 }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '3px 6px', border: '1px solid transparent',
  borderRadius: 5, background: 'transparent', color: 'var(--fg-default)',
};

function Inp({ value, onSave, type = 'text', ph }: { value: string | number; onSave: (v: string) => void; type?: string; ph?: string }) {
  const [val, setVal] = useState(String(value ?? ''));
  useEffect(() => { setVal(String(value ?? '')); }, [value]);
  return (
    <input
      type={type} value={val} placeholder={ph ?? '—'}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== String(value ?? '')) onSave(val); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={cellInput}
      onFocus={e => { e.target.style.border = '1px solid var(--border-default)'; e.target.style.background = 'var(--bg-surface)'; }}
      onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
    />
  );
}

function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...cellInput, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
