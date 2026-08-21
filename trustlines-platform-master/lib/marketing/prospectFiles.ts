import { dropboxRegionFolder } from '@/lib/regions';

export function buildProspectFilesPath(region: string | null, displayName: string, prospectId: string): string {
  const regionFolder = dropboxRegionFolder(region) || 'Unassigned';
  const safeName = (displayName || 'Prospect').replace(/[/\\]/g, '_').trim();
  return `/Marketing/${regionFolder}/_Prospects/${safeName} - ${prospectId.slice(0, 8)}`;
}

export function sanitizeFileName(name: string): string {
  return (name || 'upload')
    .replace(/[/\\]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim() || 'upload';
}
