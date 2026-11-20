'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD, MUTED, STRONG } from './itCardParts';

// IT → Mails: the Purelymail account's mailboxes (GET /api/it/mails/purelymail). Read-only for now
// — creating, deleting, passwords and routing come later. Nothing is stored in our database.

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; addresses: string[] }
  | { kind: 'not_configured' }
  | { kind: 'error'; message: string };

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Purelymail refused the API key. Check PURELYMAIL_API_KEY on the server.',
  unavailable: 'Purelymail could not be reached or did not answer in time. Try again.',
};

export function PurelymailMailboxes() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/it/mails/purelymail', { cache: 'no-store' });
      const body = await res.json().catch(() => null) as { mailboxes?: { address: string }[]; code?: string; error?: string } | null;
      if (res.ok && Array.isArray(body?.mailboxes)) { setState({ kind: 'ok', addresses: body.mailboxes.map(m => m.address) }); return; }
      if (body?.code === 'not_configured') { setState({ kind: 'not_configured' }); return; }
      setState({
        kind: 'error',
        message: res.status === 401 || res.status === 403 ? 'You don’t have access to IT mailboxes.' : ERROR_TEXT[body?.code ?? ''] ?? ERROR_TEXT.unavailable,
      });
    } catch {
      setState({ kind: 'error', message: ERROR_TEXT.unavailable });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-labelledby="purelymail-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-solid border-primary-100 pt-6 dark:border-primary-600">
        <div className="flex flex-col gap-1">
          <h2 id="purelymail-heading" className={cn('m-0 flex items-center gap-2 text-[18px] font-semibold leading-[1.35]', STRONG)}>
            Purelymail
            {state.kind === 'ok' && (
              <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
                <span className="sr-only">Mailboxes: </span>{state.addresses.length}
              </span>
            )}
          </h2>
          <p className="m-0 text-[13px] text-ui-body">Mailboxes on the company’s Purelymail account, read live.</p>
        </div>
        <button
          type="button" onClick={() => void load()} disabled={state.kind === 'loading'}
          className={cn(FIELD, 'inline-flex items-center gap-2 font-medium transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ui-hover-bg')}
        >
          <RefreshCw size={16} aria-hidden className={state.kind === 'loading' ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      {state.kind === 'loading' ? (
        <p role="status" className={cn('m-0 text-[13px]', MUTED)}>Loading mailboxes…</p>
      ) : state.kind === 'not_configured' ? (
        <div role="note" className="rounded-md border border-dashed border-primary-300 px-4 py-3 text-[13px] text-ui-body dark:border-primary-600">
          Purelymail isn’t connected yet. Add <code className="font-mono">PURELYMAIL_API_KEY</code> to the server’s environment, then refresh.
        </div>
      ) : state.kind === 'error' ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {state.message}
        </div>
      ) : state.addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-10 text-center dark:border-primary-600">
          <p className={cn('m-0 text-[15px] font-semibold', STRONG)}>No mailboxes on Purelymail</p>
          <p className="m-0 text-[13px] text-ui-body">The account is connected but has no mailboxes yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ui-divider bg-ui-surface">
                <th scope="col" className="h-10 px-4 text-left text-[12px] font-semibold text-ui-body">Address</th>
              </tr>
            </thead>
            <tbody>
              {state.addresses.map(a => (
                <tr key={a} className="border-b border-ui-divider last:border-b-0">
                  <td className={cn('h-11 px-4 text-[13px]', STRONG)}>
                    <span className="inline-flex items-center gap-2"><Mail size={16} aria-hidden className={MUTED} />{a}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
