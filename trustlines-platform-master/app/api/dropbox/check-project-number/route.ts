import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { findExistingProjectByNumber } from '@/lib/dropbox/upload';

export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const sp         = req.nextUrl.searchParams;
  const projectNo  = sp.get('projectNo')?.trim();
  const parentPath = sp.get('parentPath')?.trim();

  if (!projectNo || !parentPath) {
    return NextResponse.json({ error: 'projectNo and parentPath are required' }, { status: 400 });
  }

  try {
    const existingPath = await findExistingProjectByNumber(parentPath, projectNo);
    if (!existingPath) {
      return NextResponse.json({ exists: false });
    }
    const existingName = existingPath.split('/').pop() ?? existingPath;
    return NextResponse.json({ exists: true, existingPath, existingName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dropbox error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
