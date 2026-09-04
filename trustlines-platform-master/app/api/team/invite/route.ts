import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRequestUser } from '@/lib/permissions/requestUser';
import { logAudit } from '@/lib/audit/log';
import { isOffice, defaultCompanySideForRole, defaultDepartmentForRole } from '@/lib/profile/metadata';
import { appBaseUrl } from '@/lib/env/appUrl';
import type { UserRole } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

export async function POST(req: NextRequest) {
  const admin = adminDb();

  const caller = await resolveRequestUser(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized — no session found' }, { status: 401 });
  }
  const userId = caller.userId;
  const foundRole = caller.role;

  const body = await req.json() as {
    email: string;
    full_name: string;
    role: UserRole;
    pm_client_id?: string | null;
    is_pm_supervisor?: boolean;
    sales_region_id?: string | null;
    office?: string | null;
  };

  const { email, full_name, role, pm_client_id, is_pm_supervisor, sales_region_id, office } = body;
  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'email, full_name and role are required' }, { status: 400 });
  }

  if (office != null && office !== '' && !isOffice(office)) {
    return NextResponse.json({ error: 'Invalid office — expected turkey | syria | usa | other' }, { status: 400 });
  }

  const isAdmin = foundRole === 'ops_manager' || foundRole === 'general_manager';
  const isSalesManagerInvite = foundRole === 'sales_marketing_manager'
    && (role === 'sales_rep' || role === 'designer');
  if (!isAdmin && !isSalesManagerInvite) {
    return NextResponse.json(
      { error: 'Forbidden — ops_manager/general_manager, or sales_marketing_manager inviting a sales_rep or designer, only' },
      { status: 403 },
    );
  }

  async function applySalesScope(profileId: string) {
    if (role !== 'sales_rep') return;
    const { error } = await admin.from('profiles')
      .update({ sales_region_id: sales_region_id ?? null })
      .eq('id', profileId);
    if (error && !/column|schema cache/i.test(error.message ?? '')) console.error('[invite] sales scope:', error.message);
  }

  async function applyOrgMetadata(profileId: string) {
    const patch: Record<string, unknown> = {
      company_side: defaultCompanySideForRole(role),
      department: defaultDepartmentForRole(role),
    };
    if (office !== undefined) patch.office = office?.trim() || null;
    const { error } = await admin.from('profiles').update(patch).eq('id', profileId);
    if (error && !/column|schema cache/i.test(error.message ?? '')) console.error('[invite] org metadata:', error.message);
  }

  async function applyPmScope(profileId: string) {
    if (role !== 'tlines_pm') return;
    const { error } = await admin.from('profiles')
      .update({ pm_client_id: pm_client_id ?? null, is_pm_supervisor: !!is_pm_supervisor })
      .eq('id', profileId);
    if (error && !/column|schema cache/i.test(error.message ?? '')) console.error('[invite] pm scope:', error.message);
  }

  const redirectTo = `${appBaseUrl()}/auth/set-password`;
  console.log('[invite] sending invite | redirectTo:', redirectTo);

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo, data: { full_name, role } },
  );

  let newUserId: string;

  if (inviteError) {
    console.log('[invite] inviteUserByEmail error:', inviteError.message);
    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = listData?.users?.find((u: { id: string; email?: string }) => u.email === email);

    if (!existing) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, email_confirm: false, user_metadata: { full_name, role },
      });
      if (createErr || !created?.user?.id) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }
      newUserId = created.user.id;
      await admin.from('profiles').upsert({ id: newUserId, email, full_name, role, is_active: true });
      await applyPmScope(newUserId);
      await applySalesScope(newUserId);
      await applyOrgMetadata(newUserId);
      await logAudit({ actorId: userId, action: 'team.invited', resource: `profile:${newUserId}`, newValue: { email, role, office: office ?? null, emailSent: false } });
      return NextResponse.json({
        success: true, userId: newUserId, full_name, office: office?.trim() || null,
        emailSent: false, emailError: inviteError.message,
      });
    }

    newUserId = existing.id;
    await admin.from('profiles').upsert({ id: newUserId, email, full_name, role, is_active: true });
    await applyPmScope(newUserId);
    await applySalesScope(newUserId);
    await applyOrgMetadata(newUserId);

    const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    console.log('[invite] existing user — reset email sent:', resetErr ? resetErr.message : 'OK');
    await logAudit({ actorId: userId, action: 'team.invited', resource: `profile:${newUserId}`, newValue: { email, role, office: office ?? null, alreadyExisted: true } });
    return NextResponse.json({ success: true, userId: newUserId, alreadyExisted: true });
  }

  newUserId = inviteData.user?.id ?? '';
  if (!newUserId) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });

  await admin.from('profiles').upsert({ id: newUserId, email, full_name, role, is_active: true });
  await applyPmScope(newUserId);
  await applySalesScope(newUserId);
  await applyOrgMetadata(newUserId);

  await logAudit({ actorId: userId, action: 'team.invited', resource: `profile:${newUserId}`, newValue: { email, role, office: office ?? null } });
  return NextResponse.json({ success: true, userId: newUserId, full_name, office: office?.trim() || null });
}
