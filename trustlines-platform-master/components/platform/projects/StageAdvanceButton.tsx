'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { STAGE_LABELS, getNextStage } from '@/lib/workflow/machine';
import type { ProjectStage } from '@/types/database';

interface StageAdvanceButtonProps {
  projectId: string;
  currentStage: ProjectStage;
  canAdvance: boolean;
  guardReason?: string;
  userRole: string;
  currentUserId: string;
}

export function StageAdvanceButton({
  projectId, currentStage, canAdvance, guardReason, userRole, currentUserId,
}: StageAdvanceButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const canSeeButton = ['ops_manager', 'general_manager', 'trustlines_pm'].includes(userRole);
  if (!canSeeButton) return null;

  const nextStage = getNextStage(currentStage);
  if (!nextStage) return null;

  async function handleAdvance() {
    setAdvancing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any;

      const { error: updateErr } = await sb
        .from('projects')
        .update({ current_stage: nextStage })
        .eq('id', projectId);
      if (updateErr) throw new Error(updateErr.message);

      await sb.from('stage_transitions').insert({
        project_id:      projectId,
        from_stage:      currentStage,
        to_stage:        nextStage,
        transitioned_by: currentUserId,
        is_override:     false,
      });

      await sb.from('audit_log').insert({
        actor_id:   currentUserId,
        project_id: projectId,
        action:     'stage.advanced',
        resource:   `projects:${projectId}`,
        new_value:  { from_stage: currentStage, to_stage: nextStage },
      });

      toast.success(`Advanced to ${nextStage ? STAGE_LABELS[nextStage] : 'next stage'}`);
      setShowModal(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to advance stage');
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => canAdvance ? setShowModal(true) : undefined}
        disabled={!canAdvance}
        title={!canAdvance ? guardReason : `Advance to ${STAGE_LABELS[nextStage]}`}
        style={{ position: 'relative' }}
      >
        <ArrowRight size={13} />
        Advance stage
        {!canAdvance && (
          <AlertTriangle size={11} style={{ color: 'var(--status-warning)', marginLeft: 2 }} />
        )}
      </button>

      {!canAdvance && guardReason && (
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', maxWidth: 200, display: 'inline-block' }}>
          {guardReason}
        </span>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span style={{ fontWeight: 600, fontSize: 15 }}>Advance stage</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--fg-default)', margin: '0 0 12px' }}>
                You are about to advance this project from:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{STAGE_LABELS[currentStage]}</span>
                <ArrowRight size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-teal)' }}>{STAGE_LABELS[nextStage]}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '10px 0 0' }}>
                This action will be logged in the audit trail.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={advancing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdvance} disabled={advancing}>
                {advancing ? 'Advancing…' : `Advance to ${STAGE_LABELS[nextStage]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
