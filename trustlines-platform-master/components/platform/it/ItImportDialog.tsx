'use client';

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { PRIMARY_BTN, SECONDARY_BTN } from './itFormParts';
import { parsePhoneWorkbook, type ImportLine } from '@/lib/it/phoneSheetImport';

// IT → Phone Numbers → Import: pick the "Phones and sim cards info" Excel (.xlsx / .xls / .csv — read in
// the browser by lib/it/phoneSheetImport) or a .json file ({ "lines": [...], "items": [...] }), check
// what was read, import. PDFs aren't read: export the sheet to Excel first. Lines use the New Number fields (number, holderName, deviceName,
// personalDevice, deviceCondition, imei, email, password, pin, carrier, firm, accountHolder,
// accountNumber, monthlyCost, location, notes); items the Add Item fields. Numbers already in the
// list are skipped. Secrets are encrypted on the server.

interface Result { created: { lines: number; items: number }; skipped: string[]; failed: string[]; error?: string }

export function ItImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ lines: unknown[]; items: unknown[] } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function pick(file: File | undefined) {
    setError(null); setData(null); setResult(null); setWarnings([]);
    if (!file) return;
    setFileName(file.name);
    try {
      if (/\.pdf$/i.test(file.name)) throw new Error('PDFs can’t be read reliably — open the sheet in Excel and choose the .xlsx file.');
      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const { readSpreadsheet } = await import('@/lib/client/readSpreadsheet');
        const parsed = parsePhoneWorkbook(await readSpreadsheet(file));
        if (!parsed.lines.length && !parsed.items.length) throw new Error('No phone lines found — the sheet needs a header row with USER and NUMBER.');
        setData({ lines: parsed.lines, items: parsed.items });
        setWarnings(parsed.warnings);
        return;
      }
      const json = JSON.parse(await file.text()) as { lines?: unknown; items?: unknown };
      const lines = Array.isArray(json.lines) ? json.lines : [];
      const items = Array.isArray(json.items) ? json.items : [];
      if (!lines.length && !items.length) throw new Error('The file has no "lines" or "items"');
      setData({ lines, items });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read');
    }
  }

  async function run() {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/it/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const b = await res.json().catch(() => null) as Result | null;
      if (!res.ok && !b?.created) throw new Error(b?.error ?? `Import failed (${res.status})`);
      setResult(b);
      if (b?.error) setError(b.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <ModalContent size="lg" title="Import" description="The phones sheet (Excel) or a JSON file. Numbers already in the list are skipped.">
        <div className="flex flex-col gap-4">
          {!result && (
            <label htmlFor="it-import-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary-200 px-4 py-8 text-center hover:bg-ui-hover-bg dark:border-primary-500">
              <FileUp size={28} strokeWidth={1.5} aria-hidden className="text-ui-body" />
              <span className="text-[14px] font-semibold text-secondary-700 dark:text-secondary-50">{fileName || 'Choose the Excel (.xlsx) or a .json file'}</span>
              {data && <span className="text-[13px] text-ui-body">{data.lines.length} phone lines · {data.items.length} items</span>}
              <input id="it-import-file" type="file" accept=".xlsx,.xls,.csv,.json,application/json" className="sr-only" onChange={e => void pick(e.target.files?.[0])} />
            </label>
          )}

          {!result && data && data.lines.length > 0 && (
            <div className="max-h-[260px] overflow-auto rounded-md border border-ui-divider">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 bg-ui-surface">
                  <tr className="text-ui-body">{['Number', 'User', 'Phone', 'Carrier · Firm', 'Office'].map(h => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(data.lines as ImportLine[]).map((l, i) => (
                    <tr key={`${l.number}-${i}`} className="border-t border-ui-divider text-secondary-700 dark:text-secondary-50">
                      <td className="whitespace-nowrap px-2 py-1">{l.number}</td>
                      <td className="px-2 py-1">{l.holderName ?? <span className="text-ui-text-secondary">Available</span>}</td>
                      <td className="px-2 py-1">{l.deviceName ?? (l.personalDevice ? 'Personal' : '—')}</td>
                      <td className="px-2 py-1">{[l.carrier, l.firm].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-2 py-1">{l.location ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!result && warnings.length > 0 && (
            <ul className="m-0 rounded-md bg-[var(--status-t7-bg)] px-5 py-2 text-[12px] text-[var(--status-t7-fg)]">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
          )}

          {result && (
            <div className="flex flex-col gap-2 text-[13px]">
              <p className="m-0 rounded-md bg-[var(--status-t9-bg)] px-3 py-2 font-semibold text-[var(--status-t9-fg)]">
                Added {result.created.lines} phone lines and {result.created.items} items.
              </p>
              {result.skipped.length > 0 && (
                <details className="rounded-md border border-ui-divider px-3 py-2">
                  <summary className="cursor-pointer font-semibold text-ui-body">Skipped ({result.skipped.length})</summary>
                  <ul className="m-0 mt-2 pl-4 text-ui-body">{result.skipped.map(s => <li key={s}>{s}</li>)}</ul>
                </details>
              )}
              {result.failed.length > 0 && (
                <div className="rounded-md bg-[var(--status-t10-bg)] px-3 py-2 text-[var(--status-t10-fg)]">
                  <p className="m-0 font-semibold">Not added ({result.failed.length})</p>
                  <ul className="m-0 mt-1 pl-4">{result.failed.map(s => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="m-0 rounded-md bg-[var(--status-t10-bg)] px-3 py-2 text-[13px] text-[var(--status-t10-fg)]">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-ui-divider pt-4">
            <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BTN}>{result ? 'Done' : 'Cancel'}</button>
            {!result && (
              <button type="button" onClick={run} disabled={!data || busy} className={cn(PRIMARY_BTN)}>
                {busy ? 'Importing…' : 'Import'}
              </button>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
