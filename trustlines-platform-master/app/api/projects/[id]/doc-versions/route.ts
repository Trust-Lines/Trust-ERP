import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';
import type { PdfSection } from '@/lib/pdf/PriceListPdf';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { id: projectId } = await params;
  const docType  = req.nextUrl.searchParams.get('doc_type')  ?? 'item_list';
  const catGroup = req.nextUrl.searchParams.get('cat_group') ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let query = admin
    .from('documents')
    .select('id, version, dropbox_version, file_name, created_at, form_data, status, last_revised_at, dropbox_rev')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('version', { ascending: false })
    .limit(20);

  if (catGroup) query = query.eq('cat_group', catGroup);

  const { data, error } = await query as {
    data: { id: string; version: number; dropbox_version: number | null; file_name: string; created_at: string; form_data: PdfSection[] | null; status: string; last_revised_at: string | null; dropbox_rev: string | null }[] | null;
    error: unknown;
  };

  if (error) return NextResponse.json({ versions: [] });
  return NextResponse.json({ versions: data ?? [] });
}
