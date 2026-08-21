
/* eslint-disable @typescript-eslint/no-explicit-any */

import { logAudit } from '@/lib/audit/log';
import { ensureDesignDropboxFolder } from '@/lib/sales/design';

export async function ensureDesignJobForOpportunity(
  admin: any, opportunityId: string, actorId: string,
): Promise<{ created: boolean; jobId: string | null }> {
  try {
    const existing = await admin.from('sales_design_jobs')
      .select('id').eq('opportunity_id', opportunityId).is('deleted_at', null).maybeSingle();
    if (existing.error) {
      console.error('[design] ensureDesignJobForOpportunity: sales_design_jobs unavailable —',
        existing.error.message, '· run migration 079_phase00_design_opportunity_bridge.sql');
      return { created: false, jobId: null };
    }
    if (existing.data) return { created: false, jobId: existing.data.id };

    const { data: opp } = await admin.from('opportunities')
      .select('id, title, prospect_id, project_id, stage').eq('id', opportunityId).maybeSingle();
    if (!opp) return { created: false, jobId: null };

    const { data: job, error } = await admin.from('sales_design_jobs').insert({
      opportunity_id: opportunityId,
      title:          `Sales Design — ${opp.title}`,
      status:         'awaiting_assignment',
      priority:       'normal',
      created_by:     actorId,
    }).select('id').single();

    if (error) {
      if (error.code !== '23505') {
        console.error('[design] ensureDesignJobForOpportunity: insert failed —', error.message);
      }
      return { created: false, jobId: null };
    }

    if (opp.stage === 'sales_accepted') {
      await admin.from('opportunities').update({ stage: 'discovery' }).eq('id', opportunityId);
    }

    await logAudit({ actorId, action: 'design_job.auto_created', resource: `sales_design_job:${job.id}`, newValue: { opportunity: opportunityId } });
    await ensureDesignDropboxFolder(admin, opp.project_id ?? null);

    return { created: true, jobId: job.id };
  } catch (e) {
    console.error('[design] ensureDesignJobForOpportunity failed:', e instanceof Error ? e.message : e);
    return { created: false, jobId: null };
  }
}

export async function syncOpportunityStageFromDesignJob(
  admin: any, job: { opportunity_id: string | null }, fromStage: string, toStage: string,
): Promise<void> {
  if (!job.opportunity_id) return;
  await admin.from('opportunities').update({ stage: toStage })
    .eq('id', job.opportunity_id).eq('stage', fromStage);
}
