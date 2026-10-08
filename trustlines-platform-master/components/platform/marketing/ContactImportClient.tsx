'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { readSpreadsheet, type SheetData } from '@/lib/client/readSpreadsheet';
import { autoMapColumns, detectHeaderRow } from '@/lib/marketing/import/columns';
import { buildPeople } from '@/lib/marketing/import/records';
import { buildGroups } from '@/lib/marketing/import/group';
import { planMerge } from '@/lib/marketing/import/merge';
import {
  IMPORT_FIELDS, IMPORT_FIELD_LABELS,
  type ColumnMapping, type ExistingMatch, type ImportAction, type ImportField, type ImportGroup, type ImportPerson,
} from '@/lib/marketing/import/types';

interface LoadedFile { id: string; name: string; sheets: SheetData[]; sheet: number; headerRow: number; mappings: ColumnMapping[] }
interface Campaign { id: string; name: string; status: string }
interface Decision { action: ImportAction | null; target: string | null }
interface Outcome { created: number; merged: number; skipped: number; contacts: number; failed: { label: string; error: string }[] }

const BATCH = 25;
const PAGE = 40;
const muted = { color: 'var(--fg-subtle)', fontSize: 12.5 } as const;
// Compact controls that still show their full text (a fixed 28–30px height clipped the labels).
const smallControl = { height: 'auto', minHeight: 36, padding: '6px 30px 6px 10px', fontSize: 13, lineHeight: 1.3 } as const;

function addedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
  return `Added ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} (${ago})`;
}

function analyse(sheet: SheetData) {
  const headerRow = detectHeaderRow(sheet.rows);
  const headers = (sheet.rows[headerRow] ?? []).map(String);
  return { headerRow, mappings: autoMapColumns(headers, sheet.rows.slice(headerRow + 1)) };
}

// The sheet that looks most like a contact list wins; the user can switch.
function bestSheet(sheets: SheetData[]): number {
  let best = 0; let bestScore = -1;
  sheets.forEach((s, i) => {
    const { mappings } = analyse(s);
    const score = mappings.filter(m => m.field !== 'ignore').length * 1000 + Math.min(s.rows.length, 999);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

function PersonLine({ p }: { p: ImportPerson }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.45 }}>
      <strong>{p.name ?? '(no name)'}</strong>{p.title ? <span style={muted}> · {p.title}</span> : null}
      <div style={muted}>{[p.email, p.phone].filter(Boolean).join(' · ') || 'no email / phone'}</div>
      {p.capturedAt && <div style={muted}>Captured {new Date(p.capturedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>}
    </div>
  );
}

export function ContactImportClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<Record<string, ExistingMatch[]> | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<'suspicious' | 'decide' | 'new' | 'all'>('suspicious');
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/marketing/campaigns').then(r => r.json()).then(b => {
      const list: Campaign[] = (b.campaigns ?? []).map((c: Campaign) => ({ id: c.id, name: c.name, status: c.status }));
      setCampaigns(list);
      setCampaignId(prev => prev || (list.find(c => /nacs/i.test(c.name)) ?? list[0])?.id || '');
    }).catch(() => {});
  }, []);

  const fileLabel = files.map(f => f.name).join(' + ') || 'Excel file';

  // Everything below is derived: change a mapping and rows/groups recompute.
  const { groups, rowCount, skipped } = useMemo(() => {
    const people: ImportPerson[] = [];
    let skippedEmpty = 0;
    for (const f of files) {
      const res = buildPeople(f.sheets[f.sheet].rows, f.headerRow, f.mappings, f.name.replace(/\.[^.]+$/, ''));
      people.push(...res.people);
      skippedEmpty += res.skippedEmpty;
    }
    return { groups: buildGroups(people), rowCount: people.length, skipped: skippedEmpty };
  }, [files]);

  function resetReview() { setMatches(null); setDecisions({}); setOutcome(null); setShown(PAGE); }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setReading(true);
    try {
      const loaded: LoadedFile[] = [];
      for (const file of Array.from(list)) {
        const sheets = await readSpreadsheet(file);
        const sheet = bestSheet(sheets);
        loaded.push({ id: `${file.name}-${Date.now()}-${loaded.length}`, name: file.name, sheets, sheet, ...analyse(sheets[sheet]) });
      }
      setFiles(prev => [...prev, ...loaded]);
      resetReview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read the file');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const patchFile = (id: string, fn: (f: LoadedFile) => LoadedFile) => { setFiles(prev => prev.map(f => (f.id === id ? fn(f) : f))); resetReview(); };
  const changeSheet = (id: string, sheet: number) => patchFile(id, f => ({ ...f, sheet, ...analyse(f.sheets[sheet]) }));
  const changeHeaderRow = (id: string, row1: number) => patchFile(id, f => {
    const headerRow = Math.max(0, Math.min(row1 - 1, f.sheets[f.sheet].rows.length - 1));
    const rows = f.sheets[f.sheet].rows;
    return { ...f, headerRow, mappings: autoMapColumns((rows[headerRow] ?? []).map(String), rows.slice(headerRow + 1)) };
  });
  // Every column we could not place, and that actually holds data, goes to Notes — nothing from the file gets lost.
  const ignoredToNotes = (id: string) => patchFile(id, f => ({
    ...f, mappings: f.mappings.map(m => (m.field === 'ignore' && !m.locked && m.sample.length > 0 ? { ...m, field: 'notes' as ImportField, basis: 'header' as const } : m)),
  }));
  const changeField = (id: string, index: number, field: ImportField) =>
    patchFile(id, f => ({ ...f, mappings: f.mappings.map(m => (m.index === index ? { ...m, field, basis: 'header', locked: true } : m)) }));

  async function checkDuplicates() {
    setChecking(true);
    try {
      const slim = groups.map(g => ({ id: g.id, company: g.company, people: g.people.map(p => ({ name: p.name, company: p.company, email: p.email, email2: p.email2, phone: p.phone, phone2: p.phone2 })) }));
      const res = await fetch('/api/marketing/import/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: slim }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not compare with existing Contacts'); return; }
      const found: Record<string, ExistingMatch[]> = body.matches ?? {};
      const initial: Record<string, Decision> = {};
      for (const g of groups) {
        const m = found[g.id];
        if (!m?.length) initial[g.id] = { action: 'create', target: null };
        else if (m[0].strength === 'strong') initial[g.id] = { action: 'merge', target: m[0].prospectId };
        else initial[g.id] = { action: null, target: m[0].prospectId };
      }
      setMatches(found); setDecisions(initial); setShown(PAGE);
      setFilter(Object.keys(found).length ? 'suspicious' : 'all');
    } finally { setChecking(false); }
  }

  const setDecision = (id: string, d: Decision) => setDecisions(prev => ({ ...prev, [id]: d }));
  const matchOf = (g: ImportGroup) => matches?.[g.id] ?? [];
  const isStrong = (g: ImportGroup) => matchOf(g)[0]?.strength === 'strong';
  const isPossible = (g: ImportGroup) => matchOf(g).length > 0 && !isStrong(g);

  const counts = useMemo(() => ({
    fresh: groups.filter(g => !(matches?.[g.id]?.length)).length,
    strong: groups.filter(g => matches?.[g.id]?.[0]?.strength === 'strong').length,
    possible: groups.filter(g => (matches?.[g.id]?.length ?? 0) > 0 && matches?.[g.id]?.[0]?.strength !== 'strong').length,
    undecided: groups.filter(g => decisions[g.id]?.action === null).length,
    mergedRows: groups.reduce((n, g) => n + g.mergedRows, 0),
  }), [groups, matches, decisions]);

  function bulk(pred: (g: ImportGroup) => boolean, action: ImportAction) {
    setDecisions(prev => {
      const next = { ...prev };
      for (const g of groups) if (pred(g)) next[g.id] = { action, target: action === 'merge' ? (matches?.[g.id]?.[0]?.prospectId ?? null) : (prev[g.id]?.target ?? null) };
      return next;
    });
  }

  const visible = groups.filter(g => {
    if (filter === 'decide') return decisions[g.id]?.action === null;
    if (filter === 'suspicious') return matchOf(g).length > 0;
    if (filter === 'new') return matchOf(g).length === 0;
    return true;
  });

  async function runImport() {
    const todo = groups.filter(g => decisions[g.id]?.action && decisions[g.id].action !== 'skip');
    const result: Outcome = { created: 0, merged: 0, skipped: groups.length - todo.length, contacts: 0, failed: [] };
    setImporting({ done: 0, total: todo.length });
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const res = await fetch('/api/marketing/import/commit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileLabel, campaignId: campaignId || undefined,
            groups: batch.map(g => ({ id: g.id, action: decisions[g.id].action, targetProspectId: decisions[g.id].target, company: g.company, people: g.people })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(body.error ?? 'Import stopped'); break; }
        for (const r of body.results as { id: string; action: ImportAction; contactsAdded: number; error?: string }[]) {
          const g = groups.find(x => x.id === r.id);
          if (r.error) result.failed.push({ label: g?.company ?? g?.people[0]?.name ?? r.id, error: r.error });
          else if (r.action === 'create') { result.created++; result.contacts += g?.people.length ?? 0; }
          else if (r.action === 'merge') { result.merged++; result.contacts += r.contactsAdded; }
        }
        setImporting({ done: Math.min(i + BATCH, todo.length), total: todo.length });
      }
    } finally {
      setImporting(null);
      setOutcome(result);
    }
  }

  const inReview = matches !== null && !outcome;

  return (
    <div style={{ maxWidth: 1100 }}>
      <Link href="/marketing/prospects" style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <ArrowLeft size={13} /> Contacts
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Import from Excel</h1>
      <p style={{ ...muted, margin: '0 0 18px', maxWidth: 760 }}>
        Add any spreadsheet (.xlsx, .xls, .csv) — columns are recognised automatically, repeated people are combined, and anything that
        looks like a Contact you already have is shown next to it so you decide: skip it, merge into it, or add it as new.
        Nothing is overwritten or deleted.
      </p>

      {outcome && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}><Check size={18} /> Import finished</h2>
            <div style={{ fontSize: 14 }}>
              <strong>{outcome.created}</strong> new Contacts · <strong>{outcome.merged}</strong> merged into existing · <strong>{outcome.skipped}</strong> skipped · <strong>{outcome.contacts}</strong> people added
            </div>
            {outcome.failed.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--status-danger-fg, #b91c1c)' }}>
                <strong>{outcome.failed.length} failed:</strong>
                <ul style={{ margin: '4px 0 0 18px' }}>{outcome.failed.slice(0, 15).map((f, i) => <li key={i}>{f.label} — {f.error}</li>)}</ul>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Link className="btn btn-primary btn-sm" href="/marketing/prospects">Open Contacts</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => { setFiles([]); resetReview(); }}>Import another file</button>
            </div>
          </div>
        </div>
      )}

      {!outcome && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: 18, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
                Event / campaign these leads belong to
                <select className="form-input" value={campaignId} onChange={e => setCampaignId(e.target.value)} style={{ minWidth: 260 }}>
                  <option value="">— none —</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <input ref={inputRef} type="file" multiple hidden accept=".xlsx,.xls,.csv" onChange={e => void addFiles(e.target.files)} />
              <button className="btn btn-primary" disabled={reading || !!importing} onClick={() => inputRef.current?.click()}>
                {reading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} <span style={{ marginLeft: 6 }}>{files.length ? 'Add another file' : 'Choose Excel files'}</span>
              </button>
            </div>

            {files.map(f => {
              const rows = f.sheets[f.sheet].rows;
              return (
                <div key={f.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <FileSpreadsheet size={16} />
                    <strong style={{ fontSize: 13.5 }}>{f.name}</strong>
                    <span style={muted}>{rows.length - f.headerRow - 1} rows</span>
                    {f.sheets.length > 1 && (
                      <select className="form-input" style={smallControl} value={f.sheet} onChange={e => changeSheet(f.id, Number(e.target.value))}>
                        {f.sheets.map((s, i) => <option key={s.name} value={i}>Sheet: {s.name} ({s.rows.length})</option>)}
                      </select>
                    )}
                    <label style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Header row
                      <input className="form-input" type="number" min={1} style={{ ...smallControl, width: 72 }} value={f.headerRow + 1} onChange={e => changeHeaderRow(f.id, Number(e.target.value) || 1)} />
                    </label>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} title="Remove this file" onClick={() => { setFiles(prev => prev.filter(x => x.id !== f.id)); resetReview(); }}><X size={14} /></button>
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--fg-subtle)' }}>
                      Columns recognised: {f.mappings.filter(m => m.field !== 'ignore').length} of {f.mappings.length} — check or change
                    </summary>
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" disabled={!f.mappings.some(m => m.field === 'ignore' && !m.locked && m.sample.length > 0)} onClick={() => ignoredToNotes(f.id)}>
                        Add all other columns to Notes
                      </button>
                      <span style={muted}>Each column becomes a labelled line on the Contact's Activity, in the same order as your file. Columns you set to “Ignore” yourself stay ignored.</span>
                    </div>
                    <div style={{ overflowX: 'auto', marginTop: 8 }}>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <thead><tr style={{ textAlign: 'left', color: 'var(--fg-subtle)' }}><th style={{ padding: 4 }}>Column in your file</th><th style={{ padding: 4 }}>Example values</th><th style={{ padding: 4 }}>Means</th></tr></thead>
                        <tbody>
                          {f.mappings.map(m => (
                            <tr key={m.index} style={{ borderTop: '1px solid var(--border-subtle)', opacity: m.field === 'ignore' ? 0.65 : 1 }}>
                              <td style={{ padding: 4, whiteSpace: 'nowrap' }}>{m.header}</td>
                              <td style={{ padding: 4, color: 'var(--fg-subtle)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sample.slice(0, 3).join(' · ') || '—'}</td>
                              <td style={{ padding: 4 }}>
                                <select className="form-input" style={smallControl} value={m.field} onChange={e => changeField(f.id, m.index, e.target.value as ImportField)}>
                                  {IMPORT_FIELDS.map(k => <option key={k} value={k}>{IMPORT_FIELD_LABELS[k]}</option>)}
                                </select>
                                {m.basis === 'content' && <span style={{ ...muted, marginLeft: 6 }}>guessed from values</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              );
            })}

            {files.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5 }}>
                  <strong>{rowCount}</strong> people found{skipped ? ` (${skipped} empty rows skipped)` : ''} → <strong>{groups.length}</strong> Contacts after combining repeats
                  {counts.mergedRows > 0 && ` (${counts.mergedRows} repeated rows folded together)`}
                </span>
                <button className="btn btn-primary" disabled={checking || groups.length === 0 || !!importing} onClick={() => void checkDuplicates()}>
                  {checking ? <Loader2 size={14} className="spin" /> : null} <span style={{ marginLeft: checking ? 6 : 0 }}>{matches ? 'Re-check against Contacts' : 'Check for duplicates'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {inReview && (
        <>
          <div className="card" style={{ marginBottom: 12, position: 'sticky', top: 0, zIndex: 5 }}>
            <div className="card-body" style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13.5 }}>
                <span><strong>{counts.fresh}</strong> new</span>
                <span style={{ color: '#0a7a3d' }}><strong>{counts.strong}</strong> already in Contacts</span>
                <span style={{ color: '#a16207' }}><strong>{counts.possible}</strong> look similar — your call</span>
                <span style={{ marginLeft: 'auto' }}>
                  {counts.undecided > 0 ? <strong style={{ color: '#a16207' }}>{counts.undecided} still need a decision</strong> : <strong style={{ color: '#0a7a3d' }}>All decided</strong>}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {([
                  ['suspicious', 'Only suspicious', counts.strong + counts.possible],
                  ['decide', 'Need decision', counts.undecided],
                  ['new', 'New only', counts.fresh],
                  ['all', 'Show all', groups.length],
                ] as const).map(([k, label, n]) => (
                  <button key={k} className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setFilter(k); setShown(PAGE); }}>{label} ({n})</button>
                ))}
                <span style={{ ...muted, margin: '0 4px 0 12px' }} title="Suspicious = already in Contacts, or looks similar to something that is">Bulk:</span>
                <button className="btn btn-ghost btn-sm" onClick={() => bulk(isStrong, 'merge')}>Merge all matches</button>
                <button className="btn btn-ghost btn-sm" onClick={() => bulk(isStrong, 'skip')}>Skip all matches</button>
                <button className="btn btn-ghost btn-sm" onClick={() => bulk(isPossible, 'create')}>Similar → add as new</button>
                <button className="btn btn-ghost btn-sm" onClick={() => bulk(isPossible, 'skip')}>Similar → skip</button>
                <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={counts.undecided > 0 || !!importing} onClick={() => void runImport()}>
                  {importing ? <><Loader2 size={14} className="spin" /> <span style={{ marginLeft: 6 }}>Importing {importing.done}/{importing.total}…</span></> : `Import ${groups.filter(g => decisions[g.id]?.action && decisions[g.id].action !== 'skip').length} Contacts`}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {visible.slice(0, shown).map(g => {
              const m = matchOf(g);
              const d = decisions[g.id] ?? { action: null, target: null };
              const target = m.find(x => x.prospectId === d.target) ?? m[0];
              const border = d.action === null ? '#e0a82e' : m.length ? 'var(--border-default)' : 'var(--border-subtle)';
              return (
                <div key={g.id} className="card" style={{ borderColor: border, borderWidth: d.action === null ? 2 : 1 }}>
                  <div className="card-body" style={{ padding: 14, display: 'grid', gridTemplateColumns: m.length ? '1fr 1fr' : '1fr', gap: 16 }}>
                    <div>
                      <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11, marginBottom: 4 }}>From your file</div>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.company ?? g.people[0]?.name ?? '(no name)'}</div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>{g.people.map((p, i) => <PersonLine key={i} p={p} />)}</div>
                      <div style={{ ...muted, marginTop: 6 }}>
                        {[...new Set(g.people.flatMap(p => p.sources.map(s => s.split(' · ')[0])))].join(', ')}
                        {g.mergedRows > 0 && ` · ${g.mergedRows} repeated row${g.mergedRows > 1 ? 's' : ''} combined`}
                      </div>
                      {g.warnings.map((w, i) => <div key={i} style={{ ...muted, color: '#a16207', display: 'flex', gap: 4, marginTop: 3 }}><AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}
                    </div>
                    {m.length > 0 && target && (
                      <div style={{ background: 'var(--bg-subtle, #f6f6f4)', borderRadius: 8, padding: 10 }}>
                        <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11, marginBottom: 4 }}>
                          Already in Contacts — {target.strength === 'strong' ? 'likely the same' : 'looks similar'}
                        </div>
                        {m.length > 1 && (
                          <select className="form-input" style={{ ...smallControl, marginBottom: 6 }} value={target.prospectId} onChange={e => setDecision(g.id, { ...d, target: e.target.value })}>
                            {m.map(x => <option key={x.prospectId} value={x.prospectId}>{x.displayName}</option>)}
                          </select>
                        )}
                        <Link href={`/marketing/prospects/${target.prospectId}`} target="_blank" style={{ fontWeight: 700, fontSize: 14, textDecoration: 'underline' }}>{target.displayName}</Link>
                        <div style={muted}>{[target.email, target.phone].filter(Boolean).join(' · ') || 'no email / phone'}</div>
                        {addedLabel(target.addedAt) && <div style={{ ...muted, fontWeight: 600 }}>{addedLabel(target.addedAt)}{target.sourceLabel ? ` · source: ${target.sourceLabel}` : ''}</div>}
                        {target.contacts.slice(0, 4).map(c => (
                          <div key={c.id} style={{ fontSize: 12.5, marginTop: 3 }}>{c.name}<span style={muted}> · {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</span></div>
                        ))}
                        <div style={{ ...muted, marginTop: 6 }}>{target.reasons.join(' · ')}</div>
                        {d.action === 'merge' && (() => {
                          const plan = planMerge(
                            { organizationName: target.organizationName, email: target.email, phone: target.phone, website: target.website, businessTypes: target.businessTypes },
                            target.contacts.map(c => ({ id: c.id, name: c.name, title: c.title, email: c.email, phone: c.phone, otherContact: c.otherContact })),
                            g,
                          );
                          const { adds, newPeople, keeps } = plan.summary;
                          return (
                            <div style={{ marginTop: 8, borderTop: '1px dashed var(--border-default)', paddingTop: 6, fontSize: 12.5 }}>
                              <div style={{ fontWeight: 700 }}>If you merge</div>
                              <div style={muted}>Everything already on this Contact stays exactly as it is.</div>
                              {adds.length > 0 && <div style={{ color: '#0a7a3d' }}>+ Fills empty fields: {adds.join(' · ')}</div>}
                              {newPeople.length > 0 && <div style={{ color: '#0a7a3d' }}>+ Adds {newPeople.length === 1 ? 'a person' : 'people'}: {newPeople.join(', ')}</div>}
                              {keeps.length > 0 && <div style={{ color: '#a16207' }}>Different in your file — your existing value stays, the file's value goes into the Activity note: {keeps.join(' · ')}</div>}
                              <div style={muted}>+ An Activity note with the imported info is added.</div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 14px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    {(m.length ? ([['create', 'Add as new'], ['merge', 'Merge into the existing one'], ['skip', 'Skip (don\'t import)']] as const) : ([['create', 'Add as new'], ['skip', 'Skip']] as const)).map(([k, label]) => (
                      <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input type="radio" name={`d-${g.id}`} checked={d.action === k}
                          onChange={() => setDecision(g.id, { action: k, target: k === 'merge' ? (d.target ?? m[0]?.prospectId ?? null) : d.target })} />
                        {label}
                      </label>
                    ))}
                    {d.action === null && <span style={{ color: '#a16207', fontWeight: 600 }}>Choose one</span>}
                  </div>
                </div>
              );
            })}
            {visible.length > shown && <button className="btn btn-ghost" onClick={() => setShown(s => s + PAGE)}>Show more ({visible.length - shown} left)</button>}
            {visible.length === 0 && <div style={{ ...muted, padding: 20, textAlign: 'center' }}>Nothing in this view.</div>}
          </div>
        </>
      )}
    </div>
  );
}
