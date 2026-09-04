import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { datesForStatusChange, type DateField } from '@/lib/production/board';
import { sendEmail } from '@/lib/email/send';
import { roleCan, userCan } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/log';
import { appBaseUrl } from '@/lib/env/appUrl';

type Params = { params: Promise<{ id: string }> };

const ITEM_SEL = 'id, status, std, etd, rtd, rtr, rdy, ftd, snd, pf_code, pf_usd';

const fmtUsd = (n: number | null | undefined) => `$ ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export async function GET(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;
  const catGroup   = req.nextUrl.searchParams.get('catGroup') ?? '';
  const vendorCode = req.nextUrl.searchParams.get('vendorCode') ?? '';
  if (!catGroup || !vendorCode) return NextResponse.json({ status: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const type = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const { data: vendor } = await admin.from('suppliers').select('id').eq('code', vendorCode).maybeSingle() as { data: { id: string } | null };
  if (!vendor) return NextResponse.json({ status: null });
  const { data: item } = await admin.from('production_items')
    .select('status').eq('project_id', projectId).eq('type', type).eq('vendor_id', vendor.id)
    .eq('source', 'project').is('deleted_at', null).maybeSingle() as { data: { status: string } | null };
  return NextResponse.json({ status: item?.status ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const { catGroup, vendorCode, status, etd } = await req.json() as { catGroup: string; vendorCode: string; status: string; etd?: string };
  if (!catGroup || !vendorCode || !status) return NextResponse.json({ error: 'catGroup, vendorCode, status required' }, { status: 400 });
  if (status === 'ORDERED' && !etd) {
    return NextResponse.json({ error: 'ETD_REQUIRED' }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const type = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);

  const { data: vendor } = await admin.from('suppliers').select('id, name').eq('code', vendorCode).maybeSingle() as { data: { id: string; name: string } | null };
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  let { data: item } = await admin.from('production_items').select(ITEM_SEL)
    .eq('project_id', projectId).eq('type', type).eq('vendor_id', vendor.id)
    .eq('source', 'project').is('deleted_at', null).maybeSingle() as {
      data: { id: string; status: string; std: string | null; etd: string | null; rtd: string | null; rtr: string | null; rdy: string | null; ftd: string | null; snd: string | null; pf_code: string | null; pf_usd: number | null } | null;
    };
  if (!item) {
    const { data: created } = await admin.from('production_items')
      .insert({ project_id: projectId, source: 'project', type, vendor_id: vendor.id, status: 'NOT_ORDERED' })
      .select(ITEM_SEL).single() as { data: typeof item };
    item = created;
  }
  if (!item) return NextResponse.json({ error: 'Could not resolve item' }, { status: 500 });

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  const dates = datesForStatusChange(status, { std: item.std, etd: item.etd, rtd: item.rtd, rtr: item.rtr, rdy: item.rdy, ftd: item.ftd, snd: item.snd });
  for (const [f, v] of Object.entries(dates)) patch[f as DateField] = v;
  if (status === 'ORDERED' && etd) patch.etd = etd;

  await admin.from('production_items').update(patch).eq('id', item.id);
  await logAudit({ actorId: user.id, action: 'pf.status_changed', projectId, resource: `${type} ${vendorCode} → ${status}` });

  try {
    if (['WAITING_PAYMENT', 'READY_TO_RECEIVE', 'READY'].includes(status)) {
      const { data: project } = await admin.from('projects').select('name, code, tlines_pm_id').eq('id', projectId).single() as {
        data: { name: string; code: string; tlines_pm_id: string | null } | null;
      };
      const appUrl = appBaseUrl();
      const pfLabel = item.pf_code ?? `${type} / ${vendor.name}`;
      const amount  = fmtUsd(item.pf_usd);
      const link    = `<p><a href="${appUrl}/projects/${projectId}" style="color:#1a6b6b;font-weight:bold">Open the project →</a></p>`;

      const mailRole = async (role: string, notifyKey: string, subject: string, body: string) => {
        if (!await roleCan(admin, role, notifyKey)) return;
        const { data: people } = await admin.from('profiles').select('email, full_name').eq('role', role) as { data: { email: string | null; full_name: string }[] | null };
        for (const p of people ?? []) if (p.email) await sendEmail(p.email, subject, `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><p>Hi ${p.full_name},</p>${body}${link}</div>`);
      };
      const mailId = async (id: string | null, notifyKey: string, subject: string, body: string) => {
        if (!id || !await userCan(admin, id, notifyKey)) return;
        const { data: p } = await admin.from('profiles').select('email, full_name').eq('id', id).single() as { data: { email: string | null; full_name: string } | null };
        if (p?.email) await sendEmail(p.email, subject, `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><p>Hi ${p.full_name},</p>${body}${link}</div>`);
      };

      if (status === 'WAITING_PAYMENT') {
        await mailRole('accountant', 'notify.payment',
          `[Trust-Lines] Payment due — ${pfLabel} (${project?.name ?? ''})`,
          `<p>PF <b>${pfLabel}</b> is <b>WAITING PAYMENT</b>.</p><p><b>Amount:</b> ${amount}</p>`);
      } else if (status === 'READY_TO_RECEIVE') {
        await mailRole('accountant', 'notify.payment',
          `[Trust-Lines] Pay remaining balance — ${pfLabel} (${project?.name ?? ''})`,
          `<p>PF <b>${pfLabel}</b> is <b>READY TO RECEIVE</b>. Please pay the remaining balance.</p><p><b>PF total:</b> ${amount}</p>`);
      } else if (status === 'READY') {
        await mailId(project?.tlines_pm_id ?? null, 'notify.ready',
          `[Trust-Lines] READY — ${pfLabel} (${project?.name ?? ''})`,
          `<p>PF <b>${pfLabel}</b> is <b>READY</b> for installation.</p>`);
      }
    }
  } catch (e) { console.error('[pf-status] notify failed:', e); }

  return NextResponse.json({ ok: true, status });
}
