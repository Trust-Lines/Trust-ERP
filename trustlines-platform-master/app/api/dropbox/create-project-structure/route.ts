import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { PROJECT_STRUCTURE_V2 } from '@/lib/dropbox/paths';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { projectFolderPath } = await request.json() as { projectFolderPath: string };
  if (!projectFolderPath) return NextResponse.json({ error: 'projectFolderPath required' }, { status: 400 });

  try {
    const dbx = getDropboxClient();

    const subFolders = PROJECT_STRUCTURE_V2.map(sub => `${projectFolderPath}/${sub}`);
    const allPaths   = [projectFolderPath, ...subFolders];

    const batchRes = await dbx.filesCreateFolderBatch({ paths: allPaths, autorename: false });
    if (batchRes.result['.tag'] === 'async_job_id') {
      const jobId = (batchRes.result as { async_job_id: string }).async_job_id;
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 500));
        const check = await dbx.filesCreateFolderBatchCheck({ async_job_id: jobId });
        done = check.result['.tag'] !== 'in_progress';
      }
    }

    return NextResponse.json({ success: true, projectFolderPath, subFolders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dropbox/create-project-structure]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
