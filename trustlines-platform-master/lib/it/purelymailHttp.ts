import { NextResponse } from 'next/server';
import type { PurelymailFailure } from './purelymail';

/** A Purelymail failure as the IT Mails routes answer it: 503 not configured, 422 refused
 *  (with Purelymail's short error code), 502 key refused / unreachable. No provider text. */
export function purelymailFailure(r: PurelymailFailure) {
  const status = r.reason === 'not_configured' ? 503 : r.reason === 'rejected' ? 422 : 502;
  return NextResponse.json({ code: r.reason, ...(r.reason === 'rejected' && r.code ? { providerCode: r.code } : {}) }, { status });
}
