import { projectNumber } from '@/lib/keyClients/match';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { classifyTrustProject, loadTrustProjects, type TrustProject } from '@/lib/trust/board';
import type { Installation } from './compute';
import { milestonesFrom, undatedStage, type MilestoneItem, type ProjectMilestones, type UndatedStage } from './lifecycle';

export interface GanttStageData {
  /** "480" → the project id carrying that number, to open it from a row. */
  projectByNo: Record<string, string>;
  /** Real stage dates per project number (production milestones, opportunity opened, deal closed). */
  milestonesByNo: Record<string, ProjectMilestones>;
  /** Stages with no stored dates (sales stage / Trust board) — shown only as the row's status. */
  undatedByNo: Record<string, UndatedStage>;
}

type ProjectRef = { id: string; code: string | null; closed_deal_date?: string | null };

/** "#480 STG 1" → the project whose code carries 480 (first one wins). */
export function projectIdByNumber(projects: Pick<ProjectRef, 'id' | 'code'>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of projects) {
    const no = projectNumber(p.code);
    if (no && !out[no]) out[no] = p.id;
  }
  return out;
}

/**
 * Stage dates for the lifecycle Gantt (Figma 784:18261), shared by /tlines-pm/installation and
 * the /dashboard Gantt view. Read-only and bounded by the plan's rows; dates only (no PF codes,
 * vendors or money). Missing data just draws fewer stages — never throws.
 * `trust` lets a caller that already read the Trust System pass its projects in.
 */
export async function loadGanttStageData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  rows: Pick<Installation, 'project_no'>[],
  projects: ProjectRef[],
  today: string,
  trust?: TrustProject[],
): Promise<GanttStageData> {
  const projectByNo = projectIdByNumber(projects);
  const closedById = new Map(projects.map(p => [p.id, p.closed_deal_date ?? null]));

  const milestonesByNo: Record<string, ProjectMilestones> = {};
  const undatedByNo: Record<string, UndatedStage> = {};
  const planNos = [...new Set(rows.map(r => projectNumber(r.project_no)).filter((n): n is string => !!n))];
  const planIds = [...new Set(planNos.map(n => projectByNo[n]).filter(Boolean))];
  const oppStageById = new Map<string, string>();
  if (planIds.length) {
    try {
      const [items, opps] = await Promise.all([
        fetchInChunks(planIds, chunk => admin.from('production_items')
          .select('project_id, std, rtr, rtd, rdy, ftd, snd, container_date')
          .eq('source', 'project').is('deleted_at', null).in('project_id', chunk)),
        fetchInChunks(planIds, chunk => admin.from('opportunities')
          .select('project_id, created_at, stage').is('deleted_at', null).in('project_id', chunk)),
      ]) as [(MilestoneItem & { project_id: string })[], { project_id: string; created_at: string; stage: string | null }[]];
      // Grouped once in memory — no per-project scans.
      const itemsById = new Map<string, MilestoneItem[]>();
      for (const i of items) { const l = itemsById.get(i.project_id); if (l) l.push(i); else itemsById.set(i.project_id, [i]); }
      const oppDatesById = new Map<string, string[]>();
      for (const o of [...opps].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        if (o.stage) oppStageById.set(o.project_id, o.stage); // the newest opportunity wins
        const l = oppDatesById.get(o.project_id); if (l) l.push(o.created_at); else oppDatesById.set(o.project_id, [o.created_at]);
      }
      for (const no of planNos) {
        const id = projectByNo[no];
        if (!id) continue;
        milestonesByNo[no] = milestonesFrom(itemsById.get(id) ?? [], oppDatesById.get(id) ?? [], closedById.get(id) ?? null);
      }
    } catch (e) {
      console.error('[installation] stage dates unavailable:', e instanceof Error ? e.message : e);
    }
  }

  // Trust System board stage (Finalization / Technical / To Production). When Trust can't be read
  // the rows just fall back to the opportunity stage.
  const trustStageByNo = new Map<string, string>();
  if (planNos.length) {
    const list = trust ?? (await loadTrustProjects()).projects;
    const wanted = new Set(planNos);
    for (const p of list) {
      const no = projectNumber(p.projectNo);
      if (no && wanted.has(no)) trustStageByNo.set(no, classifyTrustProject(p, today).stage);
    }
  }
  for (const no of planNos) {
    const id = projectByNo[no];
    const u = undatedStage(trustStageByNo.get(no), id ? oppStageById.get(id) : null);
    if (u) undatedByNo[no] = u;
  }

  return { projectByNo, milestonesByNo, undatedByNo };
}
