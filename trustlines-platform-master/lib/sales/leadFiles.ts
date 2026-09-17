import { dropboxRegionFolder } from '@/lib/regions';

// Mirrors lib/marketing/prospectFiles.ts's _Prospects/_Opportunities staging pattern — lets
// Sales intake accept files before Block 1 (Region+Client+Service+Address) is complete and a
// real numbered project folder exists. Once a real project is created, new uploads go there
// instead (see intake/upload/route.ts) — files already staged here are NOT moved, matching
// how Marketing's own staging folders already behave.
export function buildLeadFilesPath(region: string | null, customerName: string | null, leadId: string): string {
  const regionFolder = dropboxRegionFolder(region) || 'Unassigned';
  const safeName = (customerName || 'Lead').replace(/[/\\]/g, '_').trim();
  return `/Sales/${regionFolder}/_Intake/${safeName} - ${leadId.slice(0, 8)}`;
}
