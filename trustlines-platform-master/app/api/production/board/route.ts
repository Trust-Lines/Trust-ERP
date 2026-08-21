import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bucketFromPath, typesForCategories } from '@/lib/production/board';
import type { PProject, PItem } from '@/lib/excel/projectsExcelExport';

export const dynamic = 'force-dynamic';

interface DbItem {
  id: string; project_id: string; source?: string; type: string; vendor_id: string | null; pf_code: string | null;
  order_type: string | null; po_sign_status: string; pf_sign_status: string; status: string;
  std: string | null; etd: string | null; rtd: string | null; rtr: string | null;
  rdy: string | null; ftd: string | null; snd: string | null;
  pf_usd: number | null; pf_tl: number | null; invoice: number | null; invoice_tl: number | null;
  payment_rule: string | null; container_no: string | null; container_date: string | null; sort_index: number | null;
}

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: projects } = await admin
    .from('projects')
    .select('id, code, name, categories, dropbox_root_path, is_archived')
    .is('deleted_at', null)
    .or('is_archived.is.null,is_archived.eq.false')
    .or('is_draft.is.null,is_draft.eq.false,delivered_to_trust_at.not.is.null')
    .order('created_at', { ascending: true }) as {
      data: { id: string; code: string; name: string; categories: string[] | null; dropbox_root_path: string | null }[] | null;
    };

  if (!projects?.length) return NextResponse.json({ projects: [], directOrders: [], missingExtra: [] });

  const projectIds = projects.map(p => p.id);

  try {
    const { data: pfDocs } = await admin.from('documents')
      .select('project_id, cat_group, file_name, form_data')
      .in('project_id', projectIds).eq('doc_type', 'pf') as {
        data: { project_id: string; cat_group: string | null; file_name: string; form_data: { categories: { subCategories: { groups: { items: { quantity: number; unitPrice: number | null }[] }[] }[] }[] }[] | null }[] | null;
      };
    if (pfDocs?.length) {
      const { data: sup } = await admin.from('suppliers').select('id, code') as { data: { id: string; code: string | null }[] | null };
      const codeToId = new Map((sup ?? []).filter(v => v.code).map(v => [v.code!.toUpperCase(), v.id]));
      const { data: existPi } = await admin.from('production_items')
        .select('project_id, type, vendor_id').in('project_id', projectIds).is('deleted_at', null) as {
          data: { project_id: string; type: string; vendor_id: string | null }[] | null;
        };
      const have = new Set((existPi ?? []).filter(r => r.vendor_id).map(r => `${r.project_id}|${r.type}|${r.vendor_id}`));
      const inserts: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (const pf of pfDocs) {
        if (!pf.cat_group) continue;
        const pfCode = pf.file_name.split(' - PF')[0].trim();
        const vendorCode = pfCode.split('-')[0]?.trim().toUpperCase();
        const vendorId = vendorCode ? codeToId.get(vendorCode) : undefined;
        if (!vendorId) continue;
        const type = pf.cat_group.charAt(0).toUpperCase() + pf.cat_group.slice(1);
        const key = `${pf.project_id}|${type}|${vendorId}`;
        if (have.has(key) || seen.has(key)) continue;
        seen.add(key);
        const total = (pf.form_data ?? [])
          .flatMap(s => s.categories.flatMap(c => c.subCategories.flatMap(sb => sb.groups.flatMap(g => g.items))))
          .reduce((a, i) => a + (i.quantity || 0) * (i.unitPrice ?? 0), 0);
        inserts.push({ project_id: pf.project_id, source: 'project', type, vendor_id: vendorId, pf_code: pfCode, pf_usd: total });
      }
      if (inserts.length) await admin.from('production_items').insert(inserts);
    }
  } catch (e) { console.error('[board] PF backfill failed:', e); }

  const { data: items } = await admin
    .from('production_items')
    .select('id, project_id, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index')
    .in('project_id', projectIds)
    .eq('source', 'project')
    .is('deleted_at', null) as { data: DbItem[] | null };

  const byProject = new Map<string, DbItem[]>();
  for (const it of items ?? []) {
    if (!byProject.has(it.project_id)) byProject.set(it.project_id, []);
    byProject.get(it.project_id)!.push(it);
  }

  const toSeed: { project_id: string; source: string; type: string; sort_index: number }[] = [];
  for (const p of projects) {
    if (byProject.has(p.id)) continue;
    const types = typesForCategories(p.categories);
    types.forEach((type, i) => toSeed.push({ project_id: p.id, source: 'project', type, sort_index: i }));
  }
  if (toSeed.length) {
    const { data: seeded } = await admin.from('production_items').insert(toSeed)
      .select('id, project_id, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index') as { data: DbItem[] | null };
    for (const it of seeded ?? []) {
      if (!byProject.has(it.project_id)) byProject.set(it.project_id, []);
      byProject.get(it.project_id)!.push(it);
    }
  }

  const { data: extraItems } = await admin
    .from('production_items')
    .select('id, project_id, source, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index')
    .in('project_id', projectIds)
    .in('source', ['direct_order', 'missing_extra'])
    .is('deleted_at', null) as { data: DbItem[] | null };

  const vendorIds = [...new Set([...(items ?? []), ...(extraItems ?? [])].map(i => i.vendor_id).filter(Boolean))] as string[];
  const vendorMap = new Map<string, { code: string | null; name: string }>();
  if (vendorIds.length) {
    const { data: vendors } = await admin.from('suppliers').select('id, code, name').in('id', vendorIds) as {
      data: { id: string; code: string | null; name: string }[] | null;
    };
    for (const v of vendors ?? []) vendorMap.set(v.id, { code: v.code, name: v.name });
  }

  const mapItem = (it: DbItem): PItem => ({
    type: it.type,
    pfCode: it.pf_code,
    vendor: it.vendor_id ? (vendorMap.get(it.vendor_id) ?? null) : null,
    orderType: it.order_type,
    poSignStatus: it.po_sign_status,
    pfSignStatus: it.pf_sign_status,
    status: it.status,
    std: it.std, etd: it.etd, rtd: it.rtd, rtr: it.rtr, rdy: it.rdy, ftd: it.ftd, snd: it.snd,
    pfUsd: it.pf_usd ?? 0, pfTl: it.pf_tl ?? 0, invoice: it.invoice ?? 0, invoiceTl: it.invoice_tl ?? 0,
    paymentRule: it.payment_rule, containerNo: it.container_no, containerDate: it.container_date,
  });

  const boardProjects: PProject[] = projects.map(p => {
    const rows = byProject.get(p.id) ?? [];
    const typesWithVendor = new Set(rows.filter(r => r.vendor_id).map(r => r.type));
    const visible = rows.filter(r => r.vendor_id || !typesWithVendor.has(r.type));
    return {
      projectNo: p.code,
      projectName: p.name,
      bucket: bucketFromPath(p.dropbox_root_path),
      containerDate: null,
      items: visible.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)).map(mapItem),
    };
  }).filter(p => p.items.length > 0);

  const projById = new Map(projects.map(p => [p.id, p]));
  const buildExtra = (source: string): PProject[] => {
    const bySrcProject = new Map<string, DbItem[]>();
    for (const it of extraItems ?? []) {
      if (it.source !== source) continue;
      if (!bySrcProject.has(it.project_id)) bySrcProject.set(it.project_id, []);
      bySrcProject.get(it.project_id)!.push(it);
    }
    const out: PProject[] = [];
    for (const [pid, rows] of bySrcProject) {
      const p = projById.get(pid);
      if (!p) continue;
      out.push({
        projectNo: p.code,
        projectName: p.name,
        bucket: bucketFromPath(p.dropbox_root_path),
        containerDate: null,
        items: rows.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)).map(mapItem),
      });
    }
    return out;
  };

  return NextResponse.json(
    { projects: boardProjects, directOrders: buildExtra('direct_order'), missingExtra: buildExtra('missing_extra') },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
