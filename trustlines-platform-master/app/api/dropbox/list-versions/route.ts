import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { getVersionBaseFolder } from '@/lib/dropbox/paths';
import { createClient, requireUser } from '@/lib/supabase/server';
import type { ProdType } from '@/lib/dropbox/paths';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const sp           = request.nextUrl.searchParams;
  const projectRoot  = sp.get('projectRoot') ?? '';
  const docType      = sp.get('docType')     ?? '';
  const prodType     = (sp.get('prodType')   ?? undefined) as ProdType | undefined;
  const outerVersion = sp.get('outerVersion') ? Number(sp.get('outerVersion')) : undefined;

  if (!projectRoot || !docType) {
    return NextResponse.json({ error: 'projectRoot and docType are required' }, { status: 400 });
  }

  let scanFolder: string;
  if (docType === 'pf' && outerVersion) {
    const pt = prodType ?? 'Millwork';
    scanFolder = `${projectRoot}/3-Production & Delivery/${pt}/V${outerVersion}/6-Production Form/For Trust`;
  } else {
    const base = getVersionBaseFolder(docType, prodType);
    if (!base) return NextResponse.json({ versions: [], nextVersion: 1 });
    scanFolder = `${projectRoot}/${base}`;
  }

  try {
    const dbx    = getDropboxClient();
    const result = await dbx.filesListFolder({
      path:      scanFolder,
      recursive: false,
      include_non_downloadable_files: false,
      include_deleted: false,
    });

    const versions = (result.result.entries ?? [])
      .filter(e => e['.tag'] === 'folder' && /^V\d+$/i.test(e.name))
      .map(e => parseInt(e.name.replace(/^V/i, ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const nextVersion = versions.length > 0 ? Math.max(...versions) + 1 : 0;

    return NextResponse.json({ versions, nextVersion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not_found') || msg.includes('path/not_found')) {
      return NextResponse.json({ versions: [], nextVersion: 1 });
    }
    console.error('[dropbox/list-versions]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
