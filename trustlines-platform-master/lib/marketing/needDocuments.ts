
import { getDropboxClient } from '@/lib/dropbox/client';
import { scopeToCategories } from '@/lib/sales/scope';
import { dropboxRegionFolder, composeProjectCode } from '@/lib/regions';
import { runClassificationForNeed } from './opportunityEngine';
import { buildNeedFilesPath } from './needFiles';
import type { ScopeType } from '@/types/database';

function buildMarketingEvidencePath(region: string, code: string, address: string): string {
  return `/Marketing/${dropboxRegionFolder(region)}/${code} - ${address}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export class NeedDocumentError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const NEED_PROJECT_COLS = 'id, prospect_id, location_id, title, scope_types, region, service_line, state, project_id';

function composeAddress(city?: string | null, street?: string | null, state?: string | null): string {
  return [city, street, state].map(s => (s ?? '').trim()).filter(Boolean).join(' - ');
}

export async function ensureProjectForNeed(admin: any, needId: string, actorId: string): Promise<Record<string, unknown> | null> {
  const { data: need } = await admin.from('prospect_needs').select(NEED_PROJECT_COLS).eq('id', needId).maybeSingle();
  if (!need) throw new NeedDocumentError('Need not found', 404);
  if (need.project_id) {
    const { data: existing } = await admin.from('projects').select('*').eq('id', need.project_id).maybeSingle();
    return existing ?? null;
  }
  if (!need.region || !need.service_line || !need.state) {
    throw new NeedDocumentError('Set Region, Service Line, and State on this Need before adding a document', 409);
  }

  let city: string | null = null;
  if (need.location_id) {
    const { data: loc } = await admin.from('prospect_locations').select('city').eq('id', need.location_id).maybeSingle();
    city = loc?.city ?? null;
  }
  if (!city) throw new NeedDocumentError('This Need has no linked Location with a City set — add one before adding a document', 409);

  const { data: reserved, error: rErr } = await admin.rpc('reserve_global_number');
  if (rErr) throw new NeedDocumentError(rErr.message, 500);
  const reservedNumber = reserved as number;

  const code = composeProjectCode(need.service_line, need.region, reservedNumber);
  const addr = composeAddress(city, null, need.state);
  const dropboxRootPath = buildMarketingEvidencePath(need.region, code, addr);

  const scopeFlags = Object.fromEntries(((need.scope_types ?? []) as ScopeType[]).map(t => [t, true]));
  const categories = scopeToCategories(scopeFlags);

  const { data: project, error: pErr } = await admin.from('projects').insert({
    code, name: `${code} - ${addr}`,
    region: need.region, service_line: need.service_line, site_location: addr, categories,
    is_draft: false, current_stage: 'closed_deal', current_phase: 'finalization',
    dropbox_root_path: dropboxRootPath, created_by: actorId,
    is_archived: false, hard_deadline: false,
  }).select('*').single();
  if (pErr || !project) throw new NeedDocumentError(pErr?.message ?? 'Failed to create project', 500);

  await admin.from('prospect_needs').update({ project_id: project.id }).eq('id', needId);
  return project;
}

export interface AddNeedDocumentInput {
  category: 'layout' | 'photo' | 'matterport' | 'link';
  file?: { name: string; buffer: Buffer };
  url?: string;
}

export async function addNeedDocument(admin: any, needId: string, actorId: string, input: AddNeedDocumentInput) {
  const { data: need } = await admin.from('prospect_needs').select(NEED_PROJECT_COLS).eq('id', needId).maybeSingle();
  if (!need) throw new NeedDocumentError('Need not found', 404);

  const isFile = input.category === 'layout' || input.category === 'photo';
  if (isFile && !input.file) throw new NeedDocumentError('No file provided');
  if (!isFile && !input.url?.trim()) throw new NeedDocumentError('No URL provided');

  const docRow: Record<string, unknown> = { need_id: needId, category: input.category, uploaded_by: actorId };

  if (isFile) {
    // Prefer the real numbered project folder when one already exists or all the fields to
    // create it are in place; otherwise fall back to the same always-available staging
    // folder Potentials/Opportunities already use for file uploads (see
    // lib/marketing/needFiles.ts) — a file needs *somewhere* real to live, but that
    // shouldn't require the Need to be fully filled out first.
    let rootPath: string | undefined;
    if (need.project_id) {
      const { data: existingProject } = await admin.from('projects').select('dropbox_root_path').eq('id', need.project_id).maybeSingle();
      rootPath = existingProject?.dropbox_root_path;
    } else if (need.region && need.service_line && need.state) {
      try {
        const created = await ensureProjectForNeed(admin, needId, actorId);
        rootPath = (created as { dropbox_root_path?: string } | null)?.dropbox_root_path;
      } catch {
        // Fall through to the staging path below (e.g. the linked Location has no City yet).
      }
    }
    if (!rootPath) rootPath = buildNeedFilesPath(need.region, need.title, needId);

    const safeName = (input.file!.name || 'upload')
      .replace(/[/\\]/g, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').trim() || 'upload';
    const path = `${rootPath}/00-Intake/${input.category}/${safeName}`;
    let dropboxPath: string;
    try {
      const res = await getDropboxClient().filesUpload({
        path, contents: input.file!.buffer, mode: { '.tag': 'add' }, autorename: true,
      });
      dropboxPath = res.result.path_lower ?? path;
    } catch (e) {
      throw new NeedDocumentError(e instanceof Error ? e.message : 'Dropbox upload failed', 502);
    }
    docRow.dropbox_path = dropboxPath;
    docRow.file_name = safeName;
  } else {
    docRow.url = input.url!.trim();
  }

  const { data: doc, error } = await admin.from('prospect_need_documents').insert(docRow)
    .select('id, category, dropbox_path, file_name, url, created_at').single();
  if (error) throw new NeedDocumentError(error.message, 500);

  const sync = await runClassificationForNeed(admin, needId, actorId);

  // The document itself, and the Opportunity/Potential classification above, are already
  // committed at this point. Reserving a real project number + Dropbox folder is a nice-to-
  // have on top of that (e.g. the Need is missing Region/Service Line/State/a City'd
  // Location) — it must never turn an otherwise-successful "add document" into an error
  // response, or the document/Opportunity silently exist while the user is told it failed.
  let project: Record<string, unknown> | null = null;
  let projectError: string | null = null;
  if (sync.needClassification === 'opportunity') {
    try {
      project = need.project_id
        ? (await admin.from('projects').select('*').eq('id', need.project_id).maybeSingle()).data
        : await ensureProjectForNeed(admin, needId, actorId);
      if (project && sync.opportunity && !sync.opportunity.project_id) {
        await admin.from('opportunities').update({ project_id: project.id, region: need.region }).eq('id', sync.opportunity.id);
        sync.opportunity = { ...sync.opportunity, project_id: project.id, region: need.region };
      }
    } catch (e) {
      projectError = e instanceof NeedDocumentError ? e.message : (e instanceof Error ? e.message : 'Failed to create project folder');
    }
  }

  return { document: doc, sync, project, projectError };
}
