import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { PurchaseOrderDocument } from '@/lib/pdf/PurchaseOrderPdf';
import type { PdfSection } from '@/lib/pdf/PriceListPdf';
import { uploadToDropbox, uploadRevisionToDropbox, ensureVersionFolder } from '@/lib/dropbox/upload';
import { PROD_TYPES, type ProdType } from '@/lib/dropbox/paths';
import { projectNumberFromCode, TYPE_LETTER } from '@/lib/production/pfCode';
import { bucketFromPath } from '@/lib/production/board';
import { blackLogoBase64 } from '@/lib/pdf/logo';
import { resetCategoryPfs } from '@/lib/production/resetPf';
import { logAudit } from '@/lib/audit/log';
import React from 'react';

type Params = { params: Promise<{ id: string }> };
const REGION_SHORT: Record<string, string> = { TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'CVW', TLINES_HQ: 'HQ', TLINES_TC: 'TC' };

function applyMargin(sections: PdfSection[], m: number): PdfSection[] {
  if (!(m > 0) || m === 1) return sections;
  return sections.map(sec => ({
    ...sec,
    categories: sec.categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.map(sub => ({
        ...sub,
        groups: sub.groups.map(g => ({
          ...g,
          items: g.items.map(it => ({
            ...it,
            unitPrice: it.unitPrice != null ? Math.round(it.unitPrice * m * 100) / 100 : it.unitPrice,
          })),
        })),
      })),
    })),
  }));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const body = await req.json() as { catGroup: string; sections?: PdfSection[] };
  const { catGroup } = body;
  if (!catGroup) return NextResponse.json({ error: 'catGroup required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: project } = await admin
    .from('projects').select('id, code, name, dropbox_root_path, client_id, client_franchise_id, client_company_id')
    .eq('id', projectId).single() as {
      data: { id: string; code: string; name: string; dropbox_root_path: string | null; client_id: string | null; client_franchise_id: string | null; client_company_id: string | null } | null;
    };
  if (!project?.dropbox_root_path) return NextResponse.json({ error: 'Project has no Dropbox path' }, { status: 400 });

  let sections = body.sections ?? null;
  let typeLabel = '';
  if (!sections) {
    const { data: plDocs } = await admin.from('documents')
      .select('form_data, dropbox_version, version').eq('project_id', projectId)
      .eq('doc_type', 'price_list').eq('cat_group', catGroup)
      .order('dropbox_version', { ascending: false }).limit(1) as {
        data: { form_data: PdfSection[] | null; dropbox_version: number | null; version: number }[] | null;
      };
    sections = plDocs?.[0]?.form_data ?? null;
  }
  if (!sections?.length) return NextResponse.json({ error: 'No Item Price List found for this category' }, { status: 409 });
  typeLabel = sections[0]?.typeLabel ?? '';

  let clientName = 'T LINES NE';
  const [clientRes, franchiseRes, companyRes] = await Promise.all([
    project.client_id ? admin.from('clients').select('name').eq('id', project.client_id).single() : Promise.resolve({ data: null }),
    project.client_franchise_id ? admin.from('client_franchises').select('code').eq('id', project.client_franchise_id).maybeSingle() : Promise.resolve({ data: null }),
    project.client_company_id ? admin.from('client_companies').select('margin_pct').eq('id', project.client_company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]) as [{ data: { name: string } | null }, { data: { code: string } | null }, { data: { margin_pct: number | null } | null }];
  const cName = clientRes.data?.name?.trim() ?? '';
  const fCode = franchiseRes.data?.code?.trim() ?? '';
  if (cName) clientName = fCode ? `${cName} ${fCode}` : cName;

  const rawMargin = companyRes.data?.margin_pct ?? null;
  const margin = (rawMargin != null && rawMargin > 0) ? rawMargin : 1;
  sections = applyMargin(sections, margin);

  const catUpper = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const prodType = (PROD_TYPES as readonly string[]).includes(catUpper) ? catUpper as ProdType : 'Millwork' as ProdType;
  const projectNo = projectNumberFromCode(project.code);
  const region = REGION_SHORT[bucketFromPath(project.dropbox_root_path)] ?? '';
  const poNumber = `${region}-P${projectNo}-${TYPE_LETTER[catUpper] ?? ''}`;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const logoBase64 = blackLogoBase64();

  const meta = { catBadge: catUpper, clientName, poNumber, date, projectName: project.name, projectNumber: projectNo, typeLabel };

  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = React.createElement(PurchaseOrderDocument, { ...meta, sections, logoBase64 } as any) as any;
    pdfBuffer = await renderToBuffer(el);
  } catch (e) {
    console.error('[generate-po] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  const { data: existing } = await admin.from('documents')
    .select('id, dropbox_version, version, dropbox_path, dropbox_rev, status, file_name')
    .eq('project_id', projectId).eq('doc_type', 'po_bo').eq('cat_group', catGroup) as {
      data: { id: string; dropbox_version: number | null; version: number; dropbox_path: string; dropbox_rev: string | null; status: string; file_name: string }[] | null;
    };
  const draft = (existing ?? []).filter(d => d.status !== 'approved').sort((a, b) => (b.dropbox_version ?? 0) - (a.dropbox_version ?? 0))[0] ?? null;

  let doc: { id: string } | null; let version: number;
  if (draft) {
    version = draft.dropbox_version ?? draft.version;
    let rev = draft.dropbox_rev;
    try { const r = await uploadRevisionToDropbox({ existingPath: draft.dropbox_path, fileBuffer: pdfBuffer, existingRev: draft.dropbox_rev }); rev = r.dropboxRev; }
    catch (e) { console.error('[generate-po] revision failed:', e); return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 }); }
    let upd = await admin.from('documents').update({ form_data: sections, dropbox_rev: rev, status: 'draft', pf_signatures: [], pf_meta: meta }).eq('id', draft.id) as { error: { message?: string } | null };
    if (upd.error && /column|schema cache/i.test(upd.error.message ?? '')) upd = await admin.from('documents').update({ form_data: sections, dropbox_rev: rev, status: 'draft' }).eq('id', draft.id);
    await admin.from('document_approvals').delete().eq('document_id', draft.id).eq('project_id', projectId);
    doc = { id: draft.id };
  } else {
    const { count: wasApproved } = await admin.from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('doc_type', 'po_bo').eq('cat_group', catGroup).eq('status', 'approved') as { count: number | null };
    await admin.from('documents').update({ status: 'superseded' })
      .eq('project_id', projectId).eq('doc_type', 'po_bo').eq('cat_group', catGroup).eq('status', 'approved');
    if (wasApproved) { try { await resetCategoryPfs(admin, projectId, catGroup); } catch (e) { console.error('[generate-po] resetCategoryPfs:', e); } }
    version = existing?.length ? Math.max(...existing.map(d => d.dropbox_version ?? 0)) + 1 : 0;
    try { await ensureVersionFolder(project.dropbox_root_path, 'po_bo', version, prodType); } catch (e) { console.error('[generate-po] ensureVersionFolder:', e); }
    const fileName = `${poNumber} - PO V${version}.pdf`;
    let uploaded: { dropboxPath: string; dropboxRev?: string };
    try { uploaded = await uploadToDropbox({ projectRootPath: project.dropbox_root_path, docType: 'po_bo', fileName, fileBuffer: pdfBuffer, version, prodType }); }
    catch (e) { console.error('[generate-po] upload failed:', e); return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 }); }
    const base = { project_id: projectId, doc_type: 'po_bo', cat_group: catGroup, file_name: fileName, dropbox_path: uploaded.dropboxPath, dropbox_version: version, version, status: 'draft', uploaded_by: user.id, form_data: sections, dropbox_rev: uploaded.dropboxRev ?? null };
    let res = await admin.from('documents').insert({ ...base, pf_signatures: [], pf_meta: meta }).select('id').single() as { data: { id: string } | null; error: { message?: string } | null };
    if (res.error && /column|schema cache/i.test(res.error.message ?? '')) res = await admin.from('documents').insert(base).select('id').single();
    doc = res.data;
    if (res.error && !doc) { console.error('[generate-po] insert failed:', res.error); return NextResponse.json({ error: 'Failed to save document' }, { status: 500 }); }
  }

  await logAudit({ actorId: user.id, action: 'po.generated', projectId, resource: `${poNumber} V${version}`, newValue: { margin } });
  return NextResponse.json({ ok: true, documentId: doc?.id, poNumber, version });
}
