import { NextRequest, NextResponse } from 'next/server';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('documents')
    .select('id, doc_type, version, status, dropbox_path, file_name, uploaded_at, branch, notes, uploader:profiles!uploaded_by(full_name)')
    .eq('project_id', id)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}
