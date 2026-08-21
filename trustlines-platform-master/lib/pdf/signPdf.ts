import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceListDocument, type PdfSection, type PdfSignature } from './PriceListPdf';
import { ProductionFormDocument } from './ProductionFormPdf';
import { PurchaseOrderDocument } from './PurchaseOrderPdf';
import { uploadRevisionToDropbox } from '@/lib/dropbox/upload';
import { approvalStagesFor } from '@/lib/approvals/stageConfig';
import { blackLogoBase64 } from './logo';

const STAGE_BOX_PF: Record<number, string> = {
  1: 'Production Manager',
  2: 'Project Manager',
  3: 'General Manager',
  4: 'Accountant',
};

function stageBox(docType: string, catGroup: string | null, stage: number): string | null {
  if (docType === 'pf') return STAGE_BOX_PF[stage] ?? null;
  return approvalStagesFor(docType, catGroup)[stage - 1]?.box ?? null;
}

export async function applySignaturesToDocument(params: {
  documentId: string;
  projectId:  string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin:      any;
  clear?:     boolean;
}): Promise<boolean> {
  const { documentId, projectId, admin, clear } = params;

  const { data: doc } = await admin
    .from('documents')
    .select('id, form_data, dropbox_path, dropbox_rev, doc_type, cat_group, pf_meta')
    .eq('id', documentId).eq('project_id', projectId).single() as {
      data: { id: string; form_data: PdfSection[] | null; dropbox_path: string; dropbox_rev: string | null; doc_type: string; cat_group: string | null; pf_meta: Record<string, string> | null } | null;
    };

  if (!doc?.form_data?.length || !doc.dropbox_path) return false;

  const signatures: PdfSignature[] = [];
  if (!clear) {
    const { data: approvals } = await admin
      .from('document_approvals')
      .select('stage, approved_by, resolved_at')
      .eq('document_id', documentId)
      .eq('status', 'approved') as { data: { stage: number; approved_by: string | null; resolved_at: string | null }[] | null };

    if (!approvals?.length) return false;

    for (const appr of approvals) {
      if (!appr.approved_by) continue;
      const { data: profile } = await admin
        .from('profiles').select('signature_base64, full_name').eq('id', appr.approved_by).single() as {
          data: { signature_base64: string | null; full_name: string } | null;
        };
      if (!profile?.signature_base64) continue;
      const box = stageBox(doc.doc_type, doc.cat_group, appr.stage);
      if (!box) continue;
      signatures.push({ box, base64: profile.signature_base64, signerName: profile.full_name, signedAt: appr.resolved_at ?? new Date().toISOString() });
    }

    if (!signatures.length) return false;
  }

  const { data: project } = await admin
    .from('projects').select('name, code, client_id, client_franchise_id')
    .eq('id', projectId).single() as { data: { name: string; code: string; client_id: string | null; client_franchise_id: string | null } | null };
  if (!project) return false;

  let clientName = 'T LINES NE';
  const [clientRes, franchiseRes] = await Promise.all([
    project.client_id
      ? admin.from('clients').select('name').eq('id', project.client_id).single() as Promise<{ data: { name: string } | null }>
      : Promise.resolve({ data: null }),
    project.client_franchise_id
      ? admin.from('client_franchises').select('code').eq('id', project.client_franchise_id).single() as Promise<{ data: { code: string } | null }>
      : Promise.resolve({ data: null }),
  ]);
  const cName = clientRes.data?.name?.trim() ?? '';
  const fCode = franchiseRes.data?.code?.trim() ?? '';
  if (cName) clientName = fCode ? `${cName} ${fCode}` : cName;

  const logoBase64 = blackLogoBase64();

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const catGroup = doc.cat_group ?? '';
  const catUpper = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);

  let pdfBuffer: Buffer;
  try {
     
    const element = doc.doc_type === 'pf' && doc.pf_meta
      ? React.createElement(ProductionFormDocument, {
          ...(doc.pf_meta as Record<string, string>),
          sections: doc.form_data, logoBase64, signatures,
        } as any)
      : doc.doc_type === 'po_bo' && doc.pf_meta
      ? React.createElement(PurchaseOrderDocument, {
          ...(doc.pf_meta as Record<string, string>),
          sections: doc.form_data, logoBase64, signatures,
        } as any)
      : React.createElement(PriceListDocument, {
          projectName: project.name,
          projectCode: project.code,
          clientName,
          date,
          catBadge:   catUpper || 'LIST',
          sections:   doc.form_data,
          showPrices: doc.doc_type === 'price_list',
          logoBase64,
          signatures,
        } as any);
    pdfBuffer = await renderToBuffer(element as any);
  } catch (e) {
    console.error('[signPdf] render failed:', e);
    return false;
  }

  try {
    const result = await uploadRevisionToDropbox({ existingPath: doc.dropbox_path, fileBuffer: pdfBuffer, existingRev: doc.dropbox_rev });
    await admin.from('documents').update({ dropbox_rev: result.dropboxRev, last_revised_at: result.serverModified }).eq('id', documentId);
    return true;
  } catch (e) {
    console.error('[signPdf] Dropbox upload failed:', e);
    return false;
  }
}
