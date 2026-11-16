'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingState } from '@/components/ui/feedback-states';
import { cn } from '@/lib/utils';

// Admin "ClickUp Review": what the nightly ClickUp sync held back. A held ClickUp contact looks like
// a record someone added by hand (same email / phone); a skipped project waits for such a contact.
// A person decides: same person → link (the app record gets the ClickUp id, its projects come in
// tonight), or someone else → added as new tonight.

interface Match { table: 'prospects' | 'prospect_contacts'; id: string; name: string; email: string | null; phone: string | null; prospectId: string | null }
interface Held { region: string; name: string; ref: string; note?: string; email?: string | null; phone?: string | null; match?: { table: Match['table']; id: string; name: string }; matchRecord: Match | null }
interface Skipped { region: string; name: string; ref: string; note?: string; contactRef?: string | null }
interface Data {
  checkedAt: string | null;
  source: 'nightly' | 'check' | null;
  held: Held[];
  skipped: Skipped[];
  decisions: Record<string, { decision: 'link' | 'add_new'; at: string }>;
}

const REGION: Record<string, string> = { TLINES_NE: 'NE', TLINES_SE: 'SE', TLINES_NW: 'NW', CVW: 'West' };
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const TH = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.2px] text-ui-text-secondary';
const TD = 'px-3 py-2.5 align-top text-[13px] text-ui-body';

export function ClickUpReviewClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/clickup-review', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not load');
      setData(json as Data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function checkNow() {
    setChecking(true);
    try {
      const res = await fetch('/api/clickup-review/check', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Check failed');
      toast.success(`Checked ClickUp — ${json.held} held contacts, ${json.skipped} waiting projects`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Check failed'); }
    finally { setChecking(false); }
  }

  async function decide(h: Held, decision: 'link' | 'add_new') {
    setBusy(h.ref);
    try {
      const res = await fetch('/api/clickup-review/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: h.ref, decision, name: h.name, matchTable: h.match?.table, matchId: h.match?.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Could not save');
      setData(d => d && { ...d, decisions: { ...d.decisions, [h.ref]: { decision, at: new Date().toISOString() } } });
      toast.success(decision === 'link' ? `Linked to ${h.matchRecord?.name ?? h.match?.name} — its projects come in tonight` : `${h.name} will be added tonight`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(null); }
  }

  const held = useMemo(() => (data?.held ?? []).filter(h => filter === 'all' || !data?.decisions[h.ref]), [data, filter]);
  const nameByRef = useMemo(() => new Map((data?.held ?? []).map(h => [h.ref, h.name])), [data]);
  const todo = (data?.held ?? []).filter(h => !data?.decisions[h.ref]).length;

  if (error) return <ErrorState title="Couldn’t load the ClickUp review" description={error} actions={<Button variant="outline" size="sm" onClick={() => void load()}>Try again</Button>} />;
  if (!data) return <LoadingState title="ClickUp Review" description="Reading the last ClickUp sync…" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-ui-divider bg-ui-surface px-4 py-3">
        <div className="text-[13px] text-ui-body">
          {data.checkedAt
            ? <>Last checked <strong>{fmt(data.checkedAt)}</strong> ({data.source === 'check' ? 'Check now' : 'nightly sync'}). The sync runs every night; decisions here take effect on the next run.</>
            : 'The ClickUp sync hasn’t run yet.'}
        </div>
        <Button variant="outline" size="toolbar" onClick={() => void checkNow()} disabled={checking} aria-busy={checking}>
          {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {checking ? 'Checking ClickUp… (about a minute)' : 'Check now'}
        </Button>
      </div>

      <section aria-labelledby="held-h" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="held-h" className="m-0 text-[16px] font-semibold text-ui-heading">Held contacts <span className="text-ui-text-secondary">({todo} to decide)</span></h2>
          <div role="group" aria-label="Show" className="flex h-9 items-center gap-0.5 rounded-[6px] border border-ui-divider bg-ui-input-bg p-[2px]">
            {(['todo', 'all'] as const).map(f => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                className={cn('h-[30px] cursor-pointer rounded-[5px] border-0 px-3 text-[13px]', filter === f ? 'bg-[var(--ui-btn-solid)] font-semibold text-[var(--ui-btn-solid-fg)]' : 'bg-transparent text-ui-body hover:bg-ui-hover-bg')}>
                {f === 'todo' ? 'To decide' : 'All'}
              </button>
            ))}
          </div>
        </div>
        {held.length === 0 ? (
          <EmptyState boxed icon={<CheckCircle2 />} title={todo === 0 ? 'Nothing waiting' : 'No contacts'} description="Every held ClickUp contact has a decision." />
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-ui-divider bg-ui-surface">
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-ui-divider">
                <th className={TH}>ClickUp contact</th><th className={TH}>Looks like (in the app)</th><th className={TH}>Region</th><th className={cn(TH, 'text-right')}>Decision</th>
              </tr></thead>
              <tbody>
                {held.map(h => {
                  const d = data.decisions[h.ref];
                  const m = h.matchRecord;
                  return (
                    <tr key={h.ref} className="border-b border-ui-divider last:border-0">
                      <td className={TD}>
                        <div className="font-semibold text-ui-heading">{h.name}</div>
                        <div className="text-[12px] text-ui-text-secondary">{[h.email, h.phone].filter(Boolean).join(' · ') || '—'}</div>
                      </td>
                      <td className={TD}>
                        {m ? (
                          <>
                            <div className="flex items-center gap-1 font-semibold text-ui-heading">
                              {m.name}
                              {m.prospectId && <Link href={`/marketing/prospects/${m.prospectId}`} target="_blank" aria-label={`Open ${m.name}`} className="text-ui-link"><ExternalLink size={13} aria-hidden /></Link>}
                            </div>
                            <div className="text-[12px] text-ui-text-secondary">{[m.email, m.phone].filter(Boolean).join(' · ') || '—'}{m.table === 'prospect_contacts' ? ' · contact person' : ''}</div>
                          </>
                        ) : <span className="text-ui-text-secondary">{h.note ?? '—'}</span>}
                      </td>
                      <td className={TD}>{REGION[h.region] ?? h.region}</td>
                      <td className={cn(TD, 'text-right')}>
                        {d ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[12px] font-semibold" style={{ background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)' }}>
                            <CheckCircle2 size={13} aria-hidden />{d.decision === 'link' ? 'Linked — projects come tonight' : 'Added as new tonight'}
                          </span>
                        ) : (
                          <span className="inline-flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" disabled={!h.match || busy === h.ref} onClick={() => void decide(h, 'link')}
                              title={h.match ? `Same person as ${m?.name ?? h.match.name}: link them` : 'Run “Check now” first to see which record it looks like'}>
                              <Link2 aria-hidden />Same person, link
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy === h.ref} onClick={() => void decide(h, 'add_new')}>
                              <UserPlus aria-hidden />Different, add new
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.held.some(h => !h.match && !data.decisions[h.ref]) && (
          <p className="m-0 text-[12px] text-ui-text-secondary">Rows without a “looks like” record come from a report made before this screen existed — press <strong>Check now</strong> to see them.</p>
        )}
      </section>

      <section aria-labelledby="skipped-h" className="flex flex-col gap-2">
        <h2 id="skipped-h" className="m-0 text-[16px] font-semibold text-ui-heading">Projects waiting for a contact <span className="text-ui-text-secondary">({data.skipped.length})</span></h2>
        {data.skipped.length === 0 ? (
          <EmptyState boxed icon={<CheckCircle2 />} title="No projects waiting" />
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-ui-divider bg-ui-surface">
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-ui-divider">
                <th className={TH}>ClickUp project</th><th className={TH}>Region</th><th className={TH}>Why it’s waiting</th>
              </tr></thead>
              <tbody>
                {data.skipped.map(s => {
                  const waitsFor = s.contactRef ? nameByRef.get(s.contactRef) : undefined;
                  const decided = s.contactRef ? data.decisions[s.contactRef] : undefined;
                  return (
                    <tr key={s.ref} className="border-b border-ui-divider last:border-0">
                      <td className={cn(TD, 'font-semibold text-ui-heading')}>{s.name}</td>
                      <td className={TD}>{REGION[s.region] ?? s.region}</td>
                      <td className={TD}>
                        {waitsFor ? <>Waits for <strong>{waitsFor}</strong>{decided ? ' — decided, comes in tonight' : ' (decide above)'}</> : s.note ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
