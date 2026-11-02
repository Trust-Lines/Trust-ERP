// Open the Trust System's live projects as real projects here — the ones on the TLines dashboard.
//
//   npx tsx scripts/trust-open-projects.mts            dry run: writes nothing, prints the plan
//   npx tsx scripts/trust-open-projects.mts --write    creates the projects + their Dropbox folders
//   --only=490,13P                                     limit to these Trust numbers
//
// Per Trust project (status ≠ DONE, not deleted):
//   code      the number it already has — prefix from its ClickUp opportunity ("STNE490" → "STNE 490"),
//             else store maker + its region. The global counter is NOT used (these numbers exist).
//   customer  via the matched opportunity's prospect (created like Sales Accept does, if missing)
//   Dropbox client folder = the BRAND: key client name (correct spelling) → ClickUp brand → Trust name
//   stage     from the dashboard rules (lib/trust/board.ts): Finalization → finalization,
//             Technical → client_approval, To Production / In Production / Shipped → production
//   Dropbox   createProjectFolders — same path as every other project
// Idempotent: a project whose code already exists (not deleted) is skipped. The Trust System is
// only read.

import { readFileSync, existsSync } from 'fs';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0 && !l.trim().startsWith('#')) { const k = l.slice(0, i).trim(); if (!process.env[k]) process.env[k] = l.slice(i + 1).trim(); }
  }
}
loadEnvLocal();

const WRITE = process.argv.includes('--write');
const ONLY = (process.argv.find(a => a.startsWith('--only='))?.slice(7) ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const ACTOR_EMAIL = process.env.TRUST_IMPORT_ACTOR_EMAIL ?? 'hamzag@trust-lines.com';

const { createClient } = await import('@supabase/supabase-js');
const { loadTrustProjects, classifyTrustProject, typeLabel } = await import('../lib/trust/board');
const { REGIONS, SERVICE_LINES, composeProjectCode, dropboxRegionFolder, dropboxSectionForServiceLine } = await import('../lib/regions');
const { PROD_TYPES } = await import('../lib/dropbox/paths');
const { buildDropboxProjectPath } = await import('../lib/dropbox/paths');
const { buildMatcher } = await import('../lib/keyClients/match');
const { loadKeyClients } = await import('../lib/keyClients/server');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const STAGE: Record<string, { stage: string; phase: string }> = {
  finalization:  { stage: 'finalization',    phase: 'finalization' },
  technical:     { stage: 'client_approval', phase: 'construction_documents' },
  to_production: { stage: 'production',      phase: 'production' },
  in_production: { stage: 'production',      phase: 'production' },
  shipped:       { stage: 'production',      phase: 'production' },
};
const SL_BY_SHORT = Object.fromEntries(SERVICE_LINES.map(s => [s.codeShort, s.value]));
const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** "STNE490" → { sl: 'ST', rest: '490' } */
const splitCode = (code: string) => {
  const m = key(code).match(/^(ST|PS|DS)(NE|SE|NW|W)(.+)$/);
  return m ? { sl: m[1], rest: m[3] } : { sl: null, rest: key(code) };
};

const { data: actor } = await admin.from('profiles').select('id').ilike('email', ACTOR_EMAIL).maybeSingle();
if (!actor) throw new Error(`No profile for ${ACTOR_EMAIL}`);

const { projects: trust, error } = await loadTrustProjects();
if (error) throw new Error(`Trust: ${error}`);
const today = new Date().toISOString().slice(0, 10);

// Opportunities with a project code, by the part after the prefix.
const matcher = buildMatcher((await loadKeyClients(admin)).clients);
const opps: { id: string; external_project_code: string; prospect_id: string; project_id: string | null; title: string; brand: string | null }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await admin.from('opportunities').select('id, external_project_code, prospect_id, project_id, title, brand')
    .not('external_project_code', 'is', null).is('deleted_at', null).range(from, from + 999);
  if (e) throw new Error(e.message);
  opps.push(...data); if (data.length < 1000) break;
}
const oppByNo = new Map<string, typeof opps>();
for (const o of opps) { const k = splitCode(o.external_project_code).rest; oppByNo.set(k, [...(oppByNo.get(k) ?? []), o]); }

const { data: existingRows } = await admin.from('projects').select('code').is('deleted_at', null);
const existingCodes = new Set((existingRows ?? []).map((r: { code: string }) => key(r.code)));

const plan: Record<string, unknown>[] = [];
for (const p of trust) {
  const no = key(p.projectNo);
  if (ONLY.length && !ONLY.includes(no)) continue;
  const region = REGIONS.find(r => r.code === p.bucket);
  if (!region) { plan.push({ no: p.projectNo, skip: `unknown region ${p.bucket}` }); continue; }

  const matches = oppByNo.get(no) ?? [];
  const opp = matches.length === 1 ? matches[0] : null;
  const sl = (opp && splitCode(opp.external_project_code).sl) || 'ST';
  const serviceLine = SL_BY_SHORT[sl] ?? 'store_maker';
  const code = `${composeProjectCode(serviceLine, region.code, null)} ${p.projectNo.replace(/\s+/g, ' ').trim()}`;
  if (existingCodes.has(key(code))) { plan.push({ no: p.projectNo, code, skip: 'already a project' }); continue; }

  const e = classifyTrustProject(p, today);
  const { stage, phase } = STAGE[e.stage];
  // Brand, spelled the way our key client list spells it when it is one of them.
  const tidy = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();
  // Trust's name is the brand unless it is really an address ("Gloversville, 110 Decker Drive,NY").
  const trustBrand = /,|\d/.test(p.name) ? '' : tidy(p.name);
  const brand = matcher.byName(opp?.brand, p.name)?.name ?? (trustBrand || tidy(opp?.brand) || tidy(p.name));
  const clientName = brand.replace(/[/\\:*?"<>|]/g, '-');
  // A "/" in an address would split the Dropbox folder in two.
  const address = ((p.address ?? '').trim() || p.name).replace(/\s*\/\s*/g, ' - ');
  const categories = [...new Set((p.items ?? []).map(i => typeLabel(i.type)).concat((p.types ?? []).map(typeLabel))
    .filter((t): t is string => !!t && (PROD_TYPES as readonly string[]).includes(t)))];
  const dropboxParams = {
    dropboxSection: dropboxSectionForServiceLine(serviceLine),
    dropboxRegion: dropboxRegionFolder(region.code),
    dropboxStatus: 'Under Working',
    dropboxClientType: 'Clients',
    dropboxClientName: clientName,
    projectNo: code,
    address,
  };
  const { projectFolderPath } = buildDropboxProjectPath(dropboxParams);
  plan.push({
    no: p.projectNo, trustId: p.id, code, name: `${code} - ${address}`, region: region.code, serviceLine,
    boardStage: e.stage, stage, phase, categories, client: clientName,
    opportunity: opp ? `${opp.external_project_code}${opp.project_id ? ' (already linked to a project)' : ''}` : matches.length > 1 ? `${matches.length} matches — not linked` : null,
    dropbox: projectFolderPath, _opp: opp, _params: dropboxParams,
  });
}

const todo = plan.filter(r => !r.skip);
for (const r of plan) {
  if (r.skip) { console.log(`SKIP  #${r.no}  ${r.code ?? ''}  — ${r.skip}`); continue; }
  console.log(`${WRITE ? 'OPEN' : 'PLAN'}  #${String(r.no).padEnd(11)} ${String(r.code).padEnd(15)} ${String(r.stage).padEnd(16)} ${String(r.client).slice(0, 34).padEnd(34)} opp: ${r.opportunity ?? '—'}`);
  console.log(`      ${r.dropbox}   [${(r.categories as string[]).join(', ')}]`);
}
console.log(`\n${todo.length} to open, ${plan.length - todo.length} skipped${WRITE ? '' : ' — dry run, nothing written (add --write)'}`);

if (WRITE) {
  const { createProjectFolders } = await import('../lib/dropbox/upload');
  const { resolveOrCreateCustomerForProspect } = await import('../lib/marketing/salesHandoff');
  const { logAudit } = await import('../lib/audit/log');
  for (const r of todo) {
    const opp = r._opp as (typeof opps)[number] | null;
    const customerId = opp ? (await resolveOrCreateCustomerForProspect(admin, opp.prospect_id, actor.id)).customerId : null;
    const { data: project, error: pErr } = await admin.from('projects').insert({
      code: r.code, name: r.name, region: r.region, service_line: r.serviceLine,
      site_location: (r._params as { address: string }).address, categories: r.categories,
      is_draft: false, current_stage: r.stage, current_phase: r.phase,
      dropbox_root_path: r.dropbox, created_by: actor.id, is_archived: false, hard_deadline: false,
      customer_id: customerId,
    }).select('id').single();
    if (pErr || !project) { console.error(`FAIL  #${r.no}: ${pErr?.message}`); continue; }
    try { await createProjectFolders(r._params as never, r.categories as string[]); }
    catch (e) { console.error(`      dropbox pending for #${r.no}:`, e instanceof Error ? e.message : e); }
    if (opp && !opp.project_id) {
      await admin.from('opportunities').update({ project_id: project.id, ...(customerId ? { customer_id: customerId } : {}) }).eq('id', opp.id).is('project_id', null);
    }
    await logAudit({ actorId: actor.id, action: 'project.opened_from_trust', projectId: project.id, resource: `trust:${r.trustId}`, newValue: { code: r.code, stage: r.stage } });
    console.log(`DONE  #${r.no} → ${r.code}`);
  }
}
