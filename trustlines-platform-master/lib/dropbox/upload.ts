
import { getDropboxClient } from './client';
import {
  getDropboxPath,
  buildDropboxProjectPath,
  PROJECT_STRUCTURE_V2,
  PROD_TYPES,
  getProdV0Paths,
  getProdVSubfolders,
  PLAN_LAYOUT_V_SUBFOLDERS,
  DESIGN_PROPOSAL_V_SUBFOLDERS,
  CONSTRUCTION_DRAWINGS_V_SUBFOLDERS,
  DESIGN_PROJECT_STRUCTURE,
  designRootFromProjectRoot,
} from './paths';
import type { DropboxProjectParams, DocPathOptions, ProdType } from './paths';

const CATEGORY_TO_FOLDER: Record<string, string> = Object.fromEntries(
  PROD_TYPES.flatMap(t => [[t.toLowerCase(), t], [t, t]]),
);

export async function uploadToDropbox(p: {
  projectRootPath: string;
  docType: string;
  fileName: string;
  fileBuffer: Buffer;
  version: number;
  prodType?: ProdType;
  innerVersion?: number;
}): Promise<{
  dropboxPath: string;
  dropboxFileId: string;
  dropboxRev: string;
}> {
  const opts: DocPathOptions = {
    version:      p.version,
    prodType:     p.prodType,
    innerVersion: p.innerVersion,
  };
  const path = getDropboxPath(p.projectRootPath, p.docType, p.fileName, opts);

  const res = await getDropboxClient().filesUpload({
    path,
    contents:   p.fileBuffer,
    mode:       { '.tag': 'add' },
    autorename: true,
  });
  return {
    dropboxPath:   res.result.path_lower!,
    dropboxFileId: res.result.id,
    dropboxRev:    res.result.rev,
  };
}

export async function uploadRevisionToDropbox(p: {
  existingPath: string;
  fileBuffer: Buffer;
  existingRev?: string | null;
}): Promise<{ dropboxPath: string; dropboxRev: string; serverModified: string }> {
  const dbx = getDropboxClient();

  let rev = p.existingRev ?? null;
  if (!rev) {
    try {
      const meta = await dbx.filesGetMetadata({ path: p.existingPath });
      if (meta.result['.tag'] === 'file') rev = (meta.result as { rev: string }).rev;
    } catch { }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadOpts: any = {
    path:     p.existingPath,
    contents: p.fileBuffer,
    mode:     rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' },
    autorename: !rev,
  };
  const res = await dbx.filesUpload(uploadOpts);
  return {
    dropboxPath:    res.result.path_lower!,
    dropboxRev:     res.result.rev,
    serverModified: res.result.server_modified,
  };
}

export async function getDropboxTemporaryLink(path: string): Promise<string> {
  const res = await getDropboxClient().filesGetTemporaryLink({ path });
  return res.result.link;
}

async function ensureFolderPath(path: string): Promise<void> {
  const dbx      = getDropboxClient();
  const segments = path.split('/').filter(Boolean);
  let current    = '';
  for (const seg of segments) {
    current += '/' + seg;
    await dbx.filesCreateFolderV2({ path: current, autorename: false })
      .catch((e: { status?: number }) => {
        if (e?.status !== 409) throw e;
      });
  }
}

async function batchMkdir(paths: string[]): Promise<void> {
  const res = await getDropboxClient().filesCreateFolderBatch({ paths, autorename: false });
  if (res.result['.tag'] === 'async_job_id') {
    const jobId = (res.result as { async_job_id: string }).async_job_id;
    let done = false;
    while (!done) {
      await new Promise(r => setTimeout(r, 500));
      const check = await getDropboxClient().filesCreateFolderBatchCheck({ async_job_id: jobId });
      done = check.result['.tag'] !== 'in_progress';
    }
  }
}

export async function ensureVersionFolder(
  projectRootPath: string,
  docType: string,
  version: number,
  prodType?: ProdType,
): Promise<void> {
  const pt = prodType ?? 'Millwork';

  if (docType === 'plan_layout') {
    const vRoot = `${projectRootPath}/1-Finalization/5-Plan Layout/V${version}`;
    await batchMkdir([vRoot, ...PLAN_LAYOUT_V_SUBFOLDERS.map(s => `${vRoot}/${s}`)]);
    return;
  }

  if (docType === 'proposal') {
    const vRoot = `${projectRootPath}/1-Finalization/6-Design Proposal/V${version}`;
    await batchMkdir([vRoot, ...DESIGN_PROPOSAL_V_SUBFOLDERS.map(s => `${vRoot}/${s}`)]);
    return;
  }

  if (docType === 'construction_drawings' || docType === 'shop_drawing') {
    const vRoot = `${projectRootPath}/2-Construction Document/3-Construction Drawings/V${version}`;
    await batchMkdir([vRoot, ...CONSTRUCTION_DRAWINGS_V_SUBFOLDERS.map(s => `${vRoot}/${s}`)]);
    return;
  }

  const vRoot = `${projectRootPath}/3-Production & Delivery/${pt}/V${version}`;
  await batchMkdir([vRoot, ...getProdVSubfolders(pt).map(s => `${vRoot}/${s}`)]);
}

export async function findExistingProjectByNumber(
  parentPath: string,
  projectNo: string,
): Promise<string | null> {
  const dbx    = getDropboxClient();
  const prefix = projectNo.trim().toLowerCase();

  let res: Awaited<ReturnType<typeof dbx.filesListFolder>>;
  try {
    res = await dbx.filesListFolder({ path: parentPath, recursive: false });
  } catch {
    return null;
  }
  for (;;) {
    for (const entry of res.result.entries) {
      if (entry['.tag'] !== 'folder') continue;
      const name = entry.name.trim().toLowerCase();
      if (name.startsWith(`${prefix} -`) || name.startsWith(`${prefix}-`)) {
        return entry.path_lower ?? (entry as { path_display?: string }).path_display ?? null;
      }
    }
    if (!res.result.has_more) break;
    res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
  }
  return null;
}

export async function createProjectFolders(
  params: DropboxProjectParams,
  categories: string[] = [],
): Promise<{
  rootPath:        string;
  subFolders:      string[];
  alreadyExists:   boolean;
  conflictFolder?: string;
}> {
  const { parentPath, projectFolderPath } = buildDropboxProjectPath(params);

  try {
    await getDropboxClient().filesGetMetadata({ path: projectFolderPath });
    return { rootPath: projectFolderPath, subFolders: [], alreadyExists: true };
  } catch { }

  await ensureFolderPath(parentPath);
  const existing = await findExistingProjectByNumber(parentPath, params.projectNo);
  if (existing) {
    return { rootPath: existing, subFolders: [], alreadyExists: true, conflictFolder: existing };
  }

  await ensureFolderPath(parentPath);

  const baseSubs = PROJECT_STRUCTURE_V2.map(sub => `${projectFolderPath}/${sub}`);

  const selectedTypes = [...new Set(
    categories.map(c => CATEGORY_TO_FOLDER[c]).filter(Boolean)
  )];

  const typeSubs = selectedTypes.flatMap(t => [
    `${projectFolderPath}/3-Production & Delivery/${t}`,
    ...getProdV0Paths(t).map(rel => `${projectFolderPath}/${rel}`),
  ]);

  const allPaths = [projectFolderPath, ...baseSubs, ...typeSubs];
  await batchMkdir(allPaths);

  return { rootPath: projectFolderPath, subFolders: [...baseSubs, ...typeSubs], alreadyExists: false };
}

export async function createDesignFolders(
  projectRootPath: string,
): Promise<{ designRoot: string | null; alreadyExists: boolean; created: boolean }> {
  const designRoot = designRootFromProjectRoot(projectRootPath);
  if (!designRoot) return { designRoot: null, alreadyExists: false, created: false };

  try {
    await getDropboxClient().filesGetMetadata({ path: designRoot });
    return { designRoot, alreadyExists: true, created: false };
  } catch { }

  const parent = designRoot.split('/').slice(0, -1).join('/');
  await ensureFolderPath(parent);
  const paths = [designRoot, ...DESIGN_PROJECT_STRUCTURE.map(s => `${designRoot}/${s}`)];
  await batchMkdir(paths);

  return { designRoot, alreadyExists: false, created: true };
}

export async function createTypeFolders(
  projectRootPath: string,
  categories: string[],
): Promise<{ createdTypes: string[] }> {
  const types = [...new Set(categories.map(c => CATEGORY_TO_FOLDER[c]).filter(Boolean))];
  if (types.length === 0) return { createdTypes: [] };

  const paths = types.flatMap(t => [
    `${projectRootPath}/3-Production & Delivery/${t}`,
    ...getProdV0Paths(t).map(rel => `${projectRootPath}/${rel}`),
  ]);
  await batchMkdir(paths);
  return { createdTypes: types };
}
