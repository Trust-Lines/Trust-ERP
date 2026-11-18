import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { logAudit } from '@/lib/audit/log';
import { itApi, ticketFor, type TicketFile } from '@/lib/it/server';
import { isUuid, safeFileName } from '@/lib/it/validate';
import { IT_FILE_MAX_BYTES, IT_TICKET_MAX_FILES } from '@/lib/it/constants';

// Attach one file to a ticket (multipart "file"): its sender while it's open, or IT. Stored in
// Dropbox under /IT/Tickets/<ticket id>/ as a new file (never overwrites: Dropbox renames).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('request');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ticket = await ticketFor(ctx, id);
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const mine = ticket.requester_id === ctx.userId && ticket.status === 'open';
  if (!mine && !ctx.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if ((ticket.files ?? []).length >= IT_TICKET_MAX_FILES) {
    return NextResponse.json({ error: `A ticket can have at most ${IT_TICKET_MAX_FILES} files` }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a file' }, { status: 400 });
  if (file.size > IT_FILE_MAX_BYTES) return NextResponse.json({ error: 'The file is too large (max 4 MB)' }, { status: 413 });

  const name = safeFileName(file.name);
  let path: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path: `/IT/Tickets/${id}/${name}`,
      contents: Buffer.from(await file.arrayBuffer()),
      mode: { '.tag': 'add' },
      autorename: true,
    });
    path = res.result.path_lower ?? res.result.path_display ?? `/IT/Tickets/${id}/${name}`;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (e as any)?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
    console.error('[it] ticket file upload failed:', msg);
    return NextResponse.json({ error: `Dropbox: ${msg}` }, { status: 502 });
  }

  const entry: TicketFile = { id: randomUUID(), name, path, size: file.size, type: file.type || 'application/octet-stream' };
  // Re-read just before writing so two uploads at once both stay on the list.
  const { data: fresh } = await ctx.admin.from('it_tickets').select('files').eq('id', id).single();
  const files = [...(((fresh as { files: TicketFile[] | null } | null)?.files) ?? []), entry];
  const { error } = await ctx.admin.from('it_tickets').update({ files, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: ctx.userId, action: 'it.ticket_file_added', resource: `it_ticket:${id}`, newValue: { name, size: file.size } });
  return NextResponse.json({ file: { id: entry.id, name } }, { status: 201 });
}
