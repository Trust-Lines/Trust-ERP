// Server side of the TLines dashboard's "Clients Opportunity" list: the open deals (Opportunities and
// Potentials) of our key clients (key_clients, migration 134), grouped by region like the
// PROJECTS PROGRESS sheet.
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { buildMatcher, projectNumber, type KeyClientDef, type KeyClientLink } from './match';
export { KEY_CLIENT_ADMIN_ROLES, TLINES_DASHBOARD_ROLES } from './roles';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Region columns of the sheet, in its order. */
export const DASHBOARD_REGIONS = ['TLINES_SE', 'TLINES_NE', 'TLINES_NW', 'CVW'] as const;
/** Opportunity stages that are no longer an opportunity (won → Finalization and on; lost → off). */
const CLOSED_STAGES = ['closed_won', 'closed_lost'];
/** Potentials that are done (converted ones show as their Opportunity). */
const CLOSED_POTENTIAL_STATUSES = ['converted', 'lost', 'cancelled'];
/**
 * ClickUp "WAITING" deals are parked — 14 of the 15 a key client had on 2026-10-30 were not on the
 * sheet. They stay off unless someone includes that deal by hand (key_client_links).
 */
const PARKED_LABEL = 'WAITING';

export interface ClientOpportunityRow {
  kind: 'opportunity' | 'potential';
  id: string;                  // opportunity or potential id
  prospectId: string;
  keyClientId: string;
  client: string;              // key client name ("Teddy")
  brand: string | null;        // as written on the deal ("Teddy's")
  projectNo: string | null;    // "507"
  projectCode: string | null;  // "STSE507"
  site: string;                // title: "Chamblee, 2706 Shallowford Rd,GA"
  region: string | null;
  stage: string;               // opportunity stage / potential status
  stageLabel: string | null;   // ClickUp's Status OP ("WORKING ON IT TRUST", "In Target List")
  toDo: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  deadline: string | null;
  projectTypes: string[];
  projectTypeRaw: string | null;
  request: string | null;
  priority: string | null;
  createdAt: string;           // ClickUp's created date when it came from ClickUp
  matchedBy: 'name' | 'link';
}

export interface KeyClientsData {
  clients: (KeyClientDef & { notes: string | null; is_active: boolean })[];
  links: (KeyClientLink & { id: string; note?: string | null })[];
}

/** Key clients + manual links. Throws a recognizable error when migration 134 is missing. */
export async function loadKeyClients(admin: any, opts: { includeInactive?: boolean } = {}): Promise<KeyClientsData> {
  let q = admin.from('key_clients').select('id, name, aliases, notes, is_active').is('deleted_at', null).order('name');
  if (!opts.includeInactive) q = q.eq('is_active', true);
  const [{ data: clients, error }, { data: links, error: lErr }] = await Promise.all([
    q, admin.from('key_client_links').select('id, key_client_id, opportunity_id, potential_id, prospect_id, mode, note'),
  ]);
  if (error || lErr) throw Object.assign(new Error((error ?? lErr).message), { code: (error ?? lErr).code });
  return { clients: (clients ?? []).map((c: any) => ({ ...c, aliases: c.aliases ?? [] })), links: links ?? [] };
}

/** All rows of a filtered select, paged (a single select stops at 1000 rows). */
async function readAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>, label: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const OPP_COLS = 'id, prospect_id, title, brand, stage, region, external_project_code, external_stage_label, to_do_raw, next_action, next_action_date, deadline, project_types, project_type_raw, request_raw, priority, external_created_at, created_at';
const POT_COLS = 'id, prospect_id, title, brand, status, region, external_project_code, external_stage_label, to_do_raw, target_contact_date, due_date, project_type_raw, request_raw, priority, external_created_at, created_at';

/** Every open deal of a key client, grouped by region (sheet order). */
export async function loadClientOpportunities(admin: any): Promise<{
  regions: Record<string, ClientOpportunityRow[]>;
  clients: { id: string; name: string; count: number }[];
  total: number;
}> {
  const { clients, links } = await loadKeyClients(admin);

  const [opps, pots] = await Promise.all([
    readAll((f, t) => admin.from('opportunities').select(OPP_COLS)
      .is('deleted_at', null).not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
      .order('created_at', { ascending: false }).range(f, t), 'opportunities'),
    readAll((f, t) => admin.from('prospect_potentials').select(POT_COLS)
      .is('deleted_at', null).is('converted_opportunity_id', null).not('status', 'in', `(${CLOSED_POTENTIAL_STATUSES.join(',')})`)
      .order('created_at', { ascending: false }).range(f, t), 'potentials'),
  ]);

  const prospectIds = [...new Set([...opps, ...pots].map(o => o.prospect_id))];
  const prospects = await fetchInChunks(prospectIds, chunk =>
    admin.from('prospects').select('id, organization_name, brand_name, display_name').in('id', chunk));
  const namesOf = new Map((prospects as any[]).map(p => [p.id, [p.brand_name, p.organization_name, p.display_name]]));

  const matcher = buildMatcher(clients, links);
  const linked = new Set(links.filter(l => l.mode === 'include').flatMap(l => [l.opportunity_id, l.potential_id, l.prospect_id]).filter(Boolean));
  const regions: Record<string, ClientOpportunityRow[]> = Object.fromEntries(DASHBOARD_REGIONS.map(r => [r, []]));
  const perClient = new Map<string, number>();

  const add = (o: any, kind: ClientOpportunityRow['kind']) => {
    const client = matcher.forOpportunity(o, namesOf.get(o.prospect_id) ?? []);
    if (!client) return;
    if (String(o.external_stage_label ?? '').trim().toUpperCase() === PARKED_LABEL && !matcher.includedItem(o.id)) return;
    const isOpp = kind === 'opportunity';
    const row: ClientOpportunityRow = {
      kind, id: o.id, prospectId: o.prospect_id, keyClientId: client.id, client: client.name,
      brand: o.brand ?? null, projectNo: projectNumber(o.external_project_code), projectCode: o.external_project_code ?? null,
      site: o.title, region: o.region ?? null, stage: isOpp ? o.stage : o.status, stageLabel: o.external_stage_label ?? null,
      toDo: o.to_do_raw ?? null, nextAction: isOpp ? o.next_action ?? null : null,
      nextActionDate: isOpp ? o.next_action_date ?? null : o.target_contact_date ?? null,
      deadline: isOpp ? o.deadline ?? null : o.due_date ?? null,
      projectTypes: o.project_types ?? [], projectTypeRaw: o.project_type_raw ?? null,
      request: o.request_raw ?? null, priority: o.priority ?? null,
      createdAt: o.external_created_at ?? o.created_at,
      matchedBy: linked.has(o.id) || linked.has(o.prospect_id) ? 'link' : 'name',
    };
    (regions[o.region ?? ''] ??= []).push(row);
    perClient.set(client.id, (perClient.get(client.id) ?? 0) + 1);
  };
  for (const o of opps) add(o, 'opportunity');
  for (const p of pots) add(p, 'potential');

  // Inside a region: by client, then project number — the way the sheet lists them.
  for (const list of Object.values(regions)) {
    list.sort((a, b) => a.client.localeCompare(b.client) || (Number(a.projectNo) || 0) - (Number(b.projectNo) || 0));
  }
  return {
    regions,
    clients: clients.map(c => ({ id: c.id, name: c.name, count: perClient.get(c.id) ?? 0 })),
    total: [...perClient.values()].reduce((a, b) => a + b, 0),
  };
}

/** Postgres "relation does not exist" — migration 134 not applied yet. */
export function keyClientsMissing(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return !!err && (err.code === '42P01' || /key_client|does not exist|schema cache/i.test(err.message ?? ''));
}
export const KEY_CLIENTS_NOT_READY = 'Key clients are not set up yet — run migration 134_key_clients.sql.';
