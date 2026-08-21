import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { userCan } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

const HOLD_ROLES = ['tlines_pm', 'general_manager', 'ops_manager'];

type PiRow = { id: string; status: string; pre_hold_status?: string | null; hold_note?: string | null };

async function selectItems(admin: { from: (t: string) => { select: (c: string) => unknown } }, projectId: string, type: string): Promise<{ rows: PiRow[]; hasHoldCols: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (cols: string) => (admin as any).from('production_items').select(cols)
    .eq('project_id', projectId).eq('type', type).eq('source', 'project').is('deleted_at', null);
  let res = await base('id, status, pre_hold_status, hold_note') as { data: PiRow[] | null; error: { message?: string } | null };
  if (res.error && /column|schema cache/i.test(res.error.message ?? '')) {
    res = await base('id, status') as { data: PiRow[] | null; error: { message?: string } | null };
    return { rows: res.data ?? [], hasHoldCols: false };
  }
  return { rows: res.data ?? [], hasHoldCols: true };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;
  const catGroup = new URL(req.url).searchParams.get('catGroup');
  if (!catGroup) return NextResponse.json({ onHold: false, note: null, ordered: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const type = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const { rows } = await selectItems(admin, projectId, type);

  const onHold = rows.some(r => r.status === 'HOLD_T');
  const note   = rows.find(r => r.status === 'HOLD_T' && r.hold_note)?.hold_note ?? null;
  const ordered = rows.some(r => r.status === 'ORDERED' || (r.status === 'HOLD_T' && r.pre_hold_status === 'ORDERED'));
  return NextResponse.json({ onHold, note, ordered });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId } = await params;

  const { catGroup, release, note } = await req.json() as { catGroup: string; release?: boolean; note?: string };
  if (!catGroup) return NextResponse.json({ error: 'catGroup required' }, { status: 400 });
  if (!release && !note?.trim()) {
    return NextResponse.json({ error: 'A reason is required to put the order on HOLD / T' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', user.id).single() as { data: { role: string; full_name: string } | null };
  const role = profile?.role ?? '';
  if (!HOLD_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Only Client PM or General Manager can use HOLD / T' }, { status: 403 });
  }

  const type = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
  const holdNote = release ? null : (note?.trim() ?? null);
  const now = new Date().toISOString();

  const { rows, hasHoldCols } = await selectItems(admin, projectId, type);
  const wasOrdered = rows.some(r => r.status === 'ORDERED' || (r.status === 'HOLD_T' && r.pre_hold_status === 'ORDERED'));

  for (const r of rows) {
    if (release) {
      const restored = hasHoldCols ? (r.pre_hold_status ?? 'NOT_ORDERED') : 'NOT_ORDERED';
      const fields = hasHoldCols
        ? { status: restored, pre_hold_status: null, hold_note: null, updated_at: now }
        : { status: restored, updated_at: now };
      await admin.from('production_items').update(fields).eq('id', r.id);
    } else {
      const prev = r.status === 'HOLD_T' ? (r.pre_hold_status ?? null) : r.status;
      const fields = hasHoldCols
        ? { status: 'HOLD_T', pre_hold_status: prev, hold_note: holdNote, updated_at: now }
        : { status: 'HOLD_T', updated_at: now };
      await admin.from('production_items').update(fields).eq('id', r.id);
    }
  }

  if (!release) {
    try {
      const { data: project } = await admin.from('projects')
        .select('name, code, trustlines_pm_id, tlines_pm_id, prod_pm_ms_id, prod_pm_ci_id')
        .eq('id', projectId).single() as {
          data: { name: string; code: string; trustlines_pm_id: string | null; tlines_pm_id: string | null; prod_pm_ms_id: string | null; prod_pm_ci_id: string | null } | null;
        };
      const isMS = ['Millwork', 'Shelving'].includes(type);
      const prodPmId = isMS ? project?.prod_pm_ms_id : project?.prod_pm_ci_id;
      const ids = [project?.trustlines_pm_id, project?.tlines_pm_id, prodPmId].filter(Boolean) as string[];

      const { data: globals } = await admin.from('profiles').select('id, role').in('role', ['general_manager', 'accountant']) as { data: { id: string; role: string }[] | null };
      for (const g of globals ?? []) ids.push(g.id);

      const candidateIds = [...new Set(ids)].filter(id => id !== user.id);
      const uniqueIds: string[] = [];
      for (const id of candidateIds) if (await userCan(admin, id, 'notify.hold_t')) uniqueIds.push(id);
      if (uniqueIds.length) {
        const { data: people } = await admin.from('profiles').select('email, full_name').in('id', uniqueIds) as { data: { email: string | null; full_name: string }[] | null };
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const orderedLine = wasOrdered
          ? `<p style="color:#b91c1c;font-weight:bold">⚠️ This ${type} order was already ORDERED when it was put on hold.</p>`
          : '';
        for (const p of people ?? []) {
          if (!p.email) continue;
          await sendEmail(
            p.email,
            `[Trust-Lines] HOLD / T — ${type} on ${project?.name ?? projectId}`,
            `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
              <p>Hi ${p.full_name},</p>
              <p><b>${profile?.full_name ?? 'A manager'}</b> put the <b>${type}</b> order on <b>HOLD / T</b>
              for project <b>${project?.name ?? ''}</b> (${project?.code ?? ''}).</p>
              ${orderedLine}
              <p><b>Reason:</b> ${holdNote}</p>
              <p><a href="${appUrl}/projects/${projectId}" style="color:#1a6b6b;font-weight:bold">Open the project →</a></p>
            </div>`,
          );
        }
      }
    } catch (e) { console.error('[po-hold] notify failed:', e); }
  }

  await logAudit({ actorId: user.id, action: release ? 'po.hold_released' : 'po.hold_t', projectId, resource: type, newValue: release ? undefined : { note: holdNote, wasOrdered } });
  return NextResponse.json({ ok: true, status: release ? 'released' : 'HOLD_T', note: holdNote, wasOrdered });
}
