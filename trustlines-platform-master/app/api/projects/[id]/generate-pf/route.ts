import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ProductionFormDocument } from '@/lib/pdf/ProductionFormPdf';
import type { PdfSection } from '@/lib/pdf/PriceListPdf';
import { uploadToDropbox, uploadRevisionToDropbox, ensureVersionFolder } from '@/lib/dropbox/upload';
import { PROD_TYPES, type ProdType } from '@/lib/dropbox/paths';
import { generatePfCode, projectNumberFromCode, TYPE_LETTER } from '@/lib/production/pfCode';
import { bucketFromPath } from '@/lib/production/board';
import { logAudit } from '@/lib/audit/log';
import { blackLogoBase64 } from '@/lib/pdf/logo';
import React from 'react';

type Params = { params: Promise<{ id: string }> };

const REGION_SHORT: Record<string, string> = {
  TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'CVW', TLINES_HQ: 'HQ', TLINES_TC: 'TC',
};

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const body = await req.json() as {
    catGroup:    string;
    vendorCode:  string;
    vendorName:  string;
    orderType?:  string;
    typeLabel?:  string;
    sections:    PdfSection[];
  };
  const { catGroup, vendorCode, vendorName, orderType, typeLabel, sections } = body;
  if (!catGroup || !vendorCode || !sections?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: project } = await admin
    .from('projects')
    .select('id, code, name, dropbox_root_path, client_id, client_franchise_id')
    .eq('id', projectId).single() as {
      data: { id: string; code: string; name: string; dropbox_root_path: string | null; client_id: string | null; client_franchise_id: string | null } | null;
    };
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.dropbox_root_path) return NextResponse.json({ error: 'Project has no Dropbox path' }, { status: 400 });

  let clientName = 'T LINES NE';
  const [clientRes, franchiseRes] = await Promise.all([
    project.client_id ? admin.from('clients').select('name').eq('id', project.client_id).single() : Promise.resolve({ data: null }),
    project.client_franchise_id ? admin.from('client_franchises').select('code').eq('id', project.client_franchise_id).single() : Promise.resolve({ data: null }),
  ]) as [{ data: { name: string } | null }, { data: { code: string } | null }];
  const cName = clientRes.data?.name?.trim() ?? '';
  const fCode = franchiseRes.data?.code?.trim() ?? '';
  if (cName) clientName = fCode ? `${cName} ${fCode}` : cName;

  const catUpper = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const prodType = (PROD_TYPES as readonly string[]).includes(catUpper) ? catUpper as ProdType : 'Millwork' as ProdType;
  const type     = catUpper;
  const projectNo = projectNumberFromCode(project.code);

  const { data: existing } = await admin
    .from('documents')
    .select('id, dropbox_version, file_name, dropbox_path, dropbox_rev, status')
    .eq('project_id', projectId).eq('doc_type', 'pf').eq('cat_group', catGroup) as {
      data: { id: string; dropbox_version: number | null; file_name: string; dropbox_path: string; dropbox_rev: string | null; status: string }[] | null;
    };
  const existingCodes: string[] = [];
  const codeOrderType = (typeLabel && typeLabel.trim()) ? typeLabel : orderType;
  const pfCode = generatePfCode({ vendorCode, projectNo, type, orderType: codeOrderType, existingCodes }) ?? `${vendorCode}-${projectNo}-${TYPE_LETTER[type] ?? 'X'}01`;

  const sameCode = (existing ?? []).filter(d => d.file_name.startsWith(pfCode));
  const latestDraft = sameCode
    .filter(d => d.status !== 'approved')
    .sort((a, b) => (b.dropbox_version ?? 0) - (a.dropbox_version ?? 0))[0] ?? null;
  const newVersion = sameCode.length === 0 ? 0
    : (latestDraft ? (latestDraft.dropbox_version ?? 0) : Math.max(...sameCode.map(d => d.dropbox_version ?? 0)) + 1);

  const region = REGION_SHORT[bucketFromPath(project.dropbox_root_path)] ?? '';
  const poNumber = `${region}-${projectNo}-${TYPE_LETTER[type] ?? ''}`;

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

  const logoBase64 = blackLogoBase64();

  const cleanSections: PdfSection[] = sections.map(sec => ({
    ...sec,
    categories: sec.categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.map(sub => ({
        ...sub,
        groups: sub.groups.map(grp => ({
          ...grp,
          items: grp.items
            .filter(i => i.description.trim())
            .map(i => ({ ...i, photoBase64: i.photoBase64 && !i.photoBase64.includes('webp') ? i.photoBase64 : null })),
        })),
      })),
    })),
  }));

  let pdfBuffer: Buffer;
  try {
     
    const el = React.createElement(ProductionFormDocument, {
      catBadge: catUpper, supplierName: vendorName || vendorCode, orderNo: pfCode, date,
      projectNumber: projectNo, projectName: project.name, clientName, poNumber,
      orderTypeLabel: orderType ?? '', sections: cleanSections, logoBase64,
    }) as any;
    pdfBuffer = await renderToBuffer(el);
  } catch (e) {
    console.error('[generate-pf] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  const pfMeta = {
    catBadge: catUpper, supplierName: vendorName || vendorCode, orderNo: pfCode, date,
    projectNumber: projectNo, projectName: project.name, clientName, poNumber,
    orderTypeLabel: (typeLabel && typeLabel.trim()) ? typeLabel : (orderType ?? ''),
  };

  let doc: { id: string } | null;

  if (latestDraft) {
    let revRev: string | null = latestDraft.dropbox_rev;
    try {
      const r = await uploadRevisionToDropbox({ existingPath: latestDraft.dropbox_path, fileBuffer: pdfBuffer, existingRev: latestDraft.dropbox_rev });
      revRev = r.dropboxRev;
    } catch (e) {
      console.error('[generate-pf] revision upload failed:', e);
      return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 });
    }
    const updateFull = { form_data: cleanSections, dropbox_rev: revRev, status: 'draft', pf_signatures: [], pf_meta: pfMeta };
    let upd = await admin.from('documents').update(updateFull).eq('id', latestDraft.id) as { error: { message?: string } | null };
    if (upd.error && /column|schema cache/i.test(upd.error.message ?? '')) {
      upd = await admin.from('documents').update({ form_data: cleanSections, dropbox_rev: revRev, status: 'draft' }).eq('id', latestDraft.id);
    }
    await admin.from('document_approvals').delete().eq('document_id', latestDraft.id).eq('project_id', projectId);
    doc = { id: latestDraft.id };
  } else {
    const supersedeIds = sameCode.filter(d => d.status === 'approved').map(d => d.id);
    if (supersedeIds.length) await admin.from('documents').update({ status: 'superseded' }).in('id', supersedeIds);
    try {
      await ensureVersionFolder(project.dropbox_root_path, 'pf', newVersion, prodType);
    } catch (e) {
      console.error('[generate-pf] ensureVersionFolder failed:', e);
    }
    const fileName = `${pfCode} - PF V${newVersion}.pdf`;
    let uploaded: { dropboxPath: string; dropboxRev?: string };
    try {
      uploaded = await uploadToDropbox({ projectRootPath: project.dropbox_root_path, docType: 'pf', fileName, fileBuffer: pdfBuffer, version: newVersion, prodType });
    } catch (e) {
      console.error('[generate-pf] Dropbox upload failed:', e);
      return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 });
    }
    const baseInsert = {
      project_id: projectId, doc_type: 'pf', cat_group: catGroup, file_name: fileName,
      dropbox_path: uploaded.dropboxPath, dropbox_version: newVersion, version: newVersion,
      status: 'draft', uploaded_by: user.id, form_data: cleanSections, dropbox_rev: uploaded.dropboxRev ?? null,
    };
    let res = await admin.from('documents').insert({ ...baseInsert, pf_signatures: [], pf_meta: pfMeta }).select('id').single() as { data: { id: string } | null; error: { message?: string } | null };
    if (res.error && /column|schema cache/i.test(res.error.message ?? '')) {
      res = await admin.from('documents').insert(baseInsert).select('id').single();
    }
    doc = res.data;
    if (res.error && !doc) {
      console.error('[generate-pf] document insert failed:', res.error);
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }
  }

  try {
    const { data: vendorRow } = await admin.from('suppliers').select('id').eq('code', vendorCode).maybeSingle() as {
      data: { id: string } | null;
    };
    const vendorId = vendorRow?.id ?? null;
    const totalUsd = cleanSections
      .flatMap(s => s.categories.flatMap(c => c.subCategories.flatMap(sb => sb.groups.flatMap(g => g.items))))
      .reduce((a, i) => a + (i.quantity || 0) * (i.unitPrice ?? 0), 0);
    if (vendorId) {
      const { data: existingPi } = await admin.from('production_items')
        .select('id').eq('project_id', projectId).eq('type', type).eq('vendor_id', vendorId)
        .eq('source', 'project').is('deleted_at', null).maybeSingle() as { data: { id: string } | null };
      const fields = { pf_code: pfCode, order_type: orderType ?? null, pf_usd: totalUsd, updated_at: new Date().toISOString() };
      if (existingPi) {
        await admin.from('production_items').update(fields).eq('id', existingPi.id);
      } else {
        await admin.from('production_items').insert({ project_id: projectId, source: 'project', type, vendor_id: vendorId, ...fields });
      }
    }
  } catch (e) { console.error('[generate-pf] board sync failed:', e); }

  await logAudit({ actorId: user.id, action: 'pf.generated', projectId, resource: `${pfCode} V${newVersion}`, newValue: { vendorCode, catGroup, version: newVersion } });

  return NextResponse.json({ ok: true, documentId: doc?.id, pfCode, version: newVersion, revised: !!latestDraft });
}
