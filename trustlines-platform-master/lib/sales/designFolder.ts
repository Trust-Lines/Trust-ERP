// A design job's Dropbox folder: where it is, and creating it when design work starts.
//
// Order: the path stored on the job (migration 132) → the Project's design folder
// (/D-Projects/... mirrored under /Design/...) → for a deal with no Project yet,
// /Design/Pre-Project/<job>. Once stored the path never changes: the app never moves or renames
// anything in Dropbox, so a folder Sales already shared keeps working.
import { designRootFromProjectRoot } from '@/lib/dropbox/paths';
import { preProjectDesignRoot } from './designPaths';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DesignFolderJob {
  id: string;
  title?: string | null;
  lead_intake_id: string | null;
  opportunity_id: string | null;
}

export type DesignFolder =
  | { ok: true; root: string; sharedUrl: string | null; created: boolean }
  | { ok: false; error: string; status: number };

/** The deal's Project id (lead intake or Opportunity), if Accept / delivery created one. */
export async function designJobProjectId(admin: any, job: DesignFolderJob): Promise<string | null> {
  if (job.lead_intake_id) {
    const { data } = await admin.from('lead_intake').select('project_id').eq('id', job.lead_intake_id).maybeSingle();
    return (data as { project_id?: string | null } | null)?.project_id ?? null;
  }
  if (job.opportunity_id) {
    const { data } = await admin.from('opportunities').select('project_id').eq('id', job.opportunity_id).maybeSingle();
    return (data as { project_id?: string | null } | null)?.project_id ?? null;
  }
  return null;
}

/** Stored folder + shared link; null values when migration 132 isn't applied yet. */
async function storedFolder(admin: any, jobId: string): Promise<{ path: string | null; sharedUrl: string | null; columns: boolean }> {
  const { data, error } = await admin.from('sales_design_jobs')
    .select('title, dropbox_folder_path, dropbox_shared_url').eq('id', jobId).maybeSingle();
  if (error) return { path: null, sharedUrl: null, columns: false };
  return { path: data?.dropbox_folder_path ?? null, sharedUrl: data?.dropbox_shared_url ?? null, columns: true };
}

/**
 * Where this job's design folder is. With `create`, makes sure it exists in Dropbox (creating the
 * standard design tree) and remembers the path on the job.
 */
export async function resolveDesignFolder(admin: any, job: DesignFolderJob, opts: { create?: boolean } = {}): Promise<DesignFolder> {
  const stored = await storedFolder(admin, job.id);

  let root = stored.path;
  if (!root) {
    const projectId = await designJobProjectId(admin, job);
    if (projectId) {
      const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).maybeSingle();
      const projectRoot = (proj as { dropbox_root_path?: string | null } | null)?.dropbox_root_path;
      root = projectRoot ? designRootFromProjectRoot(projectRoot) : null;
    }
  }
  if (!root) {
    if (!stored.columns) {
      return { ok: false, status: 409, error: 'This deal has no Project folder yet. Run migration 132 so design folders can be created before the Project.' };
    }
    let title = job.title ?? null;
    if (title == null) {
      const { data } = await admin.from('sales_design_jobs').select('title').eq('id', job.id).maybeSingle();
      title = data?.title ?? 'Design job';
    }
    root = preProjectDesignRoot(job.id, title ?? 'Design job');
  }

  if (!opts.create) return { ok: true, root, sharedUrl: stored.sharedUrl, created: false };

  let created = false;
  try {
    const { createDesignFoldersAt } = await import('@/lib/dropbox/upload');
    created = (await createDesignFoldersAt(root)).created;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Dropbox error';
    console.error('[design folder] create failed:', msg);
    return { ok: false, status: 502, error: `Could not create the Dropbox folder: ${msg}` };
  }
  if (stored.columns && stored.path !== root) {
    await admin.from('sales_design_jobs').update({ dropbox_folder_path: root }).eq('id', job.id);
  }
  return { ok: true, root, sharedUrl: stored.sharedUrl, created };
}

/**
 * A Dropbox shared link to the folder (re-uses an existing one), stored on the job so the CRM can
 * show it without calling Dropbox. Team-restricted links stay as Dropbox sets them.
 */
export async function ensureSharedLink(admin: any, jobId: string, root: string): Promise<string> {
  const { getDropboxClient } = await import('@/lib/dropbox/client');
  const dbx = getDropboxClient();
  let url: string | null = null;
  try {
    const existing = await dbx.sharingListSharedLinks({ path: root, direct_only: true });
    url = existing.result.links[0]?.url ?? null;
  } catch { /* none yet */ }
  if (!url) {
    try {
      const res = await dbx.sharingCreateSharedLinkWithSettings({ path: root });
      url = res.result.url;
    } catch (e: any) {
      // Created by someone else in the meantime → Dropbox returns it in the error.
      url = e?.error?.error?.shared_link_already_exists?.metadata?.url ?? null;
      if (!url) throw e;
    }
  }
  await admin.from('sales_design_jobs').update({ dropbox_shared_url: url }).eq('id', jobId);
  return url!;
}
