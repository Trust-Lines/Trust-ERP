// lib/sales/designVersionSync.ts — auto-detect design versions from the real Dropbox folder,
// instead of a designer typing a link/notes manually into "Add version".
//
// User decision (2026-08-28): a version is a "V1", "V2", "V3"... subfolder under
// "3-Design proposal/Design Proposal" — the SAME convention already used for every other
// versioned doc type (see app/api/dropbox/list-versions/route.ts, getVersionBaseFolder). A
// designer works entirely in Dropbox; opening/creating the folder is already automatic
// (ensureDesignDropboxFolder, called the moment the design job is created) — this closes the
// other half: pulling what's actually IN that folder back into sales_design_versions /
// sales_design_version_files, so nothing has to be re-typed here.
//
// Split into a pure planning function (computeDesignVersionSyncPlan — no Dropbox/DB, fully unit
// testable) and an impure wrapper that calls the real Dropbox API + writes the DB. This lets the
// actual sync LOGIC be proven correct without a live Dropbox connection (this dev environment has
// no DROPBOX_APP_KEY set) — only the thin listing call itself is unverified here, and it reuses
// the exact same getDropboxClient()/filesListFolder call the already-proven list-versions route
// makes.

export interface DropboxEntry {
  tag: 'file' | 'folder';
  name: string;
  path_display: string;
}

export interface ExistingVersion {
  id: string;
  version_no: number;
}

export interface VersionSyncPlan {
  newVersions: { versionNo: number; files: { path: string; name: string }[] }[];
  newFilesForExisting: { versionId: string; files: { path: string; name: string }[] }[];
}

const V_FOLDER = /^V(\d+)$/i;

/**
 * Pure: given a (possibly recursive) directory listing under ".../Design Proposal", the
 * versions already in the DB, and the file paths already tracked, work out exactly what needs
 * to be created. Never mutates anything — the caller applies the plan.
 */
export function computeDesignVersionSyncPlan(
  entries: DropboxEntry[],
  existingVersions: ExistingVersion[],
  existingFilePaths: Set<string>,
): VersionSyncPlan {
  const versionNoByFolder = new Map<string, number>(); // folder path (lowercased) -> version number
  for (const e of entries) {
    if (e.tag !== 'folder') continue;
    const m = e.name.match(V_FOLDER);
    if (m) versionNoByFolder.set(e.path_display.toLowerCase(), parseInt(m[1], 10));
  }

  const filesByVersionNo = new Map<number, { path: string; name: string }[]>();
  for (const e of entries) {
    if (e.tag !== 'file') continue;
    // A file belongs to whichever V-folder its path starts with (path_display is the file's own
    // full path — find the longest matching V-folder prefix, so nested subfolders under a
    // version still count).
    let bestFolder: string | null = null;
    for (const folderPath of versionNoByFolder.keys()) {
      if (e.path_display.toLowerCase().startsWith(`${folderPath}/`) && (!bestFolder || folderPath.length > bestFolder.length)) {
        bestFolder = folderPath;
      }
    }
    if (!bestFolder) continue;
    const no = versionNoByFolder.get(bestFolder)!;
    const list = filesByVersionNo.get(no) ?? [];
    list.push({ path: e.path_display, name: e.name });
    filesByVersionNo.set(no, list);
  }

  const existingByNo = new Map(existingVersions.map(v => [v.version_no, v]));
  const plan: VersionSyncPlan = { newVersions: [], newFilesForExisting: [] };

  for (const [versionNo, files] of filesByVersionNo) {
    const newFiles = files.filter(f => !existingFilePaths.has(f.path.toLowerCase()));
    if (newFiles.length === 0) continue;
    const existing = existingByNo.get(versionNo);
    if (existing) {
      plan.newFilesForExisting.push({ versionId: existing.id, files: newFiles });
    } else {
      plan.newVersions.push({ versionNo, files: newFiles });
    }
  }
  plan.newVersions.sort((a, b) => a.versionNo - b.versionNo);
  return plan;
}

export async function syncDesignVersionsFromDropbox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, jobId: string, designRoot: string, actorId: string,
): Promise<{ syncedVersions: number; syncedFiles: number; error?: string }> {
  const scanFolder = `${designRoot}/3-Design proposal/Design Proposal`;

  let entries: DropboxEntry[];
  try {
    const { getDropboxClient } = await import('@/lib/dropbox/client');
    const dbx = getDropboxClient();
    const result = await dbx.filesListFolder({ path: scanFolder, recursive: true, include_non_downloadable_files: false, include_deleted: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries = (result.result.entries ?? []).map((e: any) => ({ tag: e['.tag'], name: e.name, path_display: e.path_display }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('not_found') || msg.includes('path/not_found')) return { syncedVersions: 0, syncedFiles: 0 };
    return { syncedVersions: 0, syncedFiles: 0, error: msg };
  }

  const [{ data: existingVersions }, { data: existingFiles }] = await Promise.all([
    admin.from('sales_design_versions').select('id, version_no').eq('job_id', jobId),
    admin.from('sales_design_version_files').select('dropbox_path').eq('job_id', jobId),
  ]);
  const existingFilePaths = new Set(((existingFiles ?? []) as { dropbox_path: string }[]).map(f => f.dropbox_path.toLowerCase()));

  const plan = computeDesignVersionSyncPlan(
    entries.map(e => ({ ...e, path_display: e.path_display })),
    (existingVersions ?? []) as ExistingVersion[],
    new Set([...existingFilePaths]),
  );

  return applyDesignVersionSyncPlan(admin, jobId, plan, actorId);
}

// Split out from syncDesignVersionsFromDropbox so the DB-write side can be exercised directly
// (with a hand-built plan) without a live Dropbox connection — this dev environment has no
// DROPBOX_APP_KEY set, so this is the part that actually gets live-verified against real Supabase.
export async function applyDesignVersionSyncPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, jobId: string, plan: VersionSyncPlan, actorId: string,
): Promise<{ syncedVersions: number; syncedFiles: number }> {
  let syncedVersions = 0;
  let syncedFiles = 0;

  for (const nv of plan.newVersions) {
    const { data: version, error } = await admin.from('sales_design_versions').insert({
      job_id: jobId, version_no: nv.versionNo, status: 'draft', created_by: actorId,
      notes: 'Auto-synced from Dropbox',
    }).select('id').single();
    if (error || !version) continue;
    syncedVersions += 1;
    const rows = nv.files.map(f => ({ version_id: version.id, job_id: jobId, dropbox_path: f.path, file_name: f.name }));
    const { error: fErr, count } = await admin.from('sales_design_version_files').insert(rows, { count: 'exact' });
    if (!fErr) syncedFiles += count ?? rows.length;
  }

  for (const ex of plan.newFilesForExisting) {
    const rows = ex.files.map(f => ({ version_id: ex.versionId, job_id: jobId, dropbox_path: f.path, file_name: f.name }));
    const { error: fErr, count } = await admin.from('sales_design_version_files').insert(rows, { count: 'exact' });
    if (!fErr) syncedFiles += count ?? rows.length;
  }

  // A brand-new version arriving means work resumed — reflect that on the job status the same
  // way manually adding a version already did (POST .../versions: 'assigned' -> 'working_on_it').
  if (syncedVersions > 0) {
    await admin.from('sales_design_jobs').update({ status: 'working_on_it' }).eq('id', jobId).eq('status', 'assigned');
  }

  return { syncedVersions, syncedFiles };
}
