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
  trust_id?: string | null; case_id?: string | null; custom_type_code?: string | null;
}

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: projects } = await admin
    .from('projects')
    .select('id, code, name, categories, dropbox_root_path, is_archived, region, is_urgent, production_container_date, half_of_year, half_year, trust_project_id')
    .is('deleted_at', null)
    .or('is_archived.is.null,is_archived.eq.false')
    .or('is_draft.is.null,is_draft.eq.false,delivered_to_trust_at.not.is.null')
    .order('created_at', { ascending: true }) as {
      data: { id: string; code: string; name: string; categories: string[] | null; dropbox_root_path: string | null; region: string | null; is_urgent: boolean | null; production_container_date: string | null; half_of_year: string | null; half_year: number | null; trust_project_id: string | null }[] | null;
    };

  if (!projects?.length) return NextResponse.json({ projects: [], directOrders: [], missingExtra: [] });

  const projectIds = projects.map(p => p.id);

  // Rows are no longer made from PF file names here (that duplicated vendors and showed file names
  // as PF codes): the board's rows are the Trust System copy (scripts/copy-trust-production.mts,
  // trust_id set) and the rows people add or edit in T-ERP.

  const { data: items } = await admin
    .from('production_items')
    .select('id, project_id, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index, trust_id, custom_type_code')
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
    const cols = 'id, project_id, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index, trust_id, custom_type_code';
    const { data: firstTry, error: seedErr } = await admin.from('production_items').insert(toSeed).select(cols) as { data: DbItem[] | null; error: { code?: string } | null };
    let seeded = firstTry;
    // Another request seeded these projects a moment ago (unique index, migration 148): read theirs.
    if (seedErr?.code === '23505') {
      ({ data: seeded } = await admin.from('production_items').select(cols)
        .in('project_id', [...new Set(toSeed.map(r => r.project_id))]).eq('source', 'project').is('deleted_at', null) as { data: DbItem[] | null });
    }
    for (const it of seeded ?? []) {
      if (!byProject.has(it.project_id)) byProject.set(it.project_id, []);
      byProject.get(it.project_id)!.push(it);
    }
  }

  const { data: cases } = await admin.from('production_cases')
    .select('id, kind, code, name, address, bucket, case_type, base_project_name, is_urgent, container_date, half_of_year, half_year, created_at, trust_id')
    .is('deleted_at', null).order('created_at', { ascending: true }) as {
      data: { id: string; kind: string; code: string; name: string | null; address: string | null; bucket: string | null; case_type: string | null; base_project_name: string | null; is_urgent: boolean; container_date: string | null; half_of_year: string | null; half_year: number | null; trust_id: string | null }[] | null;
    };
  const caseIds = (cases ?? []).map(c => c.id);
  const { data: extraItems } = caseIds.length ? await admin
    .from('production_items')
    .select('id, project_id, case_id, source, type, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_usd, pf_tl, invoice, invoice_tl, payment_rule, container_no, container_date, sort_index, trust_id, custom_type_code')
    .in('case_id', caseIds)
    .is('deleted_at', null) as { data: DbItem[] | null } : { data: [] as DbItem[] };

  const vendorIds = [...new Set([...(items ?? []), ...(extraItems ?? [])].map(i => i.vendor_id).filter(Boolean))] as string[];
  const vendorMap = new Map<string, { code: string | null; name: string }>();
  if (vendorIds.length) {
    const { data: vendors } = await admin.from('suppliers').select('id, code, name').in('id', vendorIds) as {
      data: { id: string; code: string | null; name: string }[] | null;
    };
    for (const v of vendors ?? []) vendorMap.set(v.id, { code: v.code, name: v.name });
  }

  const mapItem = (it: DbItem): PItem => ({
    id: it.id,
    projectId: it.project_id,
    caseId: it.case_id ?? null,
    customTypeCode: it.custom_type_code ?? null,
    type: it.type,
    pfCode: it.pf_code,
    vendor: it.vendor_id ? (vendorMap.get(it.vendor_id) ?? null) : null,
    vendorId: it.vendor_id,
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
    const visible = rows.filter(r => r.trust_id || r.vendor_id || !typesWithVendor.has(r.type));
    const [head, ...rest] = String(p.name ?? '').split(' - ');
    return {
      id: p.id, kind: 'project' as const, trustId: p.trust_project_id,
      editName: head.trim() || p.code, editAddress: rest.join(' - ').trim(),
      projectNo: p.code,
      projectName: p.name,
      bucket: p.region ?? bucketFromPath(p.dropbox_root_path),
      isUrgent: !!p.is_urgent,
      halfOfYear: p.half_of_year, halfYear: p.half_year,
      containerDate: p.production_container_date,
      items: visible.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)).map(mapItem),
    };
  }).filter(p => p.items.length > 0);

  // A case is a block of its own: "DO-01 · DIRECT ORDER 1", "344-EX-1 · Correctionville… (EXTRA)".
  const buildExtra = (kind: 'direct_order' | 'missing_extra'): PProject[] => (cases ?? []).filter(c => c.kind === kind).map(c => ({
    id: c.id, kind, trustId: c.trust_id,
    editName: (kind === 'missing_extra' ? c.base_project_name ?? c.name : c.name) ?? '', editAddress: c.address ?? '',
    projectNo: c.code,
    projectName: kind === 'missing_extra'
      ? `${c.base_project_name ?? c.name ?? ''}${c.case_type ? ` (${c.case_type})` : ''}`.trim()
      : [c.name, c.address].filter(Boolean).join(' - '),
    bucket: c.bucket ?? 'OTHER',
    isUrgent: c.is_urgent,
    halfOfYear: c.half_of_year, halfYear: c.half_year,
    containerDate: c.container_date,
    items: (extraItems ?? []).filter(it => it.case_id === c.id).sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)).map(mapItem),
  })).filter(p => p.items.length > 0);

  return NextResponse.json(
    { projects: boardProjects, directOrders: buildExtra('direct_order'), missingExtra: buildExtra('missing_extra') },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
