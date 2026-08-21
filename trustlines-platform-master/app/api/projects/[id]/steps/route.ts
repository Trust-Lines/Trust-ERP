import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any)
    .from('project_steps')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ steps: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;

  const body = await request.json() as {
    phase: string;
    step_key: string;
    cat_group?: string | null;
    status: string;
    document_id?: string | null;
    version_approved?: number | null;
    completed_by?: string | null;
    completed_at?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    notes?: string | null;
  };

  const { data: existing } = await sb
    .from('project_steps')
    .select('id')
    .eq('project_id', id)
    .eq('phase', body.phase)
    .eq('step_key', body.step_key)
    .is('cat_group', body.cat_group ?? null)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await sb
      .from('project_steps')
      .update({
        status:          body.status,
        document_id:     body.document_id ?? undefined,
        version_approved: body.version_approved ?? undefined,
        completed_by:    body.completed_by ?? undefined,
        completed_at:    body.completed_at ?? undefined,
        approved_by:     body.approved_by ?? undefined,
        approved_at:     body.approved_at ?? undefined,
        notes:           body.notes ?? undefined,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    const { data, error } = await sb
      .from('project_steps')
      .insert({
        project_id:      id,
        phase:           body.phase,
        step_key:        body.step_key,
        cat_group:       body.cat_group ?? null,
        status:          body.status,
        document_id:     body.document_id ?? null,
        version_approved: body.version_approved ?? null,
        completed_by:    body.completed_by ?? null,
        completed_at:    body.completed_at ?? null,
        approved_by:     body.approved_by ?? null,
        approved_at:     body.approved_at ?? null,
        notes:           body.notes ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  await logAudit({
    actorId:   user.id,
    action:    `step.${body.status}`,
    projectId: id,
    resource:  `${body.phase}/${body.step_key}${body.cat_group ? `/${body.cat_group}` : ''}`,
    newValue:  { status: body.status },
  });
  return NextResponse.json({ step: result });
}
