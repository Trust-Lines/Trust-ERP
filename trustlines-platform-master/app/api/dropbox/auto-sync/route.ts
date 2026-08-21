import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVersionBaseFolder, PROD_TYPES, PROD_TYPES_WITH_PROPOSAL } from '@/lib/dropbox/paths';
import type { ProdType } from '@/lib/dropbox/paths';

type ScanTarget = {
  docType:      string;
  basePath:     string;
  prodType:     ProdType | null;
  stepKey:      string;
  catGroup:     string | null;
  pdfSubfolder: string | null;
  pdfOnly:      boolean;
};

function buildTargets(projectRoot: string): ScanTarget[] {
  const targets: ScanTarget[] = [];

  const add = (
    docType: string, stepKey: string,
    prodType: ProdType | null = null,
    pdfSubfolder: string | null = null,
    pdfOnly = false,
    overrideBase: string | null = null,
  ) => {
    const base = overrideBase ?? getVersionBaseFolder(docType, prodType ?? undefined);
    if (!base) return;
    targets.push({
      docType,
      basePath: `${projectRoot}/${base}`,
      prodType,
      stepKey,
      catGroup: prodType ? prodType.toLowerCase() : null,
      pdfSubfolder,
      pdfOnly,
    });
  };

  add('plan_layout',           'plan_layout',           null, 'PDF',   true);
  add('proposal',              'design_proposal',        null, '1-PDF', true);
  add('construction_drawings', 'construction_drawings',  null, '2-PDF', true);

  for (const pt of PROD_TYPES) {
    const withProposal = (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(pt);
    const base = `3-Production & Delivery/${pt}`;

    if (withProposal) {
      add('proposal',  'proposal',  pt, '1-Proposal/PDF',              true, base);
      add('item_plan', 'item_plan', pt, '2-Item Plan/PDF',             true, base);
      add('item_list', 'item_list', pt, '3-Item List/PDF',             true, base);
      add('book',      'book',      pt, '4-Book/4-Final Submission/PDF', true, base);
      add('po_bo',     'po',        pt, '5-Purchase Order/PDF',         true, base);
      add('pf',        'pfs',       pt, '6-Production Form/For Trust',  true, base);
    } else {
      add('item_plan', 'item_plan', pt, '1-Item Plan/PDF',             true, base);
      add('item_list', 'item_list', pt, '2-Item List/PDF',             true, base);
      add('book',      'book',      pt, '3-Book/4-Final Submission/PDF', true, base);
      add('po_bo',     'po',        pt, '4-Purchase Order/PDF',         true, base);
      add('pf',        'pfs',       pt, '5-Production Form/For Trust',  true, base);
    }
  }

  return targets;
}

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'pdf' ? 'application/pdf'
    : ['jpg','jpeg'].includes(ext) ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'dwg' ? 'application/acad'
    : 'application/octet-stream';
}

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { projectId } = await request.json() as { projectId: string };
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const dbx   = getDropboxClient();

  const { data: proj } = await admin
    .from('projects').select('dropbox_root_path').eq('id', projectId).single();
  const dropboxRoot = (proj as { dropbox_root_path: string | null } | null)?.dropbox_root_path;
  if (!dropboxRoot) return NextResponse.json({ synced: 0 });

  const { data: existingDocs } = await admin
    .from('documents').select('dropbox_path').eq('project_id', projectId);
  const knownPaths = new Set<string>(
    ((existingDocs ?? []) as { dropbox_path: string }[])
      .map(d => d.dropbox_path.toLowerCase()),
  );

  const targets  = buildTargets(dropboxRoot);
  const toInsert: object[] = [];

  await Promise.allSettled(targets.map(async (t) => {
    try {
      let res   = await dbx.filesListFolder({ path: t.basePath, recursive: true, include_deleted: false });
      const all = [...(res.result.entries ?? [])];
      while (res.result.has_more) {
        res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
        all.push(...(res.result.entries ?? []));
      }

      const baseNorm = t.basePath.toLowerCase().replace(/\\/g, '/');

      for (const entry of all) {
        if (entry['.tag'] !== 'file') continue;
        const filePath = (entry.path_lower ?? '').replace(/\\/g, '/');
        if (knownPaths.has(filePath)) continue;

        const rest   = filePath.replace(baseNorm, '').replace(/^\//, '');
        const vMatch = rest.match(/^v(\d+)\//i);
        if (!vMatch) continue;

        if (t.pdfSubfolder) {
          const afterV = rest.replace(/^v\d+\//i, '');
          if (!afterV.toLowerCase().startsWith(t.pdfSubfolder.toLowerCase() + '/')) continue;
        }

        if (!entry.name.toLowerCase().endsWith('.pdf')) continue;

        const dropboxVersion = parseInt(vMatch[1], 10);
        knownPaths.add(filePath);

        toInsert.push({
          project_id:      projectId,
          doc_type:        t.docType,
          version:         1,
          status:          'draft',
          dropbox_path:    entry.path_display ?? filePath,
          dropbox_file_id: entry.id ?? null,
          dropbox_rev:     (entry as { rev?: string }).rev ?? null,
          file_name:       entry.name,
          file_size_bytes: (entry as { size?: number }).size ?? null,
          mime_type:       guessMime(entry.name),
          uploaded_by:     user.id,
          notes:           'Auto-synced from Dropbox',
          step_key:        t.stepKey,
          cat_group:       t.catGroup,
          dropbox_version: dropboxVersion,
          prod_type:       t.prodType,
        });
      }
    } catch { }
  }));

  if (toInsert.length === 0) return NextResponse.json({ synced: 0 });

  const versionCounters = new Map<string, number>();
  const { data: maxVersions } = await admin
    .from('documents').select('doc_type, version').eq('project_id', projectId)
    .order('version', { ascending: false });

  for (const row of (maxVersions ?? []) as { doc_type: string; version: number }[]) {
    if (!versionCounters.has(row.doc_type)) versionCounters.set(row.doc_type, row.version);
  }

  const finalRows = toInsert.map(r => {
    const row  = r as { doc_type: string };
    const next = (versionCounters.get(row.doc_type) ?? 0) + 1;
    versionCounters.set(row.doc_type, next);
    return { ...row, version: next };
  });

  let { error } = await admin.from('documents').insert(finalRows);

  const isSchemaMissing = (m?: string) => m && (m.includes('column') || m.includes('schema cache'));
  const isEnumError     = (m?: string) => m && m.includes('invalid input value for enum');

  if (isSchemaMissing(error?.message)) {
    const baseRows = finalRows.map((r: Record<string, unknown>) => ({
      project_id: r.project_id, doc_type: r.doc_type, version: r.version,
      status: r.status, dropbox_path: r.dropbox_path, dropbox_file_id: r.dropbox_file_id,
      dropbox_rev: r.dropbox_rev, file_name: r.file_name, file_size_bytes: r.file_size_bytes,
      mime_type: r.mime_type, uploaded_by: r.uploaded_by, notes: r.notes,
    }));
    ({ error } = await admin.from('documents').insert(baseRows));
  }

  if (isEnumError(error?.message)) {
    let synced = 0;
    for (const row of finalRows) {
      const { error: e } = await admin.from('documents').insert(row);
      if (!e) synced++;
      else if (!isEnumError(e.message)) console.error('[auto-sync row]', e.message);
    }
    return NextResponse.json({ synced });
  }

  if (error) {
    console.error('[auto-sync]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: finalRows.length });
}
