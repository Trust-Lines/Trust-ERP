import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { projectNumber } from '@/lib/keyClients/match';
import { PROJECT_FINANCE_READ_ROLES, loadProjectFinance } from '@/lib/finance/projectTotals';
import type { CardDeal, CardProject } from '@/lib/dashboard/cardTabs';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// TLines dashboard → a card's popup: everything we hold for its project number (read-only).
//   GET ?no=490&kind=trust|opportunity|potential|project&id=<card id>
// → { project, deals, finance }: our project with that number (or the card's own), the
// Potentials / Opportunities with that number or linked to it, and its finance totals for the
// roles that may see them (else null). The Trust System's types come with the card itself.
export async function GET(req: Request) {
  const { role, admin, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  const q = new URL(req.url).searchParams;
  const no = /^\d{2,10}$/.test(q.get('no') ?? '') ? q.get('no')! : null;
  const kind = q.get('kind') ?? '';
  const id = UUID.test(q.get('id') ?? '') ? q.get('id')! : null;

  const sameNo = (code: string | null) => !!no && projectNumber(code) === no;

  // Our project: the card's own, else the one whose code carries the number ("STNE 490").
  const PROJECT_COLS = 'id, code, name, current_stage, site_location, closed_deal_date, est_delivery_date';
  type ProjectRow = { id: string; code: string; name: string; current_stage: string; site_location: string | null; closed_deal_date: string | null; est_delivery_date: string | null };
  let projectRow: ProjectRow | null = null;
  if (kind === 'project' && id) {
    ({ data: projectRow } = await admin.from('projects').select(PROJECT_COLS).eq('id', id).is('deleted_at', null).maybeSingle());
  } else if (no) {
    const { data } = await admin.from('projects').select(PROJECT_COLS).ilike('code', `%${no}%`).is('deleted_at', null).limit(20);
    projectRow = ((data ?? []) as ProjectRow[]).find(p => sameNo(p.code)) ?? null;
  }
  const project: CardProject | null = projectRow && {
    id: projectRow.id, code: projectRow.code, name: projectRow.name, currentStage: projectRow.current_stage,
    site: projectRow.site_location, closedDealDate: projectRow.closed_deal_date, estDeliveryDate: projectRow.est_delivery_date,
  };

  // Deals: same number, linked to the project, or the card itself.
  const oppOr = [no && `external_project_code.ilike.%${no}%`, project && `project_id.eq.${project.id}`, kind === 'opportunity' && id && `id.eq.${id}`].filter(Boolean).join(',');
  const potOr = [no && `external_project_code.ilike.%${no}%`, kind === 'potential' && id && `id.eq.${id}`].filter(Boolean).join(',');
  type OppRow = { id: string; title: string | null; brand: string | null; stage: string | null; external_project_code: string | null; external_stage_label: string | null; project_id: string | null; sales_owner_id: string | null; marketing_owner_id: string | null; next_action: string | null; next_action_date: string | null; deadline: string | null; external_created_at: string | null; created_at: string };
  type PotRow = { id: string; title: string | null; brand: string | null; status: string | null; external_project_code: string | null; external_stage_label: string | null; assigned_to: string | null; to_do_raw: string | null; target_contact_date: string | null; due_date: string | null; external_created_at: string | null; created_at: string };
  const [oppRes, potRes] = await Promise.all([
    oppOr ? admin.from('opportunities').select('id, title, brand, stage, external_project_code, external_stage_label, project_id, sales_owner_id, marketing_owner_id, next_action, next_action_date, deadline, external_created_at, created_at').or(oppOr).is('deleted_at', null).limit(20) : { data: [] },
    potOr ? admin.from('prospect_potentials').select('id, title, brand, status, external_project_code, external_stage_label, assigned_to, to_do_raw, target_contact_date, due_date, external_created_at, created_at').or(potOr).is('deleted_at', null).limit(20) : { data: [] },
  ]);
  const opps = ((oppRes.data ?? []) as OppRow[]).filter(o => o.id === id || (!!project && o.project_id === project.id) || sameNo(o.external_project_code));
  const pots = ((potRes.data ?? []) as PotRow[]).filter(p => p.id === id || sameNo(p.external_project_code));

  const ownerIds = [...new Set([...opps.map(o => o.sales_owner_id ?? o.marketing_owner_id), ...pots.map(p => p.assigned_to)].filter((v): v is string => !!v))];
  const { data: owners } = ownerIds.length ? await admin.from('profiles').select('id, full_name').in('id', ownerIds) : { data: [] };
  const ownerName = new Map(((owners ?? []) as { id: string; full_name: string | null }[]).map(o => [o.id, o.full_name]));

  const deals: CardDeal[] = [
    ...pots.map(p => ({
      id: p.id, kind: 'potential' as const, title: p.title, brand: p.brand, code: p.external_project_code, stage: p.status, stageLabel: p.external_stage_label,
      owner: p.assigned_to ? ownerName.get(p.assigned_to) ?? null : null, createdAt: p.external_created_at ?? p.created_at,
      nextAction: p.to_do_raw, nextActionDate: p.target_contact_date, dueDate: p.due_date,
    })),
    ...opps.map(o => {
      const ownerId = o.sales_owner_id ?? o.marketing_owner_id;
      return {
        id: o.id, kind: 'opportunity' as const, title: o.title, brand: o.brand, code: o.external_project_code, stage: o.stage, stageLabel: o.external_stage_label,
        owner: ownerId ? ownerName.get(ownerId) ?? null : null, createdAt: o.external_created_at ?? o.created_at,
        nextAction: o.next_action, nextActionDate: o.next_action_date, dueDate: o.deadline,
      };
    }),
  ];

  const canFinance = (PROJECT_FINANCE_READ_ROLES as readonly string[]).includes(role);
  const finance = project && canFinance ? await loadProjectFinance(admin, project.id) : null;

  return NextResponse.json({ project, deals, finance });
}
