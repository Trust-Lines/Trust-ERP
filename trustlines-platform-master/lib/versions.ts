
import { ensureVersionFolder } from '@/lib/dropbox/upload';
import { PROD_TYPES, type ProdType } from '@/lib/dropbox/paths';
import { logAudit } from '@/lib/audit/log';

export const BUNDLE_DOC_TYPES = new Set([
  'item_plan', 'item_list', 'price_list', 'boq', 'book', 'po_bo',
]);

export interface VersionSetRow {
  id:                    string;
  project_id:            string;
  scope:                 string;
  version_number:        number;
  status:                'draft' | 'signed' | 'completed' | 'rejected';
  opened_reason:         'initial' | 'client_pm_rejection';
  dropbox_folder_path:   string | null;
  dropbox_rev:           string | null;
  dropbox_modified_at:   string | null;
  signed_by_trust_pm_at: string | null;
  client_pm_decided_at:  string | null;
  client_pm_decision:    'approved' | 'rejected' | null;
}

export function versionScope(docType: string, catGroup: string | null): string | null {
  if (docType === 'construction_drawings' || docType === 'shop_drawing') return 'construction_drawing';
  if (catGroup && BUNDLE_DOC_TYPES.has(docType)) return catGroup.toLowerCase();
  return null;
}

function prodTypeForScope(scope: string): ProdType | undefined {
  const cap = scope.charAt(0).toUpperCase() + scope.slice(1);
  return (PROD_TYPES as readonly string[]).includes(cap) ? (cap as ProdType) : undefined;
}

function folderDocType(scope: string): string {
  return scope === 'construction_drawing' ? 'construction_drawings' : 'item_plan';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrCreateOpenVersionSet(admin: any, projectId: string, scope: string): Promise<VersionSetRow> {
  const { data: latest } = await admin
    .from('document_versions')
    .select('*')
    .eq('project_id', projectId)
    .eq('scope', scope)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: VersionSetRow | null };

  if (latest && latest.status !== 'rejected') return latest;

  const nextNumber = latest ? latest.version_number + 1 : 0;
  const { data: created, error } = await admin
    .from('document_versions')
    .insert({
      project_id:    projectId,
      scope,
      version_number: nextNumber,
      status:        'draft',
      opened_reason: latest ? 'client_pm_rejection' : 'initial',
    })
    .select('*')
    .single() as { data: VersionSetRow | null; error: unknown };

  if (error || !created) throw new Error(`Failed to create version set for ${scope}: ${JSON.stringify(error)}`);
  return created;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markVersionSetSigned(admin: any, setId: string): Promise<void> {
  await admin.from('document_versions')
    .update({ status: 'signed', signed_by_trust_pm_at: new Date().toISOString() })
    .eq('id', setId)
    .eq('status', 'draft');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markVersionSetCompleted(admin: any, setId: string): Promise<void> {
  await admin.from('document_versions')
    .update({ status: 'completed', client_pm_decided_at: new Date().toISOString(), client_pm_decision: 'approved' })
    .eq('id', setId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markVersionSetDraft(admin: any, setId: string): Promise<void> {
  await admin.from('document_versions')
    .update({ status: 'draft', signed_by_trust_pm_at: null })
    .eq('id', setId)
    .neq('status', 'completed');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rejectVersionSetAndOpenNext(admin: any, params: {
  projectId:        string;
  scope:            string;
  currentSetId:     string;
  dropboxRootPath:  string | null;
  actorId:          string;
}): Promise<VersionSetRow> {
  const { projectId, scope, currentSetId, dropboxRootPath, actorId } = params;
  const now = new Date().toISOString();

  const { data: current } = await admin
    .from('document_versions').select('*').eq('id', currentSetId).single() as { data: VersionSetRow | null };
  if (!current) throw new Error('Version set not found');

  await admin.from('document_versions')
    .update({ status: 'rejected', client_pm_decided_at: now, client_pm_decision: 'rejected' })
    .eq('id', currentSetId);

  const nextNumber = current.version_number + 1;

  let dropboxFolderPath: string | null = null;
  if (dropboxRootPath) {
    try {
      await ensureVersionFolder(dropboxRootPath, folderDocType(scope), nextNumber, prodTypeForScope(scope));
      dropboxFolderPath = scope === 'construction_drawing'
        ? `${dropboxRootPath}/2-Construction Document/3-Construction Drawings/V${nextNumber}`
        : `${dropboxRootPath}/3-Production & Delivery/${prodTypeForScope(scope) ?? scope}/V${nextNumber}`;
      await logAudit({ actorId, action: 'version.folder_created', projectId, resource: `${scope} V${nextNumber}`, newValue: { path: dropboxFolderPath } });
    } catch (e) {
      console.error('[versions] V-folder creation failed:', e);
    }
  }

  const { data: next, error } = await admin
    .from('document_versions')
    .insert({
      project_id:          projectId,
      scope,
      version_number:      nextNumber,
      status:              'draft',
      opened_reason:       'client_pm_rejection',
      dropbox_folder_path: dropboxFolderPath,
    })
    .select('*')
    .single() as { data: VersionSetRow | null; error: unknown };

  if (error || !next) throw new Error(`Failed to open V${nextNumber} for ${scope}: ${JSON.stringify(error)}`);

  await logAudit({
    actorId, action: 'version.opened', projectId,
    resource: `${scope} V${nextNumber}`,
    newValue: { reason: 'client_pm_rejection', previousVersion: current.version_number },
  });

  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attachDocumentToVersionSet(admin: any, params: {
  documentId: string;
  projectId:  string;
  docType:    string;
  catGroup:   string | null;
}): Promise<VersionSetRow | null> {
  const scope = versionScope(params.docType, params.catGroup);
  if (!scope) return null;
  const set = await getOrCreateOpenVersionSet(admin, params.projectId, scope);
  await admin.from('documents').update({ version_set_id: set.id }).eq('id', params.documentId);
  return set;
}
