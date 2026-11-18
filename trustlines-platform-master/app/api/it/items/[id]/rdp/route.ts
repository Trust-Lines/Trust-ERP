import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isRemoteAddress, isUuid, rdpFile, safeFileName } from '@/lib/it/validate';

// "Access Computer" (edit.it): a .rdp file for the item's remote address. Opening it starts
// Windows Remote Desktop to that computer — over the office LAN, or Tailscale for other offices.
// Windows asks for the computer's password; nothing secret is in the file.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await ctx.admin.from('it_items').select('name, remote_address').eq('id', id).is('deleted_at', null).maybeSingle();
  const item = data as { name: string; remote_address: string | null } | null;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!item.remote_address || !isRemoteAddress(item.remote_address)) {
    return NextResponse.json({ error: 'This computer has no remote address yet — add it with Edit Info' }, { status: 409 });
  }

  await logAudit({ actorId: ctx.userId, action: 'it.remote_access', resource: `it_item:${id}`, newValue: { host: item.remote_address } });
  const name = safeFileName(item.name).replace(/[^A-Za-z0-9._ -]/g, '_');
  return new NextResponse(rdpFile(item.remote_address), {
    headers: {
      'Content-Type': 'application/x-rdp',
      'Content-Disposition': `attachment; filename="${name}.rdp"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
