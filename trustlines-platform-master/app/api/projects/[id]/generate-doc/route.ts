import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceListDocument, type PdfSection, type PdfCategory, type PdfItem } from '@/lib/pdf/PriceListPdf';
import { uploadToDropbox, uploadRevisionToDropbox, ensureVersionFolder } from '@/lib/dropbox/upload';
import { PROD_TYPES } from '@/lib/dropbox/paths';
import type { ProdType } from '@/lib/dropbox/paths';
import { logAudit } from '@/lib/audit/log';
import { versionScope, getOrCreateOpenVersionSet, markVersionSetDraft } from '@/lib/versions';
import { blackLogoBase64 } from '@/lib/pdf/logo';
import { resetCategoryPfs } from '@/lib/production/resetPf';
import React from 'react';

type Params = { params: Promise<{ id: string }> };

function filterSection(sec: PdfSection): PdfSection {
  const cats: PdfCategory[] = sec.categories
    .map(cat => ({
      ...cat,
      subCategories: cat.subCategories
        .map(sub => ({
          ...sub,
          groups: sub.groups
            .map(grp => ({ ...grp, items: grp.items.filter(i => i.description.trim()) }))
            .filter(grp => grp.items.length > 0),
        }))
        .filter(sub => sub.groups.length > 0),
    }))
    .filter(cat => cat.subCategories.length > 0);
  return { ...sec, categories: cats };
}

function stripWebp(sec: PdfSection): PdfSection {
  return {
    ...sec,
    categories: sec.categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.map(sub => ({
        ...sub,
        groups: sub.groups.map(grp => ({
          ...grp,
          items: grp.items.map(item => ({
            ...item,
            photoBase64: item.photoBase64 && !item.photoBase64.includes('webp') ? item.photoBase64 : null,
          })),
        })),
      })),
    })),
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { id: projectId } = await params;

  const body = await req.json() as {
    docType:     'item_list' | 'price_list';
    catGroup:    string;
    catBadge:    string;
    sections:    PdfSection[];
    showPrices:  boolean;
    documentId?: string;
  };

  const { docType, catGroup, catBadge, sections, showPrices, documentId } = body;
  if (!docType || !catGroup || !sections?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, code, name, dropbox_root_path, client_id, client_franchise_id')
    .eq('id', projectId)
    .single() as { data: { id: string; code: string; name: string; dropbox_root_path: string | null; client_id: string | null; client_franchise_id: string | null } | null; error: unknown };

  if (projErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!project.dropbox_root_path) return NextResponse.json({ error: 'Project has no Dropbox path set' }, { status: 400 });

  let clientName = 'T LINES NE';
  const [clientRes, franchiseRes] = await Promise.all([
    project.client_id
      ? admin.from('clients').select('name').eq('id', project.client_id).single() as Promise<{ data: { name: string } | null }>
      : Promise.resolve({ data: null }),
    project.client_franchise_id
      ? admin.from('client_franchises').select('code').eq('id', project.client_franchise_id).single() as Promise<{ data: { code: string } | null }>
      : Promise.resolve({ data: null }),
  ]);
  const cName  = clientRes.data?.name?.trim()    ?? '';
  const fCode  = franchiseRes.data?.code?.trim() ?? '';
  if (cName) clientName = fCode ? `${cName} ${fCode}` : cName;

  const catUpper = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const prodType = (PROD_TYPES as readonly string[]).includes(catUpper) ? catUpper as ProdType : 'Millwork' as ProdType;

  const logoBase64 = blackLogoBase64();

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

  const filteredSections = sections.map(filterSection).filter(s => s.categories.length > 0);
  if (!filteredSections.length) {
    return NextResponse.json({ error: 'No items to generate' }, { status: 400 });
  }
  const pdfSections = filteredSections.map(stripWebp);

  let pdfBuffer: Buffer;
  try {
     
    const element = React.createElement(PriceListDocument, {
      projectName: project.name,
      projectCode: project.code,
      clientName,
      date,
      catBadge:   catBadge ?? catUpper,
      sections:   pdfSections,
      showPrices,
      logoBase64,
    }) as any;
    pdfBuffer = await renderToBuffer(element);
  } catch (e) {
    console.error('[generate-doc] PDF render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  const scope = versionScope(docType, catGroup);
  let vset = null as Awaited<ReturnType<typeof getOrCreateOpenVersionSet>> | null;
  if (scope) {
    try { vset = await getOrCreateOpenVersionSet(admin, projectId, scope); }
    catch (e) { console.error('[generate-doc] version set lookup failed:', e); }
  }

  type ExistingDoc = { id: string; dropbox_path: string; dropbox_rev: string | null; version: number; dropbox_version: number | null; revision_count: number | null };
  let revisionTarget: ExistingDoc | null = null;

  if (documentId) {
    const { data: existingDoc } = await admin
      .from('documents')
      .select('id, dropbox_path, dropbox_rev, version, dropbox_version, revision_count')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single() as { data: ExistingDoc | null };
    if (!existingDoc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const docVer = existingDoc.dropbox_version ?? existingDoc.version;
    if (!vset || docVer === vset.version_number) revisionTarget = existingDoc;
  } else if (vset) {
    const { data: sameVerDoc } = await admin
      .from('documents')
      .select('id, dropbox_path, dropbox_rev, version, dropbox_version, revision_count')
      .eq('project_id', projectId)
      .eq('doc_type', docType)
      .eq('cat_group', catGroup)
      .eq('dropbox_version', vset.version_number)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: ExistingDoc | null };
    if (sameVerDoc) revisionTarget = sameVerDoc;
  }

  if (revisionTarget) {
    let revResult: { dropboxPath: string; dropboxRev: string; serverModified: string };
    try {
      revResult = await uploadRevisionToDropbox({ existingPath: revisionTarget.dropbox_path, fileBuffer: pdfBuffer, existingRev: revisionTarget.dropbox_rev });
    } catch (e) {
      console.error('[generate-doc] Dropbox revision upload failed:', e);
      return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 });
    }

    const now = new Date().toISOString();
    await admin.from('documents').update({
      form_data:      filteredSections,
      status:         'draft',
      dropbox_rev:    revResult.dropboxRev,
      last_revised_at: revResult.serverModified,
      revision_count: (revisionTarget.revision_count ?? 0) + 1,
      ...(vset ? { version_set_id: vset.id } : {}),
    }).eq('id', revisionTarget.id).eq('project_id', projectId);

    await admin.from('document_approvals').delete().eq('document_id', revisionTarget.id).eq('project_id', projectId);

    if (vset && vset.status === 'signed') await markVersionSetDraft(admin, vset.id);

    const verNum = revisionTarget.dropbox_version ?? revisionTarget.version;
    await logAudit({ actorId: user.id, action: 'document.revised', projectId, resource: `${docType} V${verNum} — ${catUpper} (revision)`, newValue: { documentId: revisionTarget.id, revisedAt: now } });

    return NextResponse.json({ ok: true, documentId: revisionTarget.id, version: verNum, fileName: null });
  }

  let newVersion: number;
  if (vset) {
    newVersion = vset.version_number;
  } else {
    const { data: existingDocs } = await admin
      .from('documents')
      .select('dropbox_version, version')
      .eq('project_id', projectId)
      .eq('doc_type', docType)
      .eq('cat_group', catGroup) as { data: { dropbox_version: number | null; version: number }[] | null };
    const maxVer = Math.max(0, ...((existingDocs ?? []).map(d => d.dropbox_version ?? d.version)));
    newVersion = maxVer + 1;
  }

  try {
    await ensureVersionFolder(project.dropbox_root_path, docType, newVersion, prodType);
  } catch (e) {
    console.error('[generate-doc] ensureVersionFolder failed:', e);
    return NextResponse.json({ error: 'Failed to create Dropbox folder' }, { status: 500 });
  }

  const projCode = project.code.replace(/[^A-Z0-9]/gi, '-');
  const typeTag  = showPrices ? 'PRICE-LIST' : 'ITEM-LIST';
  const fileName = `${projCode} - ${catUpper.toUpperCase()} ${typeTag} V${newVersion}.pdf`;

  let dropboxResult: { dropboxPath: string; dropboxFileId?: string; dropboxRev?: string };
  try {
    dropboxResult = await uploadToDropbox({ projectRootPath: project.dropbox_root_path, docType, fileName, fileBuffer: pdfBuffer, version: newVersion, prodType });
  } catch (e) {
    console.error('[generate-doc] Dropbox upload failed:', e);
    return NextResponse.json({ error: 'Dropbox upload failed' }, { status: 500 });
  }

  const { count: hadApprovedPrev } = await admin.from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId).eq('doc_type', docType).eq('cat_group', catGroup)
    .eq('status', 'approved').lt('dropbox_version', newVersion) as { count: number | null };
  await admin.from('documents').update({ status: 'superseded' })
    .eq('project_id', projectId).eq('doc_type', docType).eq('cat_group', catGroup)
    .eq('status', 'approved').lt('dropbox_version', newVersion);
  if (hadApprovedPrev && catGroup && ['item_list', 'price_list', 'book'].includes(docType)) {
    try { await resetCategoryPfs(admin, projectId, catGroup); } catch (e) { console.error('[generate-doc] resetCategoryPfs:', e); }
  }

  const { error: insErr, data: insData } = await admin
    .from('documents')
    .insert({ project_id: projectId, doc_type: docType, cat_group: catGroup, file_name: fileName, dropbox_path: dropboxResult.dropboxPath, dropbox_version: newVersion, version: newVersion, status: 'draft', uploaded_by: user.id, form_data: filteredSections, dropbox_rev: dropboxResult.dropboxRev ?? null, version_set_id: vset?.id ?? null })
    .select('id')
    .single() as { error: unknown; data: { id: string } | null };

  if (insErr) {
    console.error('[generate-doc] document insert failed:', insErr);
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
  }

  const allItems: PdfItem[] = filteredSections.flatMap(sec =>
    sec.categories.flatMap(c => c.subCategories.flatMap(s => s.groups.flatMap(g => g.items)))
  );
  if (allItems.length > 0) {
    await admin.from('catalog_items').upsert(
      allItems.map(i => ({
        item_code: i.itemCode || null, description: i.description,
        description_note: i.descriptionNote || null, category: catGroup.toLowerCase(),
        unit_price: i.unitPrice ?? null, taking: i.taking || null,
        vendor: i.vendor || null, created_by: user.id, is_active: true,
      })),
      { onConflict: 'description,category', ignoreDuplicates: true },
    );
  }

  await logAudit({ actorId: user.id, action: 'document.generate', projectId, resource: `${docType} V${newVersion} — ${catUpper}`, newValue: { docType, version: newVersion, fileName } });

  return NextResponse.json({ ok: true, documentId: insData?.id, version: newVersion, fileName });
}
