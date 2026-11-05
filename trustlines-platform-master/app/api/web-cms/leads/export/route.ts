import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/web-cms/leads';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// Website Leads → Excel. Every submission (no 500 cap, no status filter) with every field the
// row has, plus the linked Contact's name and who handled it. ip_hash is left out on purpose:
// it is an abuse-tracing hash, not information about the lead.

interface LeadRow {
  id: string; kind: string; name: string | null; phone: string | null; email: string | null;
  company: string | null; store_location: string | null; store_condition: string | null; store_type: string | null;
  message: string | null; notes?: string | null; consent_accepted: boolean; consent_text_version: string | null; consent_at: string | null;
  source_page: string | null; utm: Record<string, string> | null; status: LeadStatus; internal_note: string | null;
  prospect_id: string | null; handled_by: string | null; handled_at: string | null; created_at: string; updated_at: string | null;
}

const PAGE = 1000;

function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function GET() {
  const { user, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const leads: LeadRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from('web_leads').select('*')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    leads.push(...((data ?? []) as LeadRow[]));
    if (!data || data.length < PAGE) break;
  }

  const prospectIds = [...new Set(leads.map(l => l.prospect_id).filter((x): x is string => !!x))];
  const handlerIds = [...new Set(leads.map(l => l.handled_by).filter((x): x is string => !!x))];
  let prospects: { id: string; display_name: string }[] = [];
  let handlers: { id: string; full_name: string }[] = [];
  try {
    [prospects, handlers] = await Promise.all([
      fetchInChunks(prospectIds, chunk => admin.from('prospects').select('id, display_name').in('id', chunk)),
      fetchInChunks(handlerIds, chunk => admin.from('profiles').select('id, full_name').in('id', chunk)),
    ]) as [typeof prospects, typeof handlers];
  } catch { /* names are a nicety — export the leads anyway */ }
  const prospectName = new Map(prospects.map(p => [p.id, p.display_name]));
  const handlerName = new Map(handlers.map(p => [p.id, p.full_name]));

  const columns: { header: string; width: number; wrap?: boolean; get: (l: LeadRow) => string }[] = [
    { header: 'Received', width: 18, get: l => fmt(l.created_at) },
    { header: 'Type', width: 12, get: l => (l.kind === 'newsletter' ? 'Newsletter' : 'Contact form') },
    { header: 'Status', width: 12, get: l => LEAD_STATUS_LABEL[l.status] ?? l.status },
    { header: 'Name', width: 22, get: l => l.name ?? '' },
    { header: 'Company', width: 24, get: l => l.company ?? '' },
    { header: 'Email', width: 28, get: l => l.email ?? '' },
    { header: 'Phone', width: 16, get: l => l.phone ?? '' },
    { header: 'Store Location', width: 24, get: l => l.store_location ?? '' },
    { header: 'Store Condition', width: 16, get: l => l.store_condition ?? '' },
    { header: 'Store Type', width: 14, get: l => l.store_type ?? '' },
    { header: 'Message', width: 50, wrap: true, get: l => l.message ?? '' },
    { header: 'Notes', width: 40, wrap: true, get: l => l.notes ?? '' },
    { header: 'Internal Note', width: 36, wrap: true, get: l => l.internal_note ?? '' },
    { header: 'Linked Contact', width: 24, get: l => (l.prospect_id ? prospectName.get(l.prospect_id) ?? l.prospect_id : '') },
    { header: 'Handled By', width: 18, get: l => (l.handled_by ? handlerName.get(l.handled_by) ?? '' : '') },
    { header: 'Handled At', width: 18, get: l => fmt(l.handled_at) },
    { header: 'Privacy Accepted', width: 14, get: l => (l.consent_accepted ? 'Yes' : 'No') },
    { header: 'Consent Version', width: 14, get: l => l.consent_text_version ?? '' },
    { header: 'Consent At', width: 18, get: l => fmt(l.consent_at) },
    { header: 'Source Page', width: 30, get: l => l.source_page ?? '' },
    { header: 'UTM', width: 34, get: l => (l.utm ? Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(', ') : '') },
    { header: 'Updated', width: 18, get: l => fmt(l.updated_at) },
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trust-Lines Platform';
  wb.created = new Date();
  const ws = wb.addWorksheet('Website Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(c => ({ header: c.header, width: c.width }));

  const border: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'D1D5DB' } };
  const borders: Partial<ExcelJS.Borders> = { top: border, bottom: border, left: border, right: border };
  const header = ws.getRow(1);
  header.eachCell(cell => {
    cell.font = { bold: true, size: 10.5, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F2937' } };
    cell.border = borders;
    cell.alignment = { vertical: 'middle' };
  });
  header.height = 20;

  leads.forEach((l, i) => {
    const row = ws.addRow(columns.map(c => c.get(l)));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const wrap = !!columns[col - 1]?.wrap;
      cell.font = { size: 10 };
      cell.border = borders;
      cell.alignment = { vertical: 'top', wrapText: wrap };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  await logAudit({ actorId: user.id, action: 'web_lead.exported', resource: 'web_leads', newValue: { count: leads.length } });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="website-leads-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
