import { NextRequest, NextResponse } from 'next/server';
import { createClient, requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canAdvanceStage, getNextStage, STAGE_PHASE } from '@/lib/workflow/machine';
import type { ProjectStage } from '@/types/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const body = await req.json() as { override_reason?: string };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRows } = await (admin as any)
    .from('profiles').select('role').eq('id', user.id).limit(1);
  const profileRole = (profileRows as { role: string }[] | null)?.[0]?.role ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const projectRes = await supabase.from('projects').select('current_stage').eq('id', id).single();

  const project = projectRes.data as { current_stage: ProjectStage } | null;
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { allowed, reason } = canAdvanceStage(project.current_stage);
  const canOverride = ['ops_manager', 'general_manager'].includes(profileRole ?? '');

  if (!allowed && !canOverride) {
    return NextResponse.json({ error: reason }, { status: 403 });
  }

  const nextStage = getNextStage(project.current_stage);
  if (!nextStage) return NextResponse.json({ error: 'Already at final stage' }, { status: 400 });

  const nextPhase = STAGE_PHASE[nextStage];

  await sb.from('projects')
    .update({ current_stage: nextStage, current_phase: nextPhase })
    .eq('id', id);

  await sb.from('stage_transitions').insert({
    project_id:      id,
    from_stage:      project.current_stage,
    to_stage:        nextStage,
    transitioned_by: user.id,
    is_override:     !allowed && canOverride,
    override_reason: body.override_reason ?? null,
  }).then(() => null).catch(() => null);

  await supabase.from('audit_log').insert({
    project_id: id,
    actor_id:   user.id,
    action:     'stage.advanced',
    old_value:  { stage: project.current_stage },
    new_value:  { stage: nextStage },
  } as never);

  return NextResponse.json({ success: true, newStage: nextStage });
}
