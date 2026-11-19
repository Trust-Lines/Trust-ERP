export interface FolderItem { name: string; path: string }

export const WIZARD_ROOT = '/D-Projects/T LINES/1-Store Maker';

export const REGIONS = [
  'T Lines CVW Projects',
  'T Lines NE Projects',
  'T Lines NW Projects',
  'T Lines SE Projects',
];

export const STATUSES = ['Under Working', 'Done'];

export const CLIENT_TYPES = [
  { label: 'Clients', value: 'Clients' },
  { label: 'Individuals', value: 'Individuals' },
];

export const PRODUCTION_TYPES = ['Millwork', 'Ceiling', 'Shelving', 'Image', '0-Missing-Extra'];

/** Sub-folder of a project that holds the production-type folders. */
export const PRODUCTION_DIR = '3-Production & Delivery';

/** Number of wizard steps before the "saved" screen. */
export const TOTAL_STEPS = 7;

export async function listFolders(path: string): Promise<FolderItem[]> {
  const r = await fetch(`/api/dropbox/list-folders?path=${encodeURIComponent(path)}`);
  const j = await r.json() as { folders?: FolderItem[]; error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Failed to list folders');
  return j.folders ?? [];
}

export async function createSingleFolder(path: string): Promise<void> {
  const r = await fetch('/api/dropbox/create-single-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) {
    const j = await r.json() as { error?: string };
    throw new Error(j.error ?? 'Failed to create folder');
  }
}

export async function createProjectStructure(projectFolderPath: string): Promise<void> {
  const r = await fetch('/api/dropbox/create-project-structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectFolderPath }),
  });
  if (!r.ok) {
    const j = await r.json() as { error?: string };
    throw new Error(j.error ?? 'Failed to create structure');
  }
}

export async function savePath(targetPath: string): Promise<string> {
  const r = await fetch('/api/dropbox/save-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPath }),
  });
  const j = await r.json() as { uploadedTo?: string; error?: string };
  if (!r.ok) throw new Error(j.error ?? 'Failed to save path');
  return j.uploadedTo ?? targetPath;
}
