import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ProductionFormDocument, PF_SIGNATURE_BOXES, PF_SIGNER_ROLE } from '@/lib/pdf/ProductionFormPdf';
import type { PdfSection, PdfSignature } from '@/lib/pdf/PriceListPdf';
import { uploadRevisionToDropbox } from '@/lib/dropbox/upload';
import { logAudit } from '@/lib/audit/log';
import fs from 'fs';
import path from 'path';
import React from 'react';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const { documentId, box } = await req.json() as { documentId: string; box: string };
  if (!documentId || !box || !(PF_SIGNATURE_BOXES as readonly string[]).includes(box)) {
    return NextResponse.json({ error: 'documentId and a valid box are required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: doc } = await admin.from('documents')
    .select('id, form_data, pf_meta, pf_signatures, dropbox_path, dropbox_rev')
    .eq('id', documentId).eq('project_id', projectId).single() as {
      data: { id: string; form_data: PdfSection[] | null; pf_meta: Record<string, string> | null; pf_signatures: PdfSignature[] | null; dropbox_path: string; dropbox_rev: string | null } | null;
    };
  if (!doc?.pf_meta || !doc.form_data) return NextResponse.json({ error: 'PF not found or missing metadata' }, { status: 404 });

  const { data: profile } = await admin.from('profiles').select('signature_base64, full_name, role').eq('id', user.id).single() as {
    data: { signature_base64: string | null; full_name: string; role: string } | null;
  };
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const requiredRole = PF_SIGNER_ROLE[box];
  if (requiredRole && profile.role !== requiredRole) {
    return NextResponse.json({ error: `Only the ${box} role can sign this box` }, { status: 403 });
  }

  if (!profile.signature_base64) {
    return NextResponse.json({ error: 'NO_SIGNATURE' }, { status: 409 });
  }

  const others = (doc.pf_signatures ?? []).filter(g => g.box.toLowerCase() !== box.toLowerCase());
  const signatures: PdfSignature[] = [...others, {
    box, base64: profile.signature_base64, signerName: profile.full_name, signedAt: new Date().toISOString(),
  }];

  const blackLogoPath = 'C:\\Users\\Trust\\Desktop\\Trust\\Trust_Lines-DSB-Black_p6i5sj.png';
  let logoBuffer: Buffer;
  try { logoBuffer = fs.readFileSync(blackLogoPath); }
  catch { logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png')); }
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  let pdfBuffer: Buffer;
  try {
     
    const el = React.createElement(ProductionFormDocument, {
      ...(doc.pf_meta as Record<string, string>), sections: doc.form_data, logoBase64, signatures,
    } as any) as any;
    pdfBuffer = await renderToBuffer(el);
  } catch (e) {
    console.error('[pf-sign] render failed:', e);
    return NextResponse.json({ error: 'Render failed' }, { status: 500 });
  }

  let serverModified: string | null = null;
  try {
    const r = await uploadRevisionToDropbox({ existingPath: doc.dropbox_path, fileBuffer: pdfBuffer, existingRev: doc.dropbox_rev });
    serverModified = r.serverModified;
    await admin.from('documents').update({ pf_signatures: signatures, dropbox_rev: r.dropboxRev, last_revised_at: r.serverModified }).eq('id', documentId);
  } catch (e) {
    console.error('[pf-sign] upload failed:', e);
    await admin.from('documents').update({ pf_signatures: signatures }).eq('id', documentId);
  }

  await logAudit({ actorId: user.id, action: 'pf.signed', projectId, resource: `${box} — doc ${documentId}` });

  const allSigned = PF_SIGNATURE_BOXES.every(b => signatures.some(g => g.box.toLowerCase() === b.toLowerCase()));
  if (allSigned) await admin.from('documents').update({ status: 'approved', approved_at: serverModified ?? new Date().toISOString() }).eq('id', documentId);

  return NextResponse.json({ ok: true, signatures, allSigned });
}
