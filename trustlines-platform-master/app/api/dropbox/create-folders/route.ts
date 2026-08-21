import { NextRequest, NextResponse } from 'next/server';
import { createProjectFolders } from '@/lib/dropbox/upload';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const body = await request.json() as {
    dropboxSection:    string;
    dropboxRegion:     string;
    dropboxStatus:     string;
    dropboxClientType: string;
    dropboxClientName?: string;
    projectNo:         string;
    address:           string;
    categories?:       string[];
  };

  const { dropboxSection, dropboxRegion, dropboxStatus, dropboxClientType,
          dropboxClientName, projectNo, address, categories } = body;

  if (!dropboxSection || !dropboxRegion || !dropboxStatus || !dropboxClientType || !projectNo || !address) {
    return NextResponse.json({ error: 'Missing required dropbox parameters' }, { status: 400 });
  }

  try {
    const result = await createProjectFolders({
      dropboxSection,
      dropboxRegion,
      dropboxStatus,
      dropboxClientType,
      dropboxClientName,
      projectNo,
      address,
    }, categories ?? []);
    if (result.conflictFolder) {
      return NextResponse.json(
        {
          error:          'PROJECT_NUMBER_EXISTS',
          message:        `Project number ${projectNo} already exists as "${result.conflictFolder.split('/').pop()}". Import that project instead of creating a new one.`,
          existingPath:   result.conflictFolder,
          existingName:   result.conflictFolder.split('/').pop(),
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      rootPath: result.rootPath,
      folders: result.subFolders,
      alreadyExists: result.alreadyExists,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dropbox error';
    console.error('[dropbox/create-folders]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
