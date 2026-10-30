import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { KEY_CLIENTS_NOT_READY, keyClientsMissing, loadClientOpportunities } from '@/lib/keyClients/server';

// TLines dashboard → "Clients Opportunity": the open deals of our key clients, by region. Trust
// sees these before they are signed — only for the clients on the key client list.
export async function GET() {
  const { admin, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  try {
    return NextResponse.json(await loadClientOpportunities(admin));
  } catch (e) {
    if (keyClientsMissing(e)) return NextResponse.json({ notReady: KEY_CLIENTS_NOT_READY, regions: {}, clients: [], total: 0 });
    console.error('[tlines-dashboard/client-opportunities]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not load the client opportunities' }, { status: 500 });
  }
}
