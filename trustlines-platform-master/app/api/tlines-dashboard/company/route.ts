import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { projectNumber } from '@/lib/keyClients/match';
import { SERVICE_LINES, SERVICE_LINE_VALUES, serviceLineFromCode, serviceLineFromIndustry } from '@/lib/regions';

export const dynamic = 'force-dynamic';

// Dashboard card popup → "Company": which of our companies (Store Maker / Premium Store Fitout /
// Design Build) a card belongs to.
//   PUT { kind: 'opportunity'|'potential'|'project'|'trust', id, no, serviceLine }
// Stored where the board reads it: a deal card → the deal's Industry (industry_raw); a project /
// Trust / installation card → our project(s) with that number (service_line), else the deals with
// that number. Set once, only while the card has no company: General / Ops managers on
// any card, a T-Lines PM on their own. Changing an existing company is done on the project. Audit-logged.
const MANAGERS = ['general_manager', 'ops_manager'];
const UUID = /^[0-9a-f-]{36}$/i;

type Deal = { id: string; industry_raw: string | null; external_project_code: string | null };
type Project = { id: string; code: string; service_line: string | null; tlines_pm_id: string | null };
const dealCompany = (d: Deal) => serviceLineFromIndustry(d.industry_raw) ?? serviceLineFromCode(d.external_project_code);
const projectCompany = (p: Project) => (p.service_line && SERVICE_LINE_VALUES.includes(p.service_line) ? p.service_line : serviceLineFromCode(p.code));

export async function PUT(req: Request) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth as NextResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (prof as { role?: string } | null)?.role ?? '';
  const manager = MANAGERS.includes(role);
  if (!manager && role !== 'tlines_pm') return NextResponse.json({ error: 'You can’t set a card’s company' }, { status: 403 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const kind = String(body?.kind ?? '');
  const id = typeof body?.id === 'string' ? body.id.trim().slice(0, 64) : '';
  const no = projectNumber(typeof body?.no === 'string' ? body.no : null);
  const value = String(body?.serviceLine ?? '');
  const label = SERVICE_LINES.find(s => s.value === value)?.label;
  if (!label || !id || !['opportunity', 'potential', 'project', 'trust'].includes(kind)) {
    return NextResponse.json({ error: 'Missing card or company' }, { status: 400 });
  }

  // Everything that carries this card's company.
  const dealTable = kind === 'potential' ? 'prospect_potentials' : 'opportunities';
  let deals: (Deal & { table: string })[] = [];
  let projects: Project[] = [];
  if (kind === 'opportunity' || kind === 'potential') {
    if (!UUID.test(id)) return NextResponse.json({ error: 'Missing card' }, { status: 400 });
    const { data } = await admin.from(dealTable).select('id, industry_raw, external_project_code').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    deals = [{ ...(data as Deal), table: dealTable }];
  } else if (kind === 'project') {
    if (!UUID.test(id)) return NextResponse.json({ error: 'Missing card' }, { status: 400 });
    const { data } = await admin.from('projects').select('id, code, service_line, tlines_pm_id').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    projects = [data as Project];
  } else {
    if (!no) return NextResponse.json({ error: 'This card has no project number to save the company on' }, { status: 400 });
    const { data: ps } = await admin.from('projects').select('id, code, service_line, tlines_pm_id').ilike('code', `%${no}%`).is('deleted_at', null).limit(20);
    projects = ((ps ?? []) as Project[]).filter(p => projectNumber(p.code) === no);
    if (!projects.length) {
      const [o, p] = await Promise.all([
        admin.from('opportunities').select('id, industry_raw, external_project_code').ilike('external_project_code', `%${no}%`).is('deleted_at', null).limit(20),
        admin.from('prospect_potentials').select('id, industry_raw, external_project_code').ilike('external_project_code', `%${no}%`).is('deleted_at', null).limit(20),
      ]);
      deals = [
        ...((o.data ?? []) as Deal[]).filter(d => projectNumber(d.external_project_code) === no).map(d => ({ ...d, table: 'opportunities' })),
        ...((p.data ?? []) as Deal[]).filter(d => projectNumber(d.external_project_code) === no).map(d => ({ ...d, table: 'prospect_potentials' })),
      ];
    }
    if (!projects.length && !deals.length) return NextResponse.json({ error: `Nothing in the app carries #${no} yet to save the company on` }, { status: 404 });
  }

  const current = [...projects.map(projectCompany), ...deals.map(dealCompany)].find(Boolean) ?? null;
  // Set once from the dashboard: an existing company is changed on the project itself.
  if (current) return NextResponse.json({ error: 'This card already has a company — change it on the project' }, { status: 409 });
  if (!manager) {
    // A T-Lines PM: only their own card.
    const ownProject = projects.some(p => p.tlines_pm_id === user.id);
    let own = ownProject;
    if (!own) {
      const { data: a } = await admin.from('board_assignees').select('item_id').eq('item_id', id).eq('user_id', user.id).like('stage', '%:tlines_pm').limit(1);
      own = (a ?? []).length > 0;
    }
    if (!own) return NextResponse.json({ error: 'Only the card’s T-Lines PM can set its company' }, { status: 403 });
  }

  for (const p of projects) {
    const { error } = await admin.from('projects').update({ service_line: value }).eq('id', p.id);
    if (error) return NextResponse.json({ error: 'Could not save the company' }, { status: 500 });
  }
  for (const d of deals) {
    const { error } = await admin.from(d.table).update({ industry_raw: label }).eq('id', d.id);
    if (error) return NextResponse.json({ error: 'Could not save the company' }, { status: 500 });
  }
  await logAudit({
    actorId: user.id, action: 'dashboard.card_company', resource: `${kind}:${id}`,
    oldValue: { company: current }, newValue: { company: value, no, projects: projects.map(p => p.id), deals: deals.map(d => d.id) },
  });
  return NextResponse.json({ ok: true, company: value });
}
