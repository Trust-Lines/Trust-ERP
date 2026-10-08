/* eslint-disable @typescript-eslint/no-explicit-any */

import ExcelJS from 'exceljs';
import { getDropboxClient } from '@/lib/dropbox/client';
import { sanitizeFileName } from './prospectFiles';

// Backup of the Contacts data (Prospects and everything that hangs off them) as a human-readable
// Excel workbook + a complete JSON, written to Dropbox. Used by the nightly cron, the "back up all
// now" button and the per-Contact "Back up" button.
//
// Dropbox rules of this app are respected: files are only ADDED (mode add + autorename) — never
// overwritten, moved or deleted — so every night leaves its own file and old ones stay until a
// person removes them in Dropbox.
//
// select('*') is deliberate here: a backup must keep every column, including ones added later.

export const BACKUP_ROOT = '/Marketing/_Backups/Contacts';

export const BACKUP_TABLES = [
  { sheet: 'Contacts', table: 'prospects', by: 'id' },
  { sheet: 'People', table: 'prospect_contacts', by: 'prospect_id' },
  { sheet: 'Locations', table: 'prospect_locations', by: 'prospect_id' },
  { sheet: 'Needs', table: 'prospect_needs', by: 'prospect_id' },
  { sheet: 'Potentials', table: 'prospect_potentials', by: 'prospect_id' },
  { sheet: 'Opportunities', table: 'opportunities', by: 'prospect_id' },
  { sheet: 'Files', table: 'prospect_files', by: 'prospect_id' },
] as const;

export interface BackupData {
  generatedAt: string;
  scope: 'all' | 'single';
  tables: Record<string, Record<string, unknown>[]>;
}

const PAGE = 1000;
const MAX_ROWS = 200_000;

async function pageAll(build: (from: number, to: number) => any): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const chunk = <T,>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Loads every table. `prospectId` limits it to one Contact's card. */
export async function loadContactsBackup(admin: any, opts: { prospectId?: string } = {}): Promise<BackupData> {
  const tables: BackupData['tables'] = {};
  for (const t of BACKUP_TABLES) {
    tables[t.sheet] = await pageAll((from, to) => {
      let q = admin.from(t.table).select('*').order('id').range(from, to);
      if (opts.prospectId) q = q.eq(t.by, opts.prospectId);
      return q;
    });
  }
  // Activity notes hang off the people.
  const personIds = tables.People.map(p => p.id as string);
  if (opts.prospectId) {
    const notes: Record<string, unknown>[] = [];
    for (const ids of chunk(personIds, 150)) {
      notes.push(...await pageAll((from, to) => admin.from('prospect_contact_notes').select('*').in('prospect_contact_id', ids).order('id').range(from, to)));
    }
    tables.Notes = notes;
  } else {
    tables.Notes = await pageAll((from, to) => admin.from('prospect_contact_notes').select('*').order('id').range(from, to));
  }
  return { generatedAt: new Date().toISOString(), scope: opts.prospectId ? 'single' : 'all', tables };
}

const cell = (v: unknown): string | number | boolean | Date | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.length > 32000 ? `${v.slice(0, 31990)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const json = JSON.stringify(v);
  return json.length > 32000 ? `${json.slice(0, 31990)}…` : json;
};

export async function buildBackupWorkbook(data: BackupData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date(data.generatedAt);
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['Contacts backup']);
  summary.addRow(['Generated (UTC)', data.generatedAt]);
  summary.addRow(['Scope', data.scope === 'all' ? 'All Contacts' : 'One Contact']);
  for (const [sheet, rows] of Object.entries(data.tables)) summary.addRow([sheet, rows.length]);
  summary.getColumn(1).width = 22;
  summary.getRow(1).font = { bold: true, size: 14 };

  for (const [sheet, rows] of Object.entries(data.tables)) {
    const ws = wb.addWorksheet(sheet);
    const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
    if (!columns.length) { ws.addRow(['(empty)']); continue; }
    ws.addRow(columns);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of rows) ws.addRow(columns.map(c => cell(r[c])));
    columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(40, Math.max(12, c.length + 2)); });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface BackupResult {
  xlsxPath: string;
  jsonPath: string;
  counts: Record<string, number>;
  bytes: number;
}

async function put(path: string, contents: Buffer): Promise<string> {
  const res = await getDropboxClient().filesUpload({ path, contents, mode: { '.tag': 'add' }, autorename: true });
  return res.result.path_display ?? res.result.path_lower ?? path;
}

/** Writes the Excel + JSON for `data` into Dropbox (add-only). */
export async function writeBackupToDropbox(data: BackupData, opts: { folder: string; baseName: string }): Promise<BackupResult> {
  const xlsx = await buildBackupWorkbook(data);
  const json = Buffer.from(JSON.stringify(data));
  const xlsxPath = await put(`${opts.folder}/${opts.baseName}.xlsx`, xlsx);
  const jsonPath = await put(`${opts.folder}/${opts.baseName}.json`, json);
  return {
    xlsxPath, jsonPath, bytes: xlsx.length + json.length,
    counts: Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, v.length])),
  };
}

const stamp = (d: Date) => d.toISOString().slice(0, 16).replace('T', '_').replace(':', '-'); // 2026-10-09_03-00

export async function backupAllContacts(admin: any, kind: 'nightly' | 'manual'): Promise<BackupResult> {
  const now = new Date();
  const data = await loadContactsBackup(admin);
  return writeBackupToDropbox(data, {
    folder: `${BACKUP_ROOT}/${now.toISOString().slice(0, 7)}`,
    baseName: `contacts-${kind}-${stamp(now)}`,
  });
}

export async function backupOneContact(admin: any, prospectId: string, displayName: string): Promise<BackupResult> {
  const now = new Date();
  const data = await loadContactsBackup(admin, { prospectId });
  return writeBackupToDropbox(data, {
    folder: `${BACKUP_ROOT}/single/${sanitizeFileName(displayName || 'Contact')} - ${prospectId.slice(0, 8)}`,
    baseName: `contact-${stamp(now)}`,
  });
}
