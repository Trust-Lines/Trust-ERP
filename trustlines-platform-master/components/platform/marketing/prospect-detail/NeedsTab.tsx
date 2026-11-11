'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ArrowRight, Pencil, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconAction } from '@/components/platform/customers/customer-detail/ui';
import { cn } from '@/lib/utils';
import { PROJECT_TYPE_LABEL, SCOPE_TYPE_LABEL, OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import { CHIP, HEADING, NeedClassificationPill } from './shared';
import { NeedForm } from './NeedForm';
import { NeedDocumentsSection } from './NeedDocumentsSection';
import {
  DONE_POTENTIAL_STATUSES,
  type Need, type OpportunityRow, type Potential, type Prospect, type ProspectLocation, type Tab,
} from './types';
import { EmptyState } from '@/components/ui/empty-state';

const TAG = 'bg-[var(--status-t0-bg)] text-[var(--status-t0-fg)]';
const LINK_CHIP = 'cursor-pointer border-0 hover:opacity-90';

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
    <div className="font-[family-name:var(--font-ui)]">
      <p className="m-0 mb-3 text-[12px] leading-[1.4] text-ui-text-secondary">
        Each project need is classified automatically and independently. A Lead may have zero, one, or many —
        "another project" for this Lead is a new Need here, never edited into an existing Opportunity.
      </p>
      {addingNeed && canEdit && (
        <div className="mb-3">
          <NeedForm heading={addingNeedIntent === 'opportunity' ? 'New Opportunity' : 'New Potential'} locations={locations} defaultRegion={prospect.region} onSave={onSave} onCancel={() => setAddingNeed(false)} />
        </div>
      )}
      {needs.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg"><EmptyState size="sm" className="justify-center px-4 py-8" icon={<ClipboardList />} title="No project needs yet." /></div>
      ) : (
        <div className="grid gap-3">
          {needs.map(n => {
            const linkedOpportunity = opportunities.find(o => o.need_id === n.id);
            const linkedPotential = potentials.find(p => p.need_id === n.id && !DONE_POTENTIAL_STATUSES.has(p.status));
            if (editingNeedId === n.id) {
              return (
                <div key={n.id} id={`need-${n.id}`}>
                  <NeedForm initial={n} locations={locations} onSave={payload => onUpdate(n.id, payload)} onCancel={() => setEditingNeedId(null)} />
                </div>
              );
            }
            return (
              <div key={n.id} id={`need-${n.id}`} className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>{n.title}</h3>
                  <NeedClassificationPill c={n.classification} />
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" onClick={() => setEditingNeedId(n.id)}><Pencil aria-hidden /> Edit</Button>
                      <IconAction kind="delete" label={`Move ${n.title} to trash`} onClick={() => onTrash(n.id, n.title)} />
                    </div>
                  )}
                </div>
                {n.description && <p className="m-0 whitespace-pre-wrap text-[13px] text-ui-body">{n.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {n.project_types.map(t => <span key={t} className={cn(CHIP, TAG)}>{PROJECT_TYPE_LABEL[t]}</span>)}
                  {n.scope_types.map(t => <span key={t} className={cn(CHIP, TAG)}>{SCOPE_TYPE_LABEL[t]}</span>)}
                </div>
                {n.classification_reasons.length > 0 && (
                  <ul className="m-0 list-disc pl-[18px] text-[12px] text-ui-body">
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    {linkedOpportunity && (
                      <button type="button" className={cn(CHIP, LINK_CHIP, 'bg-[var(--status-t2-bg)] text-[var(--status-t2-fg)]')} onClick={() => setTab('opportunities')}>
                        Opportunity: {OPPORTUNITY_STAGE_LABEL[linkedOpportunity.stage]} <ArrowRight className="ml-1 size-3.5" aria-hidden />
                      </button>
                    )}
                    {linkedPotential && (
                      <button type="button" className={cn(CHIP, LINK_CHIP, 'bg-[var(--status-t7-bg)] text-[var(--status-t7-fg)]')} onClick={() => setTab('potentials')}>
                        Potential: {linkedPotential.status.replace(/_/g, ' ')} <ArrowRight className="ml-1 size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
