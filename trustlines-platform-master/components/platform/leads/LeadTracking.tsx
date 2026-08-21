'use client';

import { useState, useEffect } from 'react';
import { Check, Circle, FileText } from 'lucide-react';
import { STAGE_ORDER, STAGE_LABELS, getStageIndex } from '@/lib/workflow/machine';
import { PHASE1_STEPS } from '@/lib/workflow/steps';
import type { ProjectStage } from '@/types/database';

interface StepRow { phase: string; step_key: string; cat_group: string | null; status: string }
interface Tracking {
  delivered: boolean;
  project?: { code: string; name: string; current_stage: string; current_phase: string } | null;
  steps?: StepRow[];
  documents?: Record<string, number>;
}

const DOC_LABELS: Record<string, string> = {
  plan_layout: 'Plan / layout', proposal: 'Proposal', construction_drawings: 'Construction drawings',
  item_plan: 'Item plan', item_list: 'Item list', boq: 'BOQ', book: 'Book', price_list: 'Price list',
  po_bo: 'PO/BO', qc_checklist: 'QC', packing_list: 'Packing list', shipment_doc: 'Shipment', delivery_confirm: 'Delivery',
  closed_deal_email: 'Closed-deal email', shop_drawing: 'Shop drawing',
};

export function LeadTracking({ intakeId }: { intakeId: string }) {
  const [t, setT] = useState<Tracking | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${intakeId}/tracking`).then(r => r.json()).then((d: Tracking) => { if (!cancelled) setT(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [intakeId]);

  if (!t || !t.delivered || !t.project) return null;

  const curIdx = getStageIndex(t.project.current_stage as ProjectStage);
  const stepDone = (key: string) => {
    const s = (t.steps ?? []).find(x => x.phase === 'phase1' && x.step_key === key);
    return s ? (s.status === 'done' || s.status === 'approved') : false;
  };
  const docEntries = Object.entries(t.documents ?? {});

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Delivered to Trust-Lines</div>
          <div className="form-section-title">Project progress · {t.project.code}</div>
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {STAGE_ORDER.map((stage, i) => {
            const done = i < curIdx, current = i === curIdx;
            return (
              <span key={stage} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 600,
                background: current ? 'var(--brand-teal)' : done ? 'var(--brand-teal-100)' : 'var(--bg-subtle)',
                color: current ? '#fff' : done ? 'var(--brand-teal-600)' : 'var(--fg-faint)',
                border: `1px solid ${current ? 'var(--brand-teal)' : done ? '#b2d8d8' : 'var(--border-subtle)'}`,
              }}>
                {done ? <Check size={12} /> : <Circle size={9} />}
                {STAGE_LABELS[stage]}
              </span>
            );
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Finalization steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {PHASE1_STEPS.map(s => {
            const done = stepDone(s.key);
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'var(--brand-teal)' : 'transparent',
                  border: `1.5px solid ${done ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done && <Check size={10} strokeWidth={3} color="#fff" />}
                </span>
                <span style={{ fontSize: 13, color: done ? 'var(--fg-default)' : 'var(--fg-muted)' }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Documents</div>
        {docEntries.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No documents uploaded yet.</div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {docEntries.map(([type, n]) => (
              <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 12, background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>
                <FileText size={11} /> {DOC_LABELS[type] ?? type} {n > 1 && <b>×{n}</b>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
