import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { getVersionBaseFolder, getDocSubfolder } from '@/lib/dropbox/paths';
import type { ProdType } from '@/lib/dropbox/paths';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const sp          = request.nextUrl.searchParams;
  const projectRoot = sp.get('projectRoot') ?? '';
  const docType     = sp.get('docType')     ?? '';
  const prodType    = (sp.get('prodType')   ?? undefined) as ProdType | undefined;

  if (!projectRoot || !docType) {
    return NextResponse.json({ error: 'projectRoot and docType are required' }, { status: 400 });
  }

  const baseFolder  = getVersionBaseFolder(docType, prodType);
  if (!baseFolder) return NextResponse.json({ results: [] });

  const subFolder   = getDocSubfolder(docType, prodType);
  const pdfOnly     = subFolder !== null;

  const basePath = `${projectRoot}/${baseFolder}`;
  const dbx      = getDropboxClient();

  try {
    let entries = await dbx.filesListFolder({ path: basePath, recursive: true, include_deleted: false });
    const allEntries = [...(entries.result.entries ?? [])];

    while (entries.result.has_more) {
      entries = await dbx.filesListFolderContinue({ cursor: entries.result.cursor });
      allEntries.push(...(entries.result.entries ?? []));
    }

    const byVersion = new Map<number, { name: string; path: string; dropboxId: string }[]>();
    const subFolderLower = subFolder?.toLowerCase() ?? null;

    for (const entry of allEntries) {
      if (entry['.tag'] !== 'file') continue;
      const fullPath = entry.path_lower ?? entry.path_display ?? '';

      if (pdfOnly && !entry.name.toLowerCase().endsWith('.pdf')) continue;

      const baseNorm = basePath.toLowerCase().replace(/\\/g, '/');
      const rest     = fullPath.replace(baseNorm, '').replace(/^\//, '');
      const vMatch   = rest.match(/^v(\d+)\//i);
      if (!vMatch) continue;

      if (subFolderLower) {
        const afterV = rest.replace(/^v\d+\//i, '');
        if (!afterV.toLowerCase().startsWith(subFolderLower + '/')) continue;
      }

      const v = parseInt(vMatch[1], 10);
      if (!byVersion.has(v)) byVersion.set(v, []);
      byVersion.get(v)!.push({
        name:      entry.name,
        path:      entry.path_display ?? fullPath,
        dropboxId: entry.id ?? '',
      });
    }

    const results = [...byVersion.entries()]
      .map(([version, files]) => ({ version, files }))
      .sort((a, b) => a.version - b.version);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not_found') || msg.includes('path/not_found')) {
      return NextResponse.json({ results: [] });
    }
    console.error('[scan-step-files]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
