'use client';

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { PRIMARY_BTN, SECONDARY_BTN } from './itFormParts';

// IT → Phone Numbers → Import: pick a .json file ({ "lines": [...], "items": [...] }) kept on your own
// machine, check the counts, import. Lines use the New Number fields (number, holderName, deviceName,
// personalDevice, deviceCondition, imei, email, password, pin, carrier, firm, accountHolder,
// accountNumber, monthlyCost, location, notes); items the Add Item fields. Numbers already in the
// list are skipped. Secrets are encrypted on the server.

interface Result { created: { lines: number; items: number }; skipped: string[]; failed: string[]; error?: string }

export function ItImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ lines: unknown[]; items: unknown[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function pick(file: File | undefined) {
    setError(null); setData(null); setResult(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const json = JSON.parse(await file.text()) as { lines?: unknown; items?: unknown };
      const lines = Array.isArray(json.lines) ? json.lines : [];
      const items = Array.isArray(json.items) ? json.items : [];
      if (!lines.length && !items.length) throw new Error('The file has no "lines" or "items"');
      setData({ lines, items });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That isn’t a valid JSON file');
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
      <ModalContent size="lg" title="Import" description="Phone lines and items from a JSON file. Numbers already in the list are skipped.">
        <div className="flex flex-col gap-4">
          {!result && (
            <label htmlFor="it-import-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary-200 px-4 py-8 text-center hover:bg-ui-hover-bg dark:border-primary-500">
              <FileUp size={28} strokeWidth={1.5} aria-hidden className="text-ui-body" />
              <span className="text-[14px] font-semibold text-secondary-700 dark:text-secondary-50">{fileName || 'Choose a .json file'}</span>
              {data && <span className="text-[13px] text-ui-body">{data.lines.length} phone lines · {data.items.length} items</span>}
              <input id="it-import-file" type="file" accept="application/json,.json" className="sr-only" onChange={e => void pick(e.target.files?.[0])} />
            </label>
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
