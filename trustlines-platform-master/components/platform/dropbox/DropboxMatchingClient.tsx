'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleSlash, ExternalLink, FolderSearch, Link2, Loader2, RefreshCw, RotateCcw, ScanSearch, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Admin "Dropbox Matching": every project, the folder it points to, and the folders on the
// connected Dropbox that could be it (scored by lib/dropbox/match). A person decides; only the
// project's stored path changes — nothing is moved or renamed in Dropbox.

type Status = 'linked' | 'sure' | 'ambiguous' | 'none';
interface Candidate { path: string; score: number; reasons: string[] }
interface Row {
  project: { id: string; code: string | null; name: string | null; path: string | null };
  link: { status: 'confirmed' | 'no_folder'; path: string | null; decided_at: string } | null;
  status: Status;
  candidates: Candidate[];
}
interface Scan { folders: number; projectLike: number; remaining: number; done: boolean; meta: { startedAt: string; finishedAt: string | null } | null }
interface Data { account: { name?: string; email?: string; team?: string | null } | null; scan: Scan; rows: Row[] }

type Filter = 'todo' | 'sure' | 'linked' | 'decided' | 'all';

const STATUS_LABEL: Record<Status, string> = { linked: 'Folder found', sure: 'Sure match', ambiguous: 'Several candidates', none: 'Not found' };
const STATUS_TONE: Record<Status, string> = { linked: 't9', sure: 't3', ambiguous: 't7', none: 't10' };
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const dropboxUrl = (p: string) => `https://www.dropbox.com/home${encodeURI(p)}`;

export function DropboxMatchingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todo');
  const [manual, setManual] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/admin/dropbox-matching');
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setError(b.error ?? 'Could not load'); return; }
    setData(b);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/dropbox-matching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error ?? 'Request failed');
    return b;
  }

  async function scan(fresh = false) {
    if (fresh && !window.confirm('Forget the scanned folder list and scan the whole drive again?')) return;
    setScanning(true);
    try {
      if (fresh) await post({ action: 'rescan' });
      for (;;) {
        const s = await post({ action: 'scan' }) as Scan;
        setData(d => d ? { ...d, scan: s } : d);
        if (s.done || s.remaining === 0) break;
      }
      toast.success('Scan finished');
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Scan failed'); }
    finally { setScanning(false); }
  }

  async function act(id: string, body: Record<string, unknown>, ok: string) {
    setBusy(id);
    try { await post({ ...body, projectId: id }); toast.success(ok); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = useMemo(() => ({
    todo: rows.filter(r => !r.link && (r.status === 'ambiguous' || r.status === 'none')),
    sure: rows.filter(r => !r.link && r.status === 'sure'),
    linked: rows.filter(r => !r.link && r.status === 'linked'),
    decided: rows.filter(r => !!r.link),
    all: rows,
  }), [rows]);

  async function linkAllSure() {
    const list = groups.sure;
    if (!list.length || !window.confirm(`Link ${list.length} project${list.length === 1 ? '' : 's'} to their top match? Only the projects' stored paths change.`)) return;
    setBusy('bulk');
    let ok = 0;
    for (const r of list) {
      try { await post({ action: 'link', projectId: r.project.id, path: r.candidates[0].path }); ok++; }
      catch (e) { toast.error(`${r.project.code}: ${e instanceof Error ? e.message : 'failed'}`); }
    }
    setBusy(null);
    toast.success(`${ok} project${ok === 1 ? '' : 's'} linked`);
    await load();
  }

  if (error) return <div className="rounded-[8px] border border-ui-divider bg-ui-surface p-5 text-[13px] text-error-normal">{error}</div>;
  if (!data) return <div className="flex items-center gap-2 p-5 text-[13px] text-ui-text-secondary"><Loader2 size={14} className="animate-spin" /> Loading…</div>;

  const s = data.scan;
  const tabs: { key: Filter; label: string }[] = [
    { key: 'todo', label: 'Needs a decision' },
    { key: 'sure', label: 'Sure matches' },
    { key: 'linked', label: 'Folder found' },
    { key: 'decided', label: 'Decided' },
    { key: 'all', label: 'All' },
  ];
  const shown = groups[filter];

  return (
    <div className="flex flex-col gap-4">
      {/* Connected drive + scan */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[8px] border border-ui-divider bg-ui-surface p-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ui-text-secondary">Connected Dropbox</div>
          <div className={cn('text-[14px] font-semibold', HEADING)}>
            {data.account ? `${data.account.name ?? ''} · ${data.account.email ?? ''}${data.account.team ? ` · team ${data.account.team}` : ''}` : 'Not reachable'}
          </div>
        </div>
        <div className="text-[12px] text-ui-body">
          {s.folders ? <>{s.folders.toLocaleString()} folders scanned · <b>{s.projectLike.toLocaleString()}</b> project folders{s.remaining ? ` · ${s.remaining.toLocaleString()} to go` : ''}</> : 'Not scanned yet'}
          {s.meta?.finishedAt && <span className="text-ui-text-secondary"> · finished {new Date(s.meta.finishedAt).toLocaleString()}</span>}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void scan(false)} disabled={scanning}>
            {scanning ? <Loader2 className="animate-spin" /> : <ScanSearch />} {s.folders && !s.done ? 'Continue scan' : s.folders ? 'Scan for changes' : 'Scan Dropbox'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void scan(true)} disabled={scanning || !s.folders}><RotateCcw /> Rescan from scratch</Button>
          <Button size="sm" variant="ghost" onClick={() => void load()} aria-label="Reload"><RefreshCw /></Button>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button
            key={t.key} type="button" aria-pressed={filter === t.key} onClick={() => setFilter(t.key)}
            className="h-8 rounded-[4px] border border-ui-divider bg-ui-surface-elevated px-3 text-[12px] text-ui-body hover:bg-ui-hover-bg aria-pressed:border-[var(--color-secondary-700)] aria-pressed:font-semibold dark:aria-pressed:border-ui-heading"
          >
            {t.label} <span className="ml-1 text-ui-text-secondary">{groups[t.key].length}</span>
          </button>
        ))}
        {filter === 'sure' && groups.sure.length > 0 && (
          <Button size="sm" className="ml-auto" onClick={() => void linkAllSure()} disabled={busy === 'bulk'}>
            {busy === 'bulk' ? <Loader2 className="animate-spin" /> : <Link2 />} Link all {groups.sure.length}
          </Button>
        )}
      </div>

      {!s.folders && (
        <p className="m-0 rounded-[6px] bg-ui-surface-elevated px-3 py-2 text-[12px] text-ui-body">
          Scan the connected Dropbox first — it reads folder names only, down to project folders, and changes nothing.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-surface p-6 text-center text-[13px] text-ui-text-secondary">Nothing here.</div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map(r => {
            const id = r.project.id;
            const tone = STATUS_TONE[r.status];
            return (
              <li key={id} className="rounded-[8px] border border-ui-divider bg-ui-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[14px] font-semibold', HEADING)}>{r.project.code}</span>
                  <span className="min-w-0 truncate text-[13px] text-ui-body">{r.project.name}</span>
                  <span className="rounded-[4px] px-2 py-0.5 text-[11px]" style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>{STATUS_LABEL[r.status]}</span>
                  {r.link && (
                    <span className="inline-flex items-center gap-1 rounded-[4px] bg-ui-selected-bg px-2 py-0.5 text-[11px] text-ui-body">
                      {r.link.status === 'confirmed' ? <CheckCircle2 size={12} /> : <CircleSlash size={12} />}
                      {r.link.status === 'confirmed' ? 'Confirmed' : 'No folder on this drive'} · {new Date(r.link.decided_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1.5">
                    {r.status === 'linked' && !r.link && (
                      <Button size="xs" variant="outline" disabled={busy === id} onClick={() => void act(id, { action: 'confirm' }, 'Confirmed')}><CheckCircle2 /> Path is right</Button>
                    )}
                    {!r.link && (
                      <Button size="xs" variant="ghost" disabled={busy === id} onClick={() => void act(id, { action: 'no_folder' }, 'Marked: no folder')}><CircleSlash /> No folder</Button>
                    )}
                    {r.link && (
                      <Button size="xs" variant="ghost" disabled={busy === id} onClick={() => void act(id, { action: 'undo' }, 'Decision cleared')}><RotateCcw /> Undo</Button>
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-[11.5px]">
                  {r.status === 'linked' ? <CheckCircle2 size={13} className="mt-px shrink-0 text-[var(--status-t9-fg)]" /> : <XCircle size={13} className="mt-px shrink-0 text-ui-text-secondary" />}
                  <span className="break-all font-mono text-ui-text-secondary">{r.project.path ?? 'no folder stored'}</span>
                  {r.status !== 'linked' && r.project.path && <span className="shrink-0 text-ui-text-secondary">— not on this drive</span>}
                </div>

                {r.candidates.length > 0 && (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                    {r.candidates.map((c, i) => {
                      const current = c.path.toLowerCase() === r.project.path?.toLowerCase();
                      return (
                        <li key={c.path} className={cn('flex flex-wrap items-center gap-2 rounded-[6px] border px-3 py-2', i === 0 ? 'border-ui-divider bg-ui-surface-elevated' : 'border-transparent bg-ui-page-bg')}>
                          <span className={cn('w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums', HEADING)} title="Match score">{c.score}</span>
                          <span className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-ui-body">{c.path}</span>
                          <a href={dropboxUrl(c.path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-ui-text-secondary no-underline hover:underline"><ExternalLink size={12} /> Open</a>
                          {current
                            ? <span className="text-[11px] text-ui-text-secondary">stored</span>
                            : <Button size="xs" variant={i === 0 ? 'default' : 'outline'} disabled={busy === id} onClick={() => void act(id, { action: 'link', path: c.path }, 'Folder linked')}><Link2 /> Use this</Button>}
                          <div className="flex w-full flex-wrap gap-1 pl-11">
                            {c.reasons.map(x => <span key={x} className="rounded-[3px] bg-ui-selected-bg px-1.5 text-[10.5px] text-ui-body">{x}</span>)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <form
                  className="mt-3 flex gap-2"
                  onSubmit={e => { e.preventDefault(); const p = manual[id]?.trim(); if (p) void act(id, { action: 'link', path: p }, 'Folder linked'); }}
                >
                  <FolderSearch size={14} className="mt-2 shrink-0 text-ui-text-secondary" aria-hidden />
                  <input
                    value={manual[id] ?? ''} onChange={e => setManual(m => ({ ...m, [id]: e.target.value }))}
                    placeholder="Or paste the folder path, e.g. /D-Projects/T LINES/…/STNE 409 - …"
                    className="h-8 min-w-0 flex-1 rounded-[4px] border border-[var(--ui-input-border)] bg-ui-input-bg px-2.5 font-mono text-[11.5px] text-ui-body"
                  />
                  <Button size="sm" variant="outline" type="submit" disabled={busy === id || !manual[id]?.trim()}>Link path</Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
