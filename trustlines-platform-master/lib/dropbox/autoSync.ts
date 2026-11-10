// Dropbox → documents: the PDFs people drop into a project's version folders (…/v2/1-PDF/x.pdf)
// become document rows, so the project page, PM workspace and dashboards see them.
//
// Two ways in, same code:
//   • syncProjectDropbox()   — one project, full scan of its version folders (project page open)
//   • processDropboxChanges() — the Dropbox change feed (webhook + 10-minute cron): reads what
//                               changed since the stored cursor and re-scans only those projects
//
// Read-only on Dropbox (docs/AGENTS.md §4): lists folders, never writes, moves or deletes there.
// Only adds rows here — an existing document is never touched, a removed file is never un-synced.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Dropbox, files } from 'dropbox';
import { getVersionBaseFolder, PROD_TYPES, PROD_TYPES_WITH_PROPOSAL } from '@/lib/dropbox/paths';
import type { ProdType } from '@/lib/dropbox/paths';

/* eslint-disable @typescript-eslint/no-explicit-any */

type ScanTarget = {
  docType:      string;
  basePath:     string;
  prodType:     ProdType | null;
  stepKey:      string;
  catGroup:     string | null;
  pdfSubfolder: string | null;
};

export function buildTargets(projectRoot: string): ScanTarget[] {
  const targets: ScanTarget[] = [];
  const add = (docType: string, stepKey: string, prodType: ProdType | null, pdfSubfolder: string | null, overrideBase: string | null = null) => {
    const base = overrideBase ?? getVersionBaseFolder(docType, prodType ?? undefined);
    if (!base) return;
    targets.push({
      docType, basePath: `${projectRoot}/${base}`, prodType, stepKey,
      catGroup: prodType ? prodType.toLowerCase() : null, pdfSubfolder,
    });
  };

  add('plan_layout',           'plan_layout',           null, 'PDF');
  add('proposal',              'design_proposal',       null, '1-PDF');
  add('construction_drawings', 'construction_drawings', null, '2-PDF');

  for (const pt of PROD_TYPES) {
    const withProposal = (PROD_TYPES_WITH_PROPOSAL as readonly string[]).includes(pt);
    const base = `3-Production & Delivery/${pt}`;
    if (withProposal) {
      add('proposal',  'proposal',  pt, '1-Proposal/PDF', base);
      add('item_plan', 'item_plan', pt, '2-Item Plan/PDF', base);
      add('item_list', 'item_list', pt, '3-Item List/PDF', base);
      add('book',      'book',      pt, '4-Book/4-Final Submission/PDF', base);
      add('po_bo',     'po',        pt, '5-Purchase Order/PDF', base);
      add('pf',        'pfs',       pt, '6-Production Form/For Trust', base);
    } else {
      add('item_plan', 'item_plan', pt, '1-Item Plan/PDF', base);
      add('item_list', 'item_list', pt, '2-Item List/PDF', base);
      add('book',      'book',      pt, '3-Book/4-Final Submission/PDF', base);
      add('po_bo',     'po',        pt, '4-Purchase Order/PDF', base);
      add('pf',        'pfs',       pt, '5-Production Form/For Trust', base);
    }
  }
  return targets;
}

/** The version number when `filePath` is a PDF under `<target>/vN/<pdfSubfolder>/…`, else null. */
export function versionOf(filePath: string, t: Pick<ScanTarget, 'basePath' | 'pdfSubfolder'>): number | null {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  const base = t.basePath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!p.startsWith(base + '/') || !p.endsWith('.pdf')) return null;
  const rest = p.slice(base.length + 1);
  const m = rest.match(/^v(\d+)\//);
  if (!m) return null;
  if (t.pdfSubfolder && !rest.slice(m[0].length).startsWith(t.pdfSubfolder.toLowerCase() + '/')) return null;
  return parseInt(m[1], 10);
}

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'pdf' ? 'application/pdf'
    : ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'dwg' ? 'application/acad'
    : 'application/octet-stream';
}

async function listAll(dbx: Dropbox, path: string): Promise<files.ListFolderResult['entries']> {
  let res = await dbx.filesListFolder({ path, recursive: true, include_deleted: false });
  const all = [...(res.result.entries ?? [])];
  while (res.result.has_more) {
    res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
    all.push(...(res.result.entries ?? []));
  }
  return all;
}

/**
 * Scan one project's version folders and add a document row for every PDF not yet known.
 * `actorId` = who triggered it (null for the webhook / cron). Returns how many rows were added.
 */
export async function syncProjectDropbox(admin: any, dbx: Dropbox, projectId: string, actorId: string | null): Promise<{ synced: number; error?: string }> {
  const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).single();
  const dropboxRoot = (proj as { dropbox_root_path: string | null } | null)?.dropbox_root_path;
  if (!dropboxRoot) return { synced: 0 };

  const { data: existingDocs } = await admin.from('documents').select('dropbox_path').eq('project_id', projectId);
  const knownPaths = new Set<string>(
    ((existingDocs ?? []) as { dropbox_path: string | null }[]).map(d => (d.dropbox_path ?? '').toLowerCase()).filter(Boolean),
  );

  const toInsert: Record<string, unknown>[] = [];
  await Promise.allSettled(buildTargets(dropboxRoot).map(async t => {
    let entries: files.ListFolderResult['entries'];
    try { entries = await listAll(dbx, t.basePath); } catch { return; } // folder not there yet
    for (const entry of entries) {
      if (entry['.tag'] !== 'file') continue;
      const filePath = (entry.path_lower ?? '').replace(/\\/g, '/');
      if (knownPaths.has(filePath)) continue;
      const dropboxVersion = versionOf(filePath, t);
      if (dropboxVersion == null) continue;
      knownPaths.add(filePath);
      toInsert.push({
        project_id:      projectId,
        doc_type:        t.docType,
        version:         1,
        status:          'draft',
        dropbox_path:    entry.path_display ?? filePath,
        dropbox_file_id: entry.id ?? null,
        dropbox_rev:     entry.rev ?? null,
        file_name:       entry.name,
        file_size_bytes: entry.size ?? null,
        mime_type:       guessMime(entry.name),
        uploaded_by:     actorId,
        notes:           'Auto-synced from Dropbox',
        step_key:        t.stepKey,
        cat_group:       t.catGroup,
        dropbox_version: dropboxVersion,
        prod_type:       t.prodType,
      });
    }
  }));
  if (!toInsert.length) return { synced: 0 };

  const versionCounters = new Map<string, number>();
  const { data: maxVersions } = await admin
    .from('documents').select('doc_type, version').eq('project_id', projectId).order('version', { ascending: false });
  for (const row of (maxVersions ?? []) as { doc_type: string; version: number }[]) {
    if (!versionCounters.has(row.doc_type)) versionCounters.set(row.doc_type, row.version);
  }
  const finalRows: Record<string, unknown>[] = toInsert.map(r => {
    const next = (versionCounters.get(r.doc_type as string) ?? 0) + 1;
    versionCounters.set(r.doc_type as string, next);
    return { ...r, version: next };
  });

  let { error } = await admin.from('documents').insert(finalRows);
  const isSchemaMissing = (m?: string) => !!m && (m.includes('column') || m.includes('schema cache'));
  const isEnumError     = (m?: string) => !!m && m.includes('invalid input value for enum');

  if (isSchemaMissing(error?.message)) {
    const baseRows = finalRows.map(r => ({
      project_id: r.project_id, doc_type: r.doc_type, version: r.version,
      status: r.status, dropbox_path: r.dropbox_path, dropbox_file_id: r.dropbox_file_id,
      dropbox_rev: r.dropbox_rev, file_name: r.file_name, file_size_bytes: r.file_size_bytes,
      mime_type: r.mime_type, uploaded_by: r.uploaded_by, notes: r.notes,
    }));
    ({ error } = await admin.from('documents').insert(baseRows));
  }
  if (isEnumError(error?.message)) {
    let synced = 0;
    for (const row of finalRows) {
      const { error: e } = await admin.from('documents').insert(row);
      if (!e) synced++;
      else if (!isEnumError(e.message)) console.error('[dropbox auto-sync row]', e.message);
    }
    return { synced };
  }
  if (error) {
    console.error('[dropbox auto-sync]', error.message);
    return { synced: 0, error: error.message };
  }
  return { synced: finalRows.length };
}

// ─── Change feed ─────────────────────────────────────────────────────────────────────────────

/** The Dropbox folder the change feed watches — every project root sits under it. */
export const WATCH_ROOT = process.env.DROPBOX_SYNC_ROOT || '/D-Projects';
const STATE_ID = 'changes';
const LOCK_MS = 5 * 60 * 1000;

/** The project whose root contains `path` (longest root wins). Roots and path are compared lower-case. */
export function projectForPath(path: string, roots: { id: string; root: string }[]): string | null {
  const p = path.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const r of roots) {
    const root = r.root.toLowerCase().replace(/\/+$/, '');
    if ((p === root || p.startsWith(root + '/')) && (!best || root.length > best.len)) best = { id: r.id, len: root.length };
  }
  return best?.id ?? null;
}

export interface ChangeReport {
  status: 'ok' | 'locked' | 'initialized' | 'missing_table';
  changes: number;
  projects: number;
  synced: number;
}

/**
 * Read the Dropbox change feed since the stored cursor and sync the projects whose PDFs changed.
 * Safe to call any number of times at once: a row lock lets one run work, the rest return 'locked'.
 * The first run only stores the current cursor (nothing to replay); projects with PDFs from before
 * that are still picked up by the full scan on their page.
 */
export async function processDropboxChanges(admin: any, dbx: Dropbox, opts: { budgetMs?: number } = {}): Promise<ChangeReport> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const report: ChangeReport = { status: 'ok', changes: 0, projects: 0, synced: 0 };

  // Take the lock: only when free or stale.
  const now = new Date();
  const { data: locked, error: lockErr } = await admin
    .from('dropbox_sync_state')
    .update({ locked_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq('id', STATE_ID)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select('cursor');
  if (lockErr) {
    if (/dropbox_sync_state|schema cache|does not exist/i.test(lockErr.message)) return { ...report, status: 'missing_table' };
    throw new Error(lockErr.message);
  }
  if (!locked?.length) return { ...report, status: 'locked' };

  let cursor: string | null = locked[0].cursor ?? null;
  const save = (patch: Record<string, unknown>) =>
    admin.from('dropbox_sync_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', STATE_ID);

  try {
    if (!cursor) {
      const r = await dbx.filesListFolderGetLatestCursor({ path: WATCH_ROOT, recursive: true, include_deleted: false });
      await save({ cursor: r.result.cursor });
      return { ...report, status: 'initialized' };
    }

    const { data: projs } = await admin.from('projects').select('id, dropbox_root_path').is('deleted_at', null).not('dropbox_root_path', 'is', null);
    const roots = ((projs ?? []) as { id: string; dropbox_root_path: string }[]).map(p => ({ id: p.id, root: p.dropbox_root_path }));
    const done = new Set<string>();

    for (;;) {
      const res = await dbx.filesListFolderContinue({ cursor });
      const entries = res.result.entries ?? [];
      report.changes += entries.length;
      // Only new / changed PDFs can add a document row.
      const touched = new Set<string>();
      for (const e of entries) {
        if (e['.tag'] !== 'file' || !e.path_lower?.endsWith('.pdf')) continue;
        const id = projectForPath(e.path_lower, roots);
        if (id && !done.has(id)) touched.add(id);
      }
      for (const id of touched) {
        const r = await syncProjectDropbox(admin, dbx, id, null);
        report.synced += r.synced;
        done.add(id);
      }
      cursor = res.result.cursor;
      await save({ cursor }); // progress kept even if a later page runs out of time
      if (!res.result.has_more || Date.now() - started > budget) break;
    }
    report.projects = done.size;
    return report;
  } catch (e: any) {
    // An expired / reset cursor: start over from now (the page scan still covers older files).
    if (JSON.stringify(e?.error ?? '').includes('reset')) {
      await save({ cursor: null });
    }
    throw e;
  } finally {
    await save({ locked_until: null });
  }
}

/** Dropbox webhook check: X-Dropbox-Signature = hex HMAC-SHA256 of the raw body with the app secret. */
export function validWebhookSignature(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
