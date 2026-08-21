import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';

export async function POST(request: NextRequest) {
  const { user, admin: sb, deny } = await requireRole(['ops_manager', 'admin']);
  if (deny) return deny;

  const { data: projects, error: projErr } = await sb
    .from('projects')
    .select('id, closed_deal_date')
    .not('closed_deal_date', 'is', null);

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });

  const { data: existingSteps } = await sb
    .from('project_steps')
    .select('project_id')
    .eq('phase', 'phase1')
    .eq('step_key', 'closed_deal');

  const alreadyDone = new Set(
    ((existingSteps ?? []) as { project_id: string }[]).map(s => s.project_id),
  );

  const toInsert = ((projects ?? []) as { id: string; closed_deal_date: string }[])
    .filter(p => !alreadyDone.has(p.id))
    .map(p => ({
      project_id:   p.id,
      phase:        'phase1',
      step_key:     'closed_deal',
      cat_group:    null,
      status:       'done',
      completed_by: user.id,
      completed_at: new Date(p.closed_deal_date).toISOString(),
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: 'All projects already have the closed_deal step.', updated: 0 });
  }

  const { error: insertErr } = await sb.from('project_steps').insert(toInsert);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ message: `Backfilled ${toInsert.length} project(s).`, updated: toInsert.length });
}
