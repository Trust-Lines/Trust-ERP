import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const body = await request.json() as {
    action:     string;
    projectId?: string | null;
    resource?:  string | null;
    oldValue?:  unknown;
    newValue?:  unknown;
  };

  if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  await logAudit({
    actorId:   user.id,
    action:    body.action,
    projectId: body.projectId,
    resource:  body.resource,
    oldValue:  body.oldValue,
    newValue:  body.newValue,
  });

  return NextResponse.json({ success: true });
}
