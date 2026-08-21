import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const sp      = req.nextUrl.searchParams;
  const section = sp.get('section')?.trim() ?? '';
  const region  = sp.get('region')?.trim()  ?? '';

  const sectionName = section.replace(/^\d+[-\s]*/, '').trim();

  const regionCodeMatch = region.match(/T\s+Lines\s+(\w+)\s+Projects/i);
  const regionCode      = regionCodeMatch?.[1] ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  try {
    let franchiseId: string | null = null;
    let clientId:    string | null = null;

    if (regionCode) {
      const { data: franchises } = await adm
        .from('client_franchises')
        .select('id, client_id, name, code')
        .or(`code.ilike.${regionCode},name.ilike.%${regionCode}%`)
        .limit(5) as { data: { id: string; client_id: string; name: string; code: string }[] | null };

      if (franchises && franchises.length > 0) {
        const exact = franchises.find(f => f.code?.toLowerCase() === regionCode.toLowerCase());
        const best  = exact ?? franchises[0];
        franchiseId = best.id;
        clientId    = best.client_id;
      }
    }

    let companyId: string | null = null;

    if (sectionName) {
      let companyQuery = adm
        .from('client_companies')
        .select('id, franchise_id, name, code')
        .ilike('name', `%${sectionName}%`)
        .limit(5);

      if (franchiseId) {
        companyQuery = companyQuery.eq('franchise_id', franchiseId);
      }

      const { data: companies } = await companyQuery as {
        data: { id: string; franchise_id: string; name: string; code: string }[] | null
      };

      if (companies && companies.length > 0) {
        companyId = companies[0].id;
        if (!franchiseId) franchiseId = companies[0].franchise_id;
      }
    }

    if (franchiseId && !clientId) {
      const { data: fRow } = await adm
        .from('client_franchises')
        .select('client_id')
        .eq('id', franchiseId)
        .single() as { data: { client_id: string } | null };
      clientId = fRow?.client_id ?? null;
    }

    return NextResponse.json({ clientId, franchiseId, companyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
