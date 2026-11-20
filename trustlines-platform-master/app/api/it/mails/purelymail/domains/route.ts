import { NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { listPurelymailDomains } from '@/lib/it/purelymail';
import { purelymailFailure } from '@/lib/it/purelymailHttp';

export const dynamic = 'force-dynamic';

// The account's own domains, for "New mailbox" (edit.it). → 200 { domains: string[] }
export async function GET() {
  const { deny } = await itApi('edit');
  if (deny) return deny;
  const r = await listPurelymailDomains();
  return r.ok ? NextResponse.json({ domains: r.domains }) : purelymailFailure(r);
}
