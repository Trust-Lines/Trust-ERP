'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { feedback } from '@/components/ui/feedback-toast';
import { STATUS_TO_STAGE } from '@/lib/marketing/opportunityRows';
import { STATUS_META, type Lead, type OpportunityStatus } from '../types';
import type { Assignee } from './boardConfig';

type PatchBase = 'opportunities' | 'potentials';
export interface StatusMove { id: string; name: string; status: OpportunityStatus; stage: string }

/**
 * Owns the lead list and every optimistic write. A row is saved to the API that matches its origin:
 *   intake lead   → /api/leads/:id/*
 *   opportunity   → /api/marketing/opportunities/:id
 *   potential     → /api/marketing/potentials/:id
 */
export function useLeadMutations(initialLeads: Lead[], assignees: Assignee[], marketingAssignees: Assignee[]) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  // Status change waiting for its reason (Marketing-origin deals only).
  const [statusMove, setStatusMove] = useState<StatusMove | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const assigneeName = (id?: string | null) => assignees.find(a => a.id === id)?.full_name;
  const marketingAssigneeName = (id?: string | null) => marketingAssignees.find(a => a.id === id)?.full_name;

  function updateField(id: string, patch: Partial<Lead>, body: Record<string, unknown>) {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/leads/${id}/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  function patchOpportunity(id: string, patch: Partial<Lead>, body: Record<string, unknown>, base: PatchBase = 'opportunities') {
    const before = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    fetch(`/api/marketing/${base}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save');
      if (before) setLeads(prev => prev.map(l => (l.id === id ? before : l)));
    });
  }

  /**
   * Same patch for both marketing origins; `intake` (optional) handles plain leads.
   * Rows of an origin with no handler are left untouched.
   */
  function routeByOrigin(id: string, patch: Partial<Lead>, marketingBody: Record<string, unknown>, intake?: () => void) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') patchOpportunity(id, patch, marketingBody, 'potentials');
    else if (lead?.origin === 'opportunity') patchOpportunity(id, patch, marketingBody);
    else intake?.();
  }

  function onPriorityChange(id: string, priority: Lead['priority']) {
    routeByOrigin(id, { priority }, { priority }, () => updateField(id, { priority }, { priority }));
  }

  function onAssigneeChange(id: string, assignee_id: string) {
    const lead = leads.find(l => l.id === id);
    if (lead?.origin === 'potential') {
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { assigned_to: assignee_id || null }, 'potentials');
    } else if (lead?.origin === 'opportunity') {
      const field = lead.opportunity_status === 'new_opportunity' ? 'marketing_owner_id' : 'sales_owner_id';
      patchOpportunity(id, { assignee_id: assignee_id || null, assignee: marketingAssigneeName(assignee_id) || 'Unassigned' }, { [field]: assignee_id || null });
    } else {
      updateField(id, { assignee_id: assignee_id || null, assignee: assigneeName(assignee_id) || 'Unassigned' }, { assignee_id });
    }
  }

  function onStatusChange(id: string, status: OpportunityStatus) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    if (lead.origin === 'opportunity') {
      if (status === lead.opportunity_status) return;
      const nextStage = STATUS_TO_STAGE[status];
      if (!nextStage) { toast.error(`"${STATUS_META[status].label}" isn't available for Marketing-origin deals yet`); return; }
      // Asked in the status popup; confirmStatusMove saves it with the reason.
      setStatusReason('');
      setStatusMove({ id, name: lead.name, status, stage: nextStage });
      return;
    }

    if (lead.origin === 'potential') {
      if (status === 'potential' || status === 'in_target_list') {
        patchOpportunity(id, { opportunity_status: status }, { external_stage_label: STATUS_META[status].label }, 'potentials');
        return;
      }
      toast.error('Potentials convert to Opportunities automatically once a document or link is attached.');
      return;
    }

    const prevStatus = lead.opportunity_status;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: status } : l)));
    fetch(`/api/leads/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity_status: status }),
    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
      toast.error('Could not save status');
      if (prevStatus) setLeads(prev => prev.map(l => (l.id === id ? { ...l, opportunity_status: prevStatus } : l)));
    });
  }

  // Called from the status popup; throwing keeps it open until a reason is typed.
  function confirmStatusMove() {
    if (!statusMove) return;
    if (!statusReason.trim()) { toast.error('Add a reason for the status change'); throw new Error('reason required'); }
    patchOpportunity(statusMove.id, { opportunity_status: statusMove.status }, { stage: statusMove.stage, admin_correction_reason: statusReason.trim() });
  }

  const onIndustryChange = (id: string, industry: string) =>
    routeByOrigin(id, { industry }, { industry_raw: industry || null }, () => updateField(id, { industry }, { industry: industry || null }));
  const onToDoChange = (id: string, to_do: string) => routeByOrigin(id, { to_do }, { to_do_raw: to_do || null });
  const onRequestChange = (id: string, request: string) => routeByOrigin(id, { request }, { request_raw: request || null });
  const onProjectTypeRawChange = (id: string, project_type: string) => routeByOrigin(id, { project_type }, { project_type_raw: project_type || null });
  const onSourceRawChange = (id: string, source: string) => routeByOrigin(id, { source }, { source_raw_label: source || null });
  const onPaymentChange = (id: string, payment_raw: string) => routeByOrigin(id, {}, { payment_raw: payment_raw || null });
  const onDealSizeChange = (id: string, deal_size: number | null) =>
    routeByOrigin(id, { deal_size }, { estimated_value: deal_size }, () => updateField(id, { deal_size }, { deal_size }));
  const onDepositChange = (id: string, deposit: number | null) => routeByOrigin(id, { deposit }, { deposit });
  const onTargetedChange = (id: string, targeted: boolean) => routeByOrigin(id, { targeted }, { targeted });

  async function archiveLead(lead: Lead, archived: boolean) {
    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, archived } : l)));
    const res = await fetch('/api/leads/' + lead.id + '/archive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not archive'); router.refresh(); }
    else feedback.info(archived ? 'Lead archived' : 'Lead unarchived', {
      description: lead.name,
      action: { label: 'Undo', onClick: () => void archiveLead(lead, !archived) },
    });
  }

  async function trashLead(lead: Lead) {
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    const res = await fetch('/api/leads/' + lead.id + '/trash', { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not move to trash'); router.refresh(); return; }
    feedback.info('Lead moved to Trash', {
      description: `${lead.name} can be restored for 30 days.`,
      action: { label: 'Undo move', onClick: () => void restoreLead(lead) },
    });
  }

  async function restoreLead(lead: Lead) {
    const res = await fetch('/api/leads/' + lead.id + '/restore', { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) {
      feedback.error('Could not restore', {
        description: `${lead.name} is still in Trash.`,
        action: { label: 'Try again', onClick: () => void restoreLead(lead) },
      });
      return;
    }
    setLeads(prev => (prev.some(l => l.id === lead.id) ? prev : [lead, ...prev]));
    feedback.success('Lead restored', { description: lead.name });
  }

  return {
    leads,
    /** Spread straight onto LeadsTable. */
    tableHandlers: {
      onStatusChange, onPriorityChange, onIndustryChange, onToDoChange, onRequestChange, onProjectTypeRawChange,
      onSourceRawChange, onTargetedChange, onPaymentChange, onDealSizeChange, onDepositChange, onAssigneeChange,
    },
    onStatusChange,
    statusMove, setStatusMove, statusReason, setStatusReason, confirmStatusMove,
    archiveLead, trashLead,
  };
}
