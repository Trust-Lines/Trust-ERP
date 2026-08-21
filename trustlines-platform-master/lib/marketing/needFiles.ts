import { dropboxRegionFolder } from '@/lib/regions';

export function buildNeedFilesPath(region: string | null, title: string, needId: string): string {
  const regionFolder = dropboxRegionFolder(region) || 'Unassigned';
  const safeName = (title || 'Opportunity').replace(/[/\\]/g, '_').trim();
  return `/Marketing/${regionFolder}/_Opportunities/${safeName} - ${needId.slice(0, 8)}`;
}
