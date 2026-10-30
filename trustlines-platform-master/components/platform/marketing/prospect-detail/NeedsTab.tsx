'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Pencil, Trash2, ClipboardList } from 'lucide-react';
import { PROJECT_TYPE_LABEL, SCOPE_TYPE_LABEL, OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { NeedClassificationPill } from './shared';
import { NeedForm } from './NeedForm';
import { NeedDocumentsSection } from './NeedDocumentsSection';
import {
  DONE_POTENTIAL_STATUSES,
  type Need, type OpportunityRow, type Potential, type Prospect, type ProspectLocation, type Tab,
} from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function NeedsTab({
  prospect, needs, opportunities, potentials, locations, canEdit,
  addingNeed, setAddingNeed, addingNeedIntent, editingNeedId, setEditingNeedId,
  onSave, onUpdate, onTrash, setNeeds, setOpportunities, setPotentials, setTab,
}: {
  prospect: Prospect;
  needs: Need[];
  opportunities: OpportunityRow[];
  potentials: Potential[];
  locations: ProspectLocation[];
  canEdit?: boolean;
  addingNeed: boolean;
  setAddingNeed: (adding: boolean) => void;
  addingNeedIntent: 'potential' | 'opportunity';
  editingNeedId: string | null;
  setEditingNeedId: (id: string | null) => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onUpdate: (needId: string, payload: Record<string, unknown>) => Promise<boolean>;
  onTrash: (needId: string, title: string) => void;
  setNeeds: Dispatch<SetStateAction<Need[]>>;
  setOpportunities: Dispatch<SetStateAction<OpportunityRow[]>>;
  setPotentials: Dispatch<SetStateAction<Potential[]>>;
  setTab: (tab: Tab) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '0 0 12px' }}>
        Each project need is classified automatically and independently. A Lead may have zero, one, or many —
        "another project" for this Lead is a new Need here, never edited into an existing Opportunity.
      </p>
      {addingNeed && canEdit && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 8 }}>
              Adding a {addingNeedIntent === 'opportunity' ? 'new Opportunity' : 'new Potential'}
            </div>
            <NeedForm locations={locations} defaultRegion={prospect.region} onSave={onSave} onCancel={() => setAddingNeed(false)} />
          </div>
        </div>
      )}
      {needs.length === 0 ? (
        <div className="card"><EmptyState size="sm" className="justify-center px-4 py-8" icon={<ClipboardList />} title="No project needs yet." /></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {needs.map(n => {
            const linkedOpportunity = opportunities.find(o => o.need_id === n.id);
            const linkedPotential = potentials.find(p => p.need_id === n.id && !DONE_POTENTIAL_STATUSES.has(p.status));
            if (editingNeedId === n.id) {
              return (
                <div key={n.id} id={`need-${n.id}`} className="card"><div className="card-body">
                  <NeedForm initial={n} locations={locations} onSave={payload => onUpdate(n.id, payload)} onCancel={() => setEditingNeedId(null)} />
                </div></div>
              );
            }
            return (
              <div key={n.id} id={`need-${n.id}`} className="card"><div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                  <NeedClassificationPill c={n.classification} />
                  {canEdit && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingNeedId(n.id)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => onTrash(n.id, n.title)}>
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
  );
}
