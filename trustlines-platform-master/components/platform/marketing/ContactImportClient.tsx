'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Ban, Check, ChevronRight, ChevronsUpDown, ExternalLink, FileSpreadsheet, FolderInput, Forward, ListFilter, Loader2, MoreHorizontal, SquarePlus, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readSpreadsheet, type SheetData } from '@/lib/client/readSpreadsheet';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/client/compressImage';
import type { SheetImage } from '@/lib/marketing/import/images';
import { importPhotoName } from '@/lib/marketing/import/photos';
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
interface Outcome { created: number; merged: number; skipped: number; contacts: number; needs: number; photos: number; photosFailed: number; unlinked: number; failed: { label: string; error: string }[] }

const BATCH = 25;
const PAGE = 40;
const muted = { color: 'var(--ui-text-secondary)', fontSize: 12 } as const;

// Figma "Import from Excel" (node 265:20364): source card on the left, match preview on the right.
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CARD = 'rounded-[8px] border border-ui-divider bg-ui-page-bg p-5';
const LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const NAVY_BTN = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-5 text-[13px] font-medium text-white no-underline hover:brightness-110 disabled:cursor-default disabled:opacity-50 dark:bg-[var(--ui-tab-badge)] [&_svg]:size-4';
const OUTLINE_BTN = 'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[12px] font-medium text-ui-body no-underline hover:bg-ui-hover-bg disabled:cursor-default disabled:opacity-50 [&_svg]:size-3.5';
const TONE_BTN = 'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border-0 px-4 text-[13px] font-medium hover:brightness-95 disabled:opacity-50 [&_svg]:size-4';
const CHIP = 'inline-flex cursor-pointer items-center rounded-[6px] border border-ui-input-border bg-ui-input-bg px-2.5 py-1 text-[12px] text-ui-body hover:bg-ui-hover-bg';
const CHECKBOX_CLS = 'size-4 cursor-pointer accent-[var(--color-secondary-700)]';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg disabled:cursor-default disabled:opacity-50';
const DECISION_LABEL: Record<ImportAction | 'none', string> = { create: 'Add as new', merge: 'Merge', skip: 'Skip', none: 'Choose one' };
const FIELD = { minHeight: 42, fontSize: 14, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)' } as const;
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

// A short fingerprint of the picture's bytes, so the same picture imported twice gets the same name.
async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const mimeOf = (ext: string) => `image/${ext === 'jpg' ? 'jpeg' : ext}`;

function PersonLine({ p, thumbs = [] }: { p: ImportPerson; thumbs?: string[] }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ui-body)' }}>
      <strong>{p.name ?? '(no name)'}</strong>{p.title ? <span style={muted}> · {p.title}</span> : null}
      <div style={muted}>{[p.email, p.phone].filter(Boolean).join(' · ') || 'no email / phone'}</div>
      {(p.whatsapp || p.status) && <div style={muted}>{[p.whatsapp ? 'WhatsApp ✓' : null, p.status ? `Status: ${p.status}` : null].filter(Boolean).join(' · ')}</div>}
      {thumbs.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }} title={`${thumbs.length} picture${thumbs.length === 1 ? '' : 's'} from this row will be added to the Contact`}>
          {thumbs.slice(0, 4).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ui-divider)' }} />
          ))}
          <span style={muted}>📷 {thumbs.length}{thumbs.length > 4 ? ' (+' + (thumbs.length - 4) + ' more)' : ''}</span>
        </div>
      )}
      {p.capturedAt && <div style={muted}>Captured {new Date(p.capturedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>}
    </div>
  );
}

export function ContactImportClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [files, setFiles] = useState<LoadedFile[]>([]);
  // The file whose sheet / header row / columns are open in the right panel (null = Match Preview).
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<Record<string, ExistingMatch[]> | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<'suspicious' | 'strong' | 'possible' | 'decide' | 'new' | 'all'>('suspicious');
  const [createNeeds, setCreateNeeds] = useState(true);
  // What happened to each card when it was imported (one by one or in bulk).
  const [done, setDone] = useState<Record<string, { state: 'running' | 'ok' | 'error'; message: string; prospectId: string | null }>>({});
  const [shown, setShown] = useState(PAGE);
  // Match Preview table (Figma 265:20364): ticked rows, expanded rows, row menu, column sort.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'field' | 'type' | 'status' | 'decision' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const menuRef = useRef<HTMLDivElement>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/marketing/import/campaigns').then(r => r.json()).then(b => {
      const list: Campaign[] = (b.campaigns ?? []).map((c: Campaign) => ({ id: c.id, name: c.name, status: c.status }));
      setCampaigns(list);
      setCampaignId(prev => prev || (list.find(c => /nacs/i.test(c.name)) ?? list[0])?.id || '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  const fileLabel = files.map(f => f.name).join(' + ') || 'Excel file';
  const campaignName = campaigns.find(c => c.id === campaignId)?.name ?? '';

  // Everything below is derived: change a mapping and rows/groups recompute.
  const { groups, rowCount, skipped, photoIndex } = useMemo(() => {
    const people: ImportPerson[] = [];
    let skippedEmpty = 0;
    const index = new Map<string, { image: SheetImage; caption: string }>();
    for (const f of files) {
      const sheet = f.sheets[f.sheet];
      const byRow = new Map<number, string[]>();
      for (const image of sheet.images) {
        const id = `${f.id}|${image.id}`;
        const header = (sheet.rows[f.headerRow]?.[image.col] ?? '').trim();
        index.set(id, { image, caption: header ? `${header} (${f.name})` : f.name });
        byRow.set(image.row, [...(byRow.get(image.row) ?? []), id]);
      }
      const res = buildPeople(sheet.rows, f.headerRow, f.mappings, f.name.replace(/\.[^.]+$/, ''), byRow);
      people.push(...res.people);
      skippedEmpty += res.skippedEmpty;
    }
    return { groups: buildGroups(people), rowCount: people.length, skipped: skippedEmpty, photoIndex: index };
  }, [files]);

  // Small previews of the pictures found in the file (revoked when the files change).
  const thumbs = useMemo(() => {
    const map = new Map<string, string>();
    photoIndex.forEach(({ image }, id) => map.set(id, URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: mimeOf(image.ext) }))));
    return map;
  }, [photoIndex]);
  useEffect(() => () => { thumbs.forEach(url => URL.revokeObjectURL(url)); }, [thumbs]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  function resetReview() { setDone({}); setMatches(null); setDecisions({}); setOutcome(null); setShown(PAGE); setPicked(new Set()); setExpanded(new Set()); setMenuFor(null); }

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
      if (loaded[0]) setActiveFileId(loaded[0].id);
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
      setActiveFileId(null);
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
    if (filter === 'strong') return isStrong(g);
    if (filter === 'possible') return isPossible(g);
    if (filter === 'new') return matchOf(g).length === 0;
    return true;
  });

  const nameOf = (g: ImportGroup) => g.company ?? g.people[0]?.name ?? '(no name)';
  function statusOf(g: ImportGroup): { label: string; color: string; rank: number } {
    if (done[g.id]?.state === 'ok') return { label: 'Imported', color: 'var(--status-t6-fg)', rank: 3 };
    if (isStrong(g)) return { label: 'Duplicate', color: 'var(--status-t6-fg)', rank: 1 };
    if (isPossible(g)) return { label: 'Possible duplicate', color: 'var(--status-t7-fg)', rank: 2 };
    return { label: 'New', color: 'var(--ui-body)', rank: 0 };
  }
  function toggleExpanded(id: string) {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const DECISION_RANK: Record<ImportAction | 'none', number> = { none: 0, create: 1, merge: 2, skip: 3 };
  const sortedVisible = !sortKey ? visible : [...visible].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'field') return dir * nameOf(a).localeCompare(nameOf(b));
    if (sortKey === 'type') return dir * (Number(!!a.company) - Number(!!b.company));
    if (sortKey === 'status') return dir * (statusOf(a).rank - statusOf(b).rank);
    return dir * (DECISION_RANK[decisions[a.id]?.action ?? 'none'] - DECISION_RANK[decisions[b.id]?.action ?? 'none']);
  });
  const pageRows = sortedVisible.slice(0, shown);

  type CommitRow = { id: string; action: ImportAction; prospectId: string | null; contactsAdded: number; linked?: boolean; needCreated?: boolean; contactIds?: (string | null)[]; error?: string };

  async function commitBatch(batch: ImportGroup[]): Promise<CommitRow[]> {
    const res = await fetch('/api/marketing/import/commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileLabel, campaignId: campaignId || undefined, createNeeds,
        groups: batch.map(g => ({ id: g.id, action: decisions[g.id].action, targetProspectId: decisions[g.id].target, company: g.company, people: g.people })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Import failed');
    return body.results as CommitRow[];
  }

  const photoCount = (g: ImportGroup) => new Set(g.people.flatMap(p => p.photos ?? [])).size;

  // Sends each picture of the group to its Contact (Dropbox + Files tab + Activity). Never throws.
  async function uploadPhotosFor(g: ImportGroup, r: CommitRow): Promise<{ ok: number; failed: number; lastError: string }> {
    const sum = { ok: 0, failed: 0, lastError: '' };
    if (!r.prospectId || r.error) return sum;
    for (const [i, person] of g.people.entries()) {
      for (const id of new Set(person.photos ?? [])) {
        const entry = photoIndex.get(id);
        if (!entry) continue;
        try {
          let file = new File([entry.image.bytes as BlobPart], `photo.${entry.image.ext}`, { type: mimeOf(entry.image.ext) });
          if (file.size > MAX_UPLOAD_BYTES) file = await compressImage(file); // a phone photo can be several MB
          if (file.size > MAX_UPLOAD_BYTES) throw new Error('the picture is too large (max 4 MB)');
          const form = new FormData();
          form.append('prospectId', r.prospectId);
          form.append('contactId', r.contactIds?.[i] ?? '');
          form.append('campaignId', campaignId);
          form.append('caption', entry.caption);
          form.append('name', importPhotoName(await sha1Hex(entry.image.bytes), file.name.split('.').pop() ?? entry.image.ext));
          form.append('file', file);
          const res = await fetch('/api/marketing/import/photo', { method: 'POST', body: form });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? 'upload failed');
          sum.ok++;
        } catch (e) {
          sum.failed++;
          sum.lastError = e instanceof Error ? e.message : String(e);
        }
      }
    }
    return sum;
  }

  const photoText = (p: { ok: number; failed: number; lastError: string }) =>
    [p.ok ? ` · ${p.ok} photo${p.ok === 1 ? '' : 's'} added` : '', p.failed ? ` · ⚠ ${p.failed} photo${p.failed === 1 ? '' : 's'} failed (${p.lastError})` : ''].join('');

  function rememberResult(r: CommitRow) {
    const message = r.error ? r.error
      : r.action === 'create' ? `Created${r.contactsAdded ? ` with ${r.contactsAdded} ${r.contactsAdded === 1 ? 'person' : 'people'}` : ''}${r.needCreated ? ' + project need' : ''}`
      : r.action === 'merge' ? `Merged${r.contactsAdded ? ` — ${r.contactsAdded} ${r.contactsAdded === 1 ? 'person' : 'people'} added` : ''}`
      : 'Skipped';
    setDone(prev => ({ ...prev, [r.id]: { state: r.error ? 'error' : 'ok', message, prospectId: r.prospectId } }));
  }

  // One card at a time, so you can see exactly what happened (and the exact error, if any).
  async function importOne(g: ImportGroup) {
    setDone(prev => ({ ...prev, [g.id]: { state: 'running', message: 'Importing…', prospectId: null } }));
    try {
      const [r] = await commitBatch([g]);
      rememberResult(r);
      if (!r.error && photoCount(g) > 0) {
        setDone(prev => ({ ...prev, [g.id]: { ...prev[g.id], message: `${prev[g.id].message} · uploading ${photoCount(g)} photo(s)…` } }));
        const p = await uploadPhotosFor(g, r);
        setDone(prev => ({ ...prev, [g.id]: { ...prev[g.id], message: prev[g.id].message.replace(/ · uploading.*$/, '') + photoText(p) } }));
      }
      if (r.error) toast.error(r.error); else if (r.linked === false) toast.message('Imported, but not linked to the event yet — apply migration 125.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';
      setDone(prev => ({ ...prev, [g.id]: { state: 'error', message, prospectId: null } }));
      toast.error(message);
    }
  }

  // `only` limits the run to the ticked rows ("Import Selected"); without it, every decided row.
  async function runImport(only?: Set<string>) {
    const inScope = (g: ImportGroup) => !only || only.has(g.id);
    const todo = groups.filter(g => inScope(g) && decisions[g.id]?.action && decisions[g.id].action !== 'skip' && done[g.id]?.state !== 'ok');
    const result: Outcome = { created: 0, merged: 0, skipped: groups.filter(g => inScope(g) && decisions[g.id]?.action === 'skip').length, contacts: 0, needs: 0, photos: 0, photosFailed: 0, unlinked: 0, failed: [] };
    setImporting({ done: 0, total: todo.length });
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        let rows: CommitRow[];
        try { rows = await commitBatch(batch); } catch (e) { toast.error(e instanceof Error ? e.message : 'Import stopped'); break; }
        for (const r of rows) {
          rememberResult(r);
          const g = groups.find(x => x.id === r.id);
          if (g && !r.error && photoCount(g) > 0) {
            setPhotoNote(`photos for ${g.company ?? g.people[0]?.name ?? 'row'}`);
            const p = await uploadPhotosFor(g, r);
            result.photos += p.ok; result.photosFailed += p.failed;
            setDone(prev => ({ ...prev, [g.id]: { ...prev[g.id], message: prev[g.id].message + photoText(p) } }));
          }
          if (!r.error && r.linked === false) result.unlinked++;
          if (!r.error && r.needCreated) result.needs++;
          if (r.error) result.failed.push({ label: g?.company ?? g?.people[0]?.name ?? r.id, error: r.error });
          else if (r.action === 'create') { result.created++; result.contacts += g?.people.length ?? 0; }
          else if (r.action === 'merge') { result.merged++; result.contacts += r.contactsAdded; }
        }
        setImporting({ done: Math.min(i + BATCH, todo.length), total: todo.length });
      }
    } finally {
      setImporting(null);
      setPhotoNote(null);
      if (only) {
        // A partial run keeps the table open so the remaining rows can still be decided/imported;
        // each imported row already shows its ✓ / ✗ result.
        const parts = [`${result.created} added`, `${result.merged} merged`];
        if (result.failed.length) toast.error(`${parts.join(' · ')} · ${result.failed.length} failed`);
        else toast.success(`Imported selected: ${parts.join(' · ')}`);
      } else {
        setOutcome(result);
      }
    }
  }

  // One-click starting points; every card can still be changed afterwards.
  function preset(kind: 'new_only' | 'new_and_merge' | 'all_new') {
    setDecisions(prev => {
      const next = { ...prev };
      for (const g of groups) {
        if (done[g.id]?.state === 'ok') continue;
        const m = matches?.[g.id] ?? [];
        const strong = m[0]?.strength === 'strong';
        if (!m.length) next[g.id] = { action: 'create', target: null };
        else if (kind === 'new_only') next[g.id] = { action: 'skip', target: m[0].prospectId };
        else if (kind === 'new_and_merge') next[g.id] = strong ? { action: 'merge', target: m[0].prospectId } : { action: 'skip', target: m[0].prospectId };
        else next[g.id] = { action: 'create', target: null };
      }
      return next;
    });
  }

  const inReview = matches !== null;
  const activeFile = files.find(f => f.id === activeFileId) ?? null;
  const showFile = !!activeFile && !outcome;
  const toImport = groups.filter(g => decisions[g.id]?.action && decisions[g.id].action !== 'skip' && done[g.id]?.state !== 'ok').length;
  const selectedToImport = groups.filter(g => picked.has(g.id) && decisions[g.id]?.action && decisions[g.id].action !== 'skip' && done[g.id]?.state !== 'ok').length;
  const selectedUndecided = groups.filter(g => picked.has(g.id) && decisions[g.id]?.action === null).length;
  const FILTERS = [
    ['suspicious', 'Only suspicious', counts.strong + counts.possible],
    ['strong', 'Already in Contacts', counts.strong],
    ['possible', 'Look similar', counts.possible],
    ['decide', 'Need decision', counts.undecided],
    ['new', 'New only', counts.fresh],
    ['all', 'Show all', groups.length],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <Link href="/marketing/prospects" className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-ui-nav-active no-underline">
          <ArrowLeft size={12} aria-hidden /> Marketing / Contacts
        </Link>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Import from Excel</h1>
        <p className="m-0 max-w-[820px] text-[13px] text-ui-body">
          Add any spreadsheet (.xlsx, .xls, .csv) — columns are recognised automatically, repeated people are combined, and anything that
          looks like a Contact you already have is shown next to it so you decide: skip it, merge into it, or add it as new.
          Nothing is overwritten or deleted.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* ── Left: source files + settings ─────────────────────────── */}
        <section className={cn(CARD, 'flex flex-col gap-6')} aria-labelledby="import-total-title">
          <div>
            <h2 id="import-total-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>
              Total {groups.length} Contact{groups.length === 1 ? '' : 's'}
            </h2>
            <p className="m-0 text-[11px] text-ui-text-secondary">
              {rowCount} people found{skipped ? ` · ${skipped} empty rows skipped` : ''}
              {counts.mergedRows > 0 ? ` · ${counts.mergedRows} repeated rows combined` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex min-w-0 flex-col">
              <span className={LABEL}>Event/Campaign <span style={{ color: 'var(--status-t10-fg)' }}>*</span></span>
              <select className="form-input" value={campaignId} onChange={e => setCampaignId(e.target.value)} style={FIELD} aria-label="Event or campaign these leads belong to">
                <option value="">— choose one —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label
              className="flex min-w-0 flex-col"
              title="Fills the Needs and Potentials tabs of every NEW Contact, the same way survey leads get them. Merged Contacts are not given a new need."
            >
              <span className={LABEL}>Survey Leads (need + potential)</span>
              <select className="form-input" value={createNeeds ? 'yes' : 'no'} onChange={e => setCreateNeeds(e.target.value === 'yes')} style={FIELD}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={cn('text-[12px] font-semibold', HEADING_TEXT)}>Uploads · {files.length} file{files.length === 1 ? '' : 's'}</span>
              <input ref={inputRef} type="file" multiple hidden accept=".xlsx,.xls,.csv" onChange={e => void addFiles(e.target.files)} />
              <button type="button" className={OUTLINE_BTN} disabled={reading || !!importing} onClick={() => inputRef.current?.click()}>
                {reading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {files.length ? 'Add file' : 'Choose files'}
              </button>
            </div>

            {files.length === 0 && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={reading}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-[8px] border-2 border-dashed border-ui-input-border bg-transparent px-4 py-8 text-center text-[12px] text-ui-text-secondary hover:bg-ui-hover-bg"
              >
                <FileSpreadsheet size={28} aria-hidden />
                Choose one or more Excel / CSV files
              </button>
            )}

            {/* Figma 259:17677 — pick a file here; its sheet / header row / columns open on the right. */}
            {files.map(f => {
              const rows = f.sheets[f.sheet].rows;
              const isActive = activeFile?.id === f.id;
              return (
                <div key={f.id} className="border-b border-ui-divider py-2">
                  <div className={cn('flex items-start gap-1 rounded-[6px]', isActive && 'bg-ui-selected-bg')}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      title="Show this file's sheet, header row and columns"
                      onClick={() => setActiveFileId(f.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[6px] border-0 bg-transparent px-2.5 py-2 text-left font-[inherit] hover:bg-ui-hover-bg"
                    >
                      <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-ui-body" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px]', HEADING_TEXT)}>{f.name}</span>
                        <span className="block text-[11px] text-ui-text-secondary">
                          {Math.max(0, rows.length - f.headerRow - 1)} rows · {f.mappings.filter(m => m.field !== 'ignore').length} of {f.mappings.length} columns recognised
                          {f.sheets[f.sheet].images.length > 0 ? ` · 📷 ${f.sheets[f.sheet].images.length}` : ''}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mt-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-text-secondary hover:bg-ui-hover-bg"
                      title="Remove this file" aria-label={`Remove ${f.name}`}
                      onClick={() => {
                        setFiles(prev => prev.filter(x => x.id !== f.id));
                        if (isActive) setActiveFileId(null);
                        resetReview();
                      }}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="m-0 text-[11px] text-ui-text-secondary">
            Nothing is written until you import. Existing Contacts are never overwritten — merges only fill empty fields and add an Activity note.
          </p>

          <div className="flex items-center justify-between gap-3">
            <Link href="/marketing/prospects" className={OUTLINE_BTN}><ArrowLeft aria-hidden /> Back</Link>
            <button
              type="button" className={NAVY_BTN}
              disabled={checking || groups.length === 0 || !campaignId || !!importing}
              title={!campaignId ? 'Choose the event / campaign first' : undefined}
              onClick={() => void checkDuplicates()}
            >
              {checking && <Loader2 className="animate-spin" aria-hidden />} {matches ? 'Re-check against Contacts' : 'Check for duplicates'}
            </button>
          </div>
        </section>

        {/* ── Right: selected file's columns, or match preview / decisions / result ── */}
        {showFile && activeFile ? (
          <section className={cn(CARD, 'flex min-w-0 flex-col gap-5 bg-ui-surface')} aria-labelledby="import-file-title">
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet size={20} className="shrink-0 text-ui-body" aria-hidden />
              <h2 id="import-file-title" className={cn('m-0 min-w-0 truncate text-[17px] font-semibold', HEADING_TEXT)}>{activeFile.name}</h2>
              <span className="text-[12px] text-ui-body">{Math.max(0, activeFile.sheets[activeFile.sheet].rows.length - activeFile.headerRow - 1)} rows</span>
              {inReview && (
                <button type="button" className={cn(OUTLINE_BTN, 'ml-auto')} onClick={() => setActiveFileId(null)}>
                  <ArrowLeft aria-hidden /> Match Preview
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-divider pb-5">
              <select
                className="form-input" aria-label="Sheet" style={{ ...FIELD, maxWidth: 270 }}
                value={activeFile.sheet} onChange={e => changeSheet(activeFile.id, Number(e.target.value))}
                disabled={activeFile.sheets.length < 2}
              >
                {activeFile.sheets.map((s, i) => <option key={s.name} value={i}>Sheet: {s.name} ({s.rows.length})</option>)}
              </select>
              <label className="inline-flex items-center gap-2.5 text-[13px] text-ui-body">
                Header row:
                <input
                  className="form-input" type="number" min={1} style={{ ...FIELD, minHeight: 36, width: 72 }}
                  value={activeFile.headerRow + 1} onChange={e => changeHeaderRow(activeFile.id, Number(e.target.value) || 1)}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button" className={OUTLINE_BTN}
                disabled={!activeFile.mappings.some(m => m.field === 'ignore' && !m.locked && m.sample.length > 0)}
                onClick={() => ignoredToNotes(activeFile.id)}
              >
                Add all other columns to Notes
              </button>
              <span className="text-[11px] text-ui-text-secondary">
                Each column becomes a labelled line on the Contact&apos;s Activity, in your file&apos;s order. Columns you set to “Ignore” yourself stay ignored.
              </span>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
              <div className="max-h-[640px] overflow-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 z-[1] bg-ui-surface">
                    <tr className="border-b border-ui-divider text-left text-[11px] text-ui-body">
                      <th className="h-[38px] px-5 font-medium">Column</th>
                      <th className="h-[38px] px-3 font-medium">Values</th>
                      <th className="h-[38px] px-3 font-medium">Means</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFile.mappings.map(m => (
                      <tr key={m.index} className="border-b border-ui-divider last:border-b-0 text-ui-body" style={{ opacity: m.field === 'ignore' ? 0.7 : 1 }}>
                        <td className="whitespace-nowrap px-5 py-1.5">{m.header || `Column ${m.index + 1}`}</td>
                        <td className="max-w-[260px] truncate px-3 py-1.5">{m.sample.slice(0, 3).join(' · ') || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <select
                            className="form-input" value={m.field}
                            onChange={e => changeField(activeFile.id, m.index, e.target.value as ImportField)}
                            aria-label={`Meaning of column ${m.header || m.index + 1}`}
                            style={{ ...smallControl, minHeight: 26, padding: '2px 26px 2px 8px', fontSize: 12, width: 'auto', borderRadius: 4, borderColor: 'var(--color-secondary-700)', color: 'var(--color-secondary-700)' }}
                          >
                            {IMPORT_FIELDS.map(k => <option key={k} value={k}>{IMPORT_FIELD_LABELS[k]}</option>)}
                          </select>
                          {m.basis === 'content' && <span className="ml-1.5 text-[11px] text-ui-text-secondary">guessed from values</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
        <section className={cn(CARD, 'flex min-w-0 flex-col gap-4')} aria-labelledby="import-preview-title">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="import-preview-title" className={cn('m-0 text-[17px] font-semibold', HEADING_TEXT)}>
              {outcome ? 'Import finished' : 'Match Preview'}
            </h2>
            {inReview && !outcome && (
              <label className="inline-flex items-center gap-1.5 text-[12px] text-ui-body">
                <ListFilter size={14} aria-hidden />
                <select className="form-input" style={smallControl} value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setShown(PAGE); }} aria-label="Filter matches">
                  {FILTERS.map(([k, label, n]) => <option key={k} value={k}>{label} ({n})</option>)}
                </select>
              </label>
            )}
            {inReview && !outcome && (
              <span className="ml-auto flex flex-wrap items-center gap-2.5">
                {/* While rows are ticked these "all" actions are greyed out — the selection bar
                    above the table acts on the ticked rows instead (Figma 270:6985). */}
                <button
                  type="button" className={TONE_BTN}
                  disabled={picked.size > 0}
                  style={picked.size > 0
                    ? { background: 'var(--ui-hover-bg)', color: 'var(--ui-text-secondary)' }
                    : { background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)', boxShadow: 'inset 0 0 0 1px var(--status-t10-fg)' }}
                  onClick={() => { bulk(isStrong, 'skip'); bulk(isPossible, 'skip'); }}
                  title="Skip every Contact that is already in Contacts or looks similar — only the new ones stay set to import"
                >
                  <Ban aria-hidden /> Skip All Matches
                </button>
                <button
                  type="button" className={NAVY_BTN}
                  disabled={picked.size > 0 || counts.undecided > 0 || !campaignId || !!importing || toImport === 0}
                  title={counts.undecided > 0 ? `${counts.undecided} still need a decision` : `Import ${toImport} Contacts into ${campaignName}`}
                  onClick={() => void runImport()}
                >
                  {importing
                    ? <><Loader2 className="animate-spin" aria-hidden /> Importing {importing.done}/{importing.total}…{photoNote ? ` · ${photoNote}` : ''}</>
                    : <><FolderInput aria-hidden /> Import All ({toImport})</>}
                </button>
              </span>
            )}
          </div>

          {outcome && (
            <div className="flex flex-col gap-3 text-[13px] text-ui-body">
              <div className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--status-t6-fg)' }}><Check size={18} aria-hidden /> Done</div>
              <div>
                <strong>{outcome.created}</strong> new Contacts · <strong>{outcome.merged}</strong> merged into existing · <strong>{outcome.skipped}</strong> skipped · <strong>{outcome.contacts}</strong> people added
                {outcome.needs > 0 && <> · <strong>{outcome.needs}</strong> project needs / potentials created</>}
                {outcome.photos > 0 && <> · <strong>{outcome.photos}</strong> photos added</>}
                {outcome.photosFailed > 0 && <span style={{ color: 'var(--status-t10-fg)' }}> · {outcome.photosFailed} photos failed</span>}
              </div>
              {outcome.unlinked > 0 && (
                <div style={{ color: 'var(--status-t7-fg)' }}>
                  <strong>{outcome.unlinked} Contacts were not linked to {campaignName || 'the event'}</strong> (they won&apos;t show under the event filter or &quot;Shows attended&quot; yet). Apply migration 125 in Supabase, then import again — already-imported Contacts will show as matches to merge.
                </div>
              )}
              {outcome.failed.length > 0 && (
                <div style={{ color: 'var(--status-t10-fg)' }}>
                  <strong>{outcome.failed.length} failed:</strong>
                  <ul className="mb-0 ml-[18px] mt-1">{outcome.failed.slice(0, 15).map((f, i) => <li key={i}>{f.label} — {f.error}</li>)}</ul>
                </div>
              )}
              <div className="flex gap-2.5">
                <Link className={NAVY_BTN} href="/marketing/prospects">Open Contacts</Link>
                <button type="button" className={OUTLINE_BTN} onClick={() => { setFiles([]); resetReview(); }}>Import another file</button>
              </div>
            </div>
          )}

          {!outcome && !inReview && (
            <div className="flex flex-col items-center gap-2 rounded-[8px] border border-dashed border-ui-divider px-6 py-14 text-center text-[13px] text-ui-text-secondary">
              <FileSpreadsheet size={28} className="opacity-50" aria-hidden />
              {files.length === 0
                ? 'Upload one or more spreadsheets on the left to start.'
                : 'Choose the event / campaign, then press “Check for duplicates” to compare these people with your existing Contacts.'}
            </div>
          )}

          {!outcome && inReview && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-[6px] bg-ui-surface px-3 py-2 text-[12px]">
                <button type="button" className={CHIP} onClick={() => { setFilter('new'); setShown(PAGE); }}><strong>{counts.fresh}</strong>&nbsp;new</button>
                <button type="button" className={CHIP} style={{ color: 'var(--status-t6-fg)' }} onClick={() => { setFilter('strong'); setShown(PAGE); }}><strong>{counts.strong}</strong>&nbsp;already in Contacts</button>
                <button type="button" className={CHIP} style={{ color: 'var(--status-t7-fg)' }} onClick={() => { setFilter('possible'); setShown(PAGE); }}><strong>{counts.possible}</strong>&nbsp;look similar</button>
                <span className="ml-auto font-semibold" style={{ color: counts.undecided > 0 ? 'var(--status-t7-fg)' : 'var(--status-t6-fg)' }}>
                  {counts.undecided > 0 ? `${counts.undecided} still need a decision` : 'All decided'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="mr-1 text-ui-text-secondary">Quick choice:</span>
                <button type="button" className={CHIP} onClick={() => preset('new_only')} title="Only the Contacts that are not in the system yet; everything that matches is skipped">Only add the new ones</button>
                <button type="button" className={CHIP} onClick={() => preset('new_and_merge')} title="New ones are added, matches are merged, similar ones are skipped">New + merge matches</button>
                <button type="button" className={CHIP} onClick={() => preset('all_new')} title="Everything is added as a separate new Contact">Add everything as new</button>
                <span className="ml-2 mr-1 text-ui-text-secondary" title="Suspicious = already in Contacts, or looks similar to something that is">Bulk:</span>
                <button type="button" className={CHIP} onClick={() => bulk(isStrong, 'merge')}>Merge all matches</button>
                <button type="button" className={CHIP} onClick={() => bulk(isPossible, 'create')}>Similar → add as new</button>
                <button type="button" className={CHIP} onClick={() => bulk(isPossible, 'skip')}>Similar → skip</button>
              </div>

              {/* Figma 265:20364 "Bulk table": one row per Contact-to-be; click a row for the full comparison. */}
              <div className="overflow-hidden rounded-[10px] border border-ui-divider">
                {picked.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 border-b border-ui-divider bg-ui-page-bg px-3 py-2.5" role="toolbar" aria-label="Actions for selected rows">
                    <span className={cn('mr-auto text-[13px] font-medium', HEADING_TEXT)}>{picked.size} selected</span>
                    <button
                      type="button" title="Clear the selection" aria-label="Clear the selection"
                      onClick={() => setPicked(new Set())}
                      className="grid size-9 cursor-pointer place-items-center rounded-[6px] border-0"
                      style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)', boxShadow: 'inset 0 0 0 1px var(--status-t10-fg)' }}
                    >
                      <X size={16} aria-hidden />
                    </button>
                    <button
                      type="button" className={cn(OUTLINE_BTN, 'h-9 border-[var(--color-secondary-700)] text-[13px] text-[var(--color-secondary-700)]')}
                      disabled={!!importing}
                      onClick={() => { bulk(g => picked.has(g.id) && done[g.id]?.state !== 'ok', 'skip'); setPicked(new Set()); }}
                    >
                      <Forward aria-hidden /> Skip Selected
                    </button>
                    <button
                      type="button" className={cn(OUTLINE_BTN, 'h-9 border-[var(--color-secondary-700)] text-[13px] text-[var(--color-secondary-700)]')}
                      disabled={!!importing || !groups.some(g => picked.has(g.id) && matchOf(g).length > 0)}
                      title="Merge each ticked row into the existing Contact it matches (rows with no match are left as they are)"
                      onClick={() => { bulk(g => picked.has(g.id) && matchOf(g).length > 0 && done[g.id]?.state !== 'ok', 'merge'); setPicked(new Set()); }}
                    >
                      <SquarePlus aria-hidden /> Merge Selected
                    </button>
                    <button
                      type="button" className={cn(NAVY_BTN, 'h-9 text-[13px]')}
                      disabled={!campaignId || !!importing || selectedToImport === 0}
                      title={selectedUndecided > 0 ? `${selectedUndecided} ticked row(s) still need a decision and will be left out` : `Import ${selectedToImport} ticked Contacts into ${campaignName}`}
                      onClick={() => { const only = new Set(picked); setPicked(new Set()); void runImport(only); }}
                    >
                      <FolderInput aria-hidden /> Import Selected
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-ui-surface">
                      <tr className="h-11 border-b border-ui-divider text-left">
                        <th className="w-12 text-center">
                          <input
                            type="checkbox" className={CHECKBOX_CLS} aria-label="Select all in this view"
                            ref={el => { if (el) el.indeterminate = pageRows.some(g => picked.has(g.id)) && !pageRows.every(g => picked.has(g.id)); }}
                            checked={pageRows.length > 0 && pageRows.every(g => picked.has(g.id))}
                            onChange={e => setPicked(prev => {
                              const next = new Set(prev);
                              for (const g of pageRows) { if (e.target.checked) next.add(g.id); else next.delete(g.id); }
                              return next;
                            })}
                          />
                        </th>
                        {([['field', 'Field'], ['type', 'Type'], ['status', 'Status'], ['decision', 'Decision']] as const).map(([key, label]) => (
                          <th key={key} className={cn('text-[13px] font-semibold', key === 'field' ? 'pr-4' : 'w-[150px] pr-3')} aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                            <button
                              type="button"
                              onClick={() => { if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('asc'); } }}
                              className={cn('inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-[inherit]', sortKey === key ? HEADING_TEXT : 'text-ui-body')}
                            >
                              {label}
                              {sortKey === key
                                ? (sortDir === 'asc' ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />)
                                : <ChevronsUpDown size={12} aria-hidden />}
                            </button>
                          </th>
                        ))}
                        <th className="w-12"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(g => {
                        const m = matchOf(g);
                        const d = decisions[g.id] ?? { action: null, target: null };
                        const st = done[g.id];
                        const target = m.find(x => x.prospectId === d.target) ?? m[0];
                        const open = expanded.has(g.id);
                        const status = statusOf(g);
                        const locked = st?.state === 'ok' || st?.state === 'running';
                        const choices = (m.length
                          ? ([['create', 'Add as new'], ['merge', 'Merge into the existing one'], ['skip', 'Skip (don\'t import)']] as const)
                          : ([['create', 'Add as new'], ['skip', 'Skip']] as const));
                        return (
                          <Fragment key={g.id}>
                            <tr
                              onClick={() => toggleExpanded(g.id)}
                              className={cn('h-16 cursor-pointer border-b border-ui-divider bg-ui-page-bg hover:bg-ui-surface', (picked.has(g.id) || open) && 'bg-ui-selected-bg')}
                              aria-expanded={open}
                            >
                              <td className="text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox" className={CHECKBOX_CLS} checked={picked.has(g.id)}
                                  aria-label={`Select ${nameOf(g)}`}
                                  onChange={() => setPicked(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                                />
                              </td>
                              <td className="max-w-0 pr-4">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <ChevronRight size={14} className={cn('shrink-0 text-ui-text-secondary transition-transform', open && 'rotate-90')} aria-hidden />
                                  <span className={cn('truncate text-[13px] font-semibold', HEADING_TEXT)}>{nameOf(g)}</span>
                                  {g.people.length > 1 && <span className="shrink-0 text-[11px] text-ui-text-secondary">+{g.people.length - 1}</span>}
                                  {g.warnings.length > 0 && <AlertTriangle size={13} className="shrink-0" style={{ color: 'var(--status-t7-fg)' }} aria-label={g.warnings.join(' · ')} />}
                                </div>
                                {st && st.state !== 'running' && (
                                  <div className="ml-5 truncate text-[11px] font-semibold" style={{ color: st.state === 'error' ? 'var(--status-t10-fg)' : 'var(--status-t6-fg)' }}>
                                    {st.state === 'error' ? '✗ ' : '✓ '}{st.message}
                                  </div>
                                )}
                              </td>
                              <td className="pr-3 text-[13px] text-ui-body">{g.company ? 'Company' : 'Person Name'}</td>
                              <td className="pr-3 text-[13px]" style={{ color: status.color }}>{status.label}</td>
                              <td className="pr-3 text-[13px]" style={d.action === null ? { color: 'var(--status-t7-fg)', fontWeight: 600 } : { color: 'var(--ui-text-secondary)' }}>
                                {st?.state === 'running' ? <Loader2 size={14} className="animate-spin" aria-label="Importing" /> : DECISION_LABEL[d.action ?? 'none']}
                              </td>
                              <td className="text-center" onClick={e => e.stopPropagation()}>
                                <div className="relative inline-block" ref={menuFor === g.id ? menuRef : undefined}>
                                  <button
                                    type="button"
                                    aria-label={`Actions for ${nameOf(g)}`} aria-haspopup="menu" aria-expanded={menuFor === g.id}
                                    onClick={() => setMenuFor(id => (id === g.id ? null : g.id))}
                                    className="grid size-8 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                                  >
                                    <MoreHorizontal size={16} aria-hidden />
                                  </button>
                                  {menuFor === g.id && (
                                    <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-20 flex min-w-[220px] flex-col gap-0.5 rounded-[6px] border border-ui-input-border bg-ui-page-bg p-1.5 text-left shadow-md">
                                      {choices.map(([k, label]) => (
                                        <button
                                          key={k} type="button" role="menuitemradio" aria-checked={d.action === k} disabled={locked}
                                          className={MENU_ITEM}
                                          onClick={() => { setDecision(g.id, { action: k, target: k === 'merge' ? (d.target ?? m[0]?.prospectId ?? null) : d.target }); setMenuFor(null); }}
                                        >
                                          <Check size={14} className={d.action === k ? '' : 'invisible'} aria-hidden /> {label}
                                        </button>
                                      ))}
                                      <div className="my-1 h-px bg-ui-divider" />
                                      <button
                                        type="button" role="menuitem" className={MENU_ITEM}
                                        disabled={d.action === null || locked || !campaignId || !!importing}
                                        onClick={() => { setMenuFor(null); void importOne(g); }}
                                      >
                                        <FolderInput size={14} aria-hidden /> {st?.state === 'error' ? 'Try again' : d.action === 'skip' ? 'Mark skipped' : 'Import this one'}
                                      </button>
                                      {st?.state === 'ok' && st.prospectId && (
                                        <Link role="menuitem" href={`/marketing/prospects/${st.prospectId}`} target="_blank" className={MENU_ITEM}>
                                          <ExternalLink size={14} aria-hidden /> Open Contact
                                        </Link>
                                      )}
                                      <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setMenuFor(null); toggleExpanded(g.id); }}>
                                        <ChevronRight size={14} aria-hidden /> {open ? 'Hide details' : 'Show details'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {open && (
                              <tr className="border-b border-ui-divider bg-ui-surface">
                                <td />
                                <td colSpan={5} className="py-3.5 pr-4">
                                  <div className={cn('grid gap-4', m.length ? 'md:grid-cols-2' : '')}>
                                    <div className="min-w-0 rounded-[8px] border border-ui-divider bg-ui-page-bg p-3">
                                      <div className="mb-1 text-[11px] uppercase tracking-[0.04em] text-ui-text-secondary">From your file</div>
                                      <div className="flex flex-col gap-1.5">{g.people.map((p, i) => <PersonLine key={i} p={p} thumbs={(p.photos ?? []).map(id => thumbs.get(id)).filter((u): u is string => !!u)} />)}</div>
                                      <div className="mt-1.5 text-[12px] text-ui-text-secondary">
                                        {[...new Set(g.people.flatMap(p => p.sources.map(s => s.split(' · ')[0])))].join(', ')}
                                        {g.mergedRows > 0 && ` · ${g.mergedRows} repeated row${g.mergedRows > 1 ? 's' : ''} combined`}
                                      </div>
                                      {g.warnings.map((w, i) => (
                                        <div key={i} className="mt-1 flex gap-1 text-[12px]" style={{ color: 'var(--status-t7-fg)' }}>
                                          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />{w}
                                        </div>
                                      ))}
                                    </div>
                                    {m.length > 0 && target && (
                                      <div className="min-w-0 rounded-[8px] border border-ui-divider bg-ui-page-bg p-3">
                                        <div className="mb-1 text-[11px] uppercase tracking-[0.04em] text-ui-text-secondary">
                                          Already in Contacts — {target.strength === 'strong' ? 'likely the same' : 'looks similar'}
                                        </div>
                                        {m.length > 1 && (
                                          <select className="form-input" style={{ ...smallControl, marginBottom: 6 }} value={target.prospectId} onChange={e => setDecision(g.id, { ...d, target: e.target.value })} aria-label="Which existing Contact">
                                            {m.map(x => <option key={x.prospectId} value={x.prospectId}>{x.displayName}</option>)}
                                          </select>
                                        )}
                                        <Link href={`/marketing/prospects/${target.prospectId}`} target="_blank" className={cn('text-[14px] font-semibold underline', HEADING_TEXT)}>{target.displayName}</Link>
                                        <div style={muted}>{[target.email, target.phone].filter(Boolean).join(' · ') || 'no email / phone'}</div>
                                        {addedLabel(target.addedAt) && <div style={{ ...muted, fontWeight: 600 }}>{addedLabel(target.addedAt)}{target.sourceLabel ? ` · source: ${target.sourceLabel}` : ''}</div>}
                                        {target.contacts.slice(0, 4).map(c => (
                                          <div key={c.id} className="mt-0.5 text-[12px] text-ui-body">{c.name}<span style={muted}> · {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</span></div>
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
                                            <div className="mt-2 border-t border-dashed border-ui-input-border pt-1.5 text-[12px]">
                                              <div className="font-semibold text-ui-body">If you merge</div>
                                              <div style={muted}>Everything already on this Contact stays exactly as it is.</div>
                                              {adds.length > 0 && <div style={{ color: 'var(--status-t6-fg)' }}>+ Fills empty fields: {adds.join(' · ')}</div>}
                                              {newPeople.length > 0 && <div style={{ color: 'var(--status-t6-fg)' }}>+ Adds {newPeople.length === 1 ? 'a person' : 'people'}: {newPeople.join(', ')}</div>}
                                              {keeps.length > 0 && <div style={{ color: 'var(--status-t7-fg)' }}>Different in your file — your existing value stays, the file&apos;s value goes into the Activity note: {keeps.join(' · ')}</div>}
                                              <div style={muted}>+ An Activity note with the imported info is added.</div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-3.5 text-[13px] text-ui-body">
                                    {choices.map(([k, label]) => (
                                      <label key={k} className="inline-flex cursor-pointer items-center gap-1.5">
                                        <input
                                          type="radio" name={`d-${g.id}`} checked={d.action === k} disabled={locked}
                                          className="accent-[var(--color-secondary-700)]"
                                          onChange={() => setDecision(g.id, { action: k, target: k === 'merge' ? (d.target ?? m[0]?.prospectId ?? null) : d.target })}
                                        />
                                        {label}
                                      </label>
                                    ))}
                                    <button
                                      type="button" className={cn(NAVY_BTN, 'ml-auto h-8 px-3 text-[12px]')}
                                      disabled={d.action === null || locked || !campaignId || !!importing}
                                      onClick={() => void importOne(g)}
                                    >
                                      {st?.state === 'error' ? 'Try again' : d.action === 'skip' ? 'Mark skipped' : 'Import this one'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sortedVisible.length === 0 && <div className="p-5 text-center text-[13px] text-ui-text-secondary">Nothing in this view.</div>}
              </div>
              {sortedVisible.length > shown && (
                <button type="button" className={cn(OUTLINE_BTN, 'self-center')} onClick={() => setShown(s => s + PAGE)}>Show more ({sortedVisible.length - shown} left)</button>
              )}
            </>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
