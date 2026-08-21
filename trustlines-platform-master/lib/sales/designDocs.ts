
import { logAudit } from '@/lib/audit/log';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DesignFile { dropbox_path: string; file_name: string }
export interface ExistingDoc { dropbox_path: string }

export function filesToLink(designFiles: DesignFile[], existing: ExistingDoc[]): DesignFile[] {
  const have = new Set(existing.map(d => d.dropbox_path));
  const out: DesignFile[] = [];
  const seen = new Set<string>();
  for (const f of designFiles) {
    if (!f.dropbox_path || have.has(f.dropbox_path) || seen.has(f.dropbox_path)) continue;
    seen.add(f.dropbox_path);
    out.push(f);
  }
  return out;
}

export async function linkDesignFilesToProject(
  admin: any, versionId: string, projectId: string, actorId: string | null,
): Promise<number> {
  try {
    const { data: files } = await admin.from('sales_design_version_files')
      .select('dropbox_path, file_name').eq('version_id', versionId).limit(200) as {
        data: DesignFile[] | null;
      };
    if (!files?.length) return 0;

    const { data: existing } = await admin.from('documents')
      .select('dropbox_path').eq('project_id', projectId).eq('doc_type', 'sales_design').limit(500) as {
        data: ExistingDoc[] | null;
      };

    const pending = filesToLink(files, existing ?? []);
    if (!pending.length) return 0;

    const rows = pending.map((f, i) => ({
      project_id: projectId,
      doc_type:   'sales_design',
      version:    i + 1,
      status:     'approved',
      dropbox_path: f.dropbox_path,
      file_name:  f.file_name,
      uploaded_by: actorId,
    }));
    const { error } = await admin.from('documents').insert(rows);
    if (error) { console.error('[designDocs] pointer insert failed:', error.message); return 0; }

    await logAudit({
      actorId, action: 'sales_design.files_linked', projectId,
      resource: `version:${versionId}`, newValue: { count: rows.length },
    });
    return rows.length;
  } catch (e) {
    console.error('[designDocs] link failed:', e instanceof Error ? e.message : e);
    return 0;
  }
}
