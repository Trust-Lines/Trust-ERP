import { NextRequest, NextResponse } from 'next/server';
import { itApi } from '@/lib/it/server';
import { logAudit } from '@/lib/audit/log';
import { call } from '@/lib/it/purelymail';
import { PURELYMAIL_OPS } from '@/lib/it/purelymailOps';
import { purelymailFailure } from '@/lib/it/purelymailHttp';

export const dynamic = 'force-dynamic';

// IT → Mails → Purelymail: every allow-listed operation (lib/it/purelymailOps) through one route.
//   POST { op, params } → 200 { result }   (result = only what that op hands to the browser)
// The op's own permission (page.it to read, edit.it to change) is checked before Purelymail is
// called; input is validated per op; changes are audit-logged without passwords.
// Failures: 400 bad input / unknown op, 401/403, 503 not configured, 502 unreachable, 422 refused.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { op?: unknown; params?: unknown } | null;
  const name = typeof body?.op === 'string' ? body.op : '';
  const def = Object.hasOwn(PURELYMAIL_OPS, name) ? PURELYMAIL_OPS[name] : null;

  const { ctx, deny } = await itApi(def?.need ?? 'manage');
  if (deny) return deny;
  if (!def) return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });

  const params = body?.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params as Record<string, unknown> : {};
  const input = def.clean(params);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const r = await call(name, input.value);
  if (!r.ok) return purelymailFailure(r);

  if (def.audit) {
    const a = def.audit(input.value);
    await logAudit({ actorId: ctx.userId, action: a.action, resource: a.resource, newValue: a.value });
  }
  return NextResponse.json({ result: def.pick ? def.pick(r.result) : null });
}
