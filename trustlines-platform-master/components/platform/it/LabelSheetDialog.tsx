'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Printer, Search } from 'lucide-react';
import { Modal, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { itemUrl, makeQr, printLabelSheet } from './itemQr';
import { LABEL_SHEET, LABELS_PER_SHEET, sheetsNeeded } from './labelSheet';
import { MUTED, STRONG } from './itemStyles';

// Print IT item QR labels on an A4 sticker sheet (3 × 8 = 24). Pick the items (Items Library) and
// the cell to start from — click a sticker in the sheet preview — so a part-used sheet can go back
// in the printer. One label or many, each lands in its own fixed cell at the same size. The next
// free cell is remembered in this browser.

export interface LabelSheetItem { id: string; name: string; detail?: string | null }

const NEXT_KEY = 'it.labelSheet.next';

function readNext(): number {
  try {
    const n = Number(window.localStorage.getItem(NEXT_KEY));
    return Number.isInteger(n) && n >= 0 && n < LABELS_PER_SHEET ? n : 0;
  } catch { return 0; }
}

function saveNext(n: number) {
  try { window.localStorage.setItem(NEXT_KEY, String(n)); } catch { /* per-browser convenience only */ }
}

const PRIMARY_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary-700 px-6 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-secondary-50 dark:text-primary-950';

export function LabelSheetDialog({ items, selectable = false, onClose }: {
  items: LabelSheetItem[];
  /** Items Library: choose which items to print (none picked at first). Otherwise all of `items` print. */
  selectable?: boolean;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selectable ? [] : items.map(i => i.id)));
  const [startAt, setStartAt] = useState<number>(() => (typeof window === 'undefined' ? 0 : readNext()));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => `${i.name} ${i.detail ?? ''}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const chosen = items.filter(i => picked.has(i.id));
  const count = chosen.length;
  const sheets = sheetsNeeded(count, startAt);
  const allShown = shown.length > 0 && shown.every(i => picked.has(i.id));
  const someShown = shown.some(i => picked.has(i.id));

  function toggle(id: string, on: boolean) {
    setPicked(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleShown(on: boolean) {
    setPicked(prev => {
      const next = new Set(prev);
      for (const i of shown) { if (on) next.add(i.id); else next.delete(i.id); }
      return next;
    });
  }

  async function print() {
    if (!count) return;
    setBusy(true);
    try {
      const origin = window.location.origin;
      const labels = await Promise.all(chosen.map(async i => {
        const url = itemUrl(origin, i.id);
        return { name: i.name, detail: i.detail ?? null, url, qr: await makeQr(url) };
      }));
      printLabelSheet(labels, startAt);
      const next = (startAt + count) % LABELS_PER_SHEET;
      saveNext(next);
      setStartAt(next);
    } catch {
      toast.error('Could not make the QR codes');
    } finally {
      setBusy(false);
    }
  }

  const cellState = (n: number) => (n < startAt ? 'used' : n < startAt + count ? 'print' : 'free');

  return (
    <Modal open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <ModalContent
        size="lg"
        title="Print labels"
        description={`${LABEL_SHEET.name}. Click a sticker to start from it.`}
        footer={
          <>
            <Button variant="secondary" className={modalSecondaryButtonClass} onClick={onClose} disabled={busy}>Cancel</Button>
            <button type="button" className={PRIMARY_BTN} onClick={() => void print()} disabled={!count || busy}>
              <Printer size={16} aria-hidden />
              {busy ? 'Preparing…' : count ? `Print ${count} label${count === 1 ? '' : 's'}` : 'Print'}
            </button>
          </>
        }
      >
        <div className={cn('grid grid-cols-1 gap-5', selectable && 'sm:grid-cols-[minmax(0,1fr)_200px]')}>
          {selectable && (
            <div className="flex min-w-0 flex-col gap-2">
              <label className="relative flex items-center">
                <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Search items</span>
                <input
                  type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items…"
                  className="h-9 w-full rounded-md border border-[var(--ui-input-border)] bg-ui-input-bg pl-9 pr-3 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
                />
              </label>
              <label className="flex items-center gap-2 px-1 text-[13px] font-medium text-ui-body">
                <Checkbox checked={allShown} indeterminate={!allShown && someShown} onCheckedChange={v => toggleShown(!!v)} />
                Select all{query ? ' shown' : ''} ({shown.length})
              </label>
              <ul className="m-0 flex max-h-[380px] list-none flex-col gap-1 overflow-y-auto rounded-md border border-ui-divider p-1">
                {shown.length === 0 ? (
                  <li className={cn('px-3 py-6 text-center text-[13px]', MUTED)}>No items match.</li>
                ) : shown.map(i => (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-ui-hover-bg">
                      <Checkbox checked={picked.has(i.id)} onCheckedChange={v => toggle(i.id, !!v)} />
                      <span className="flex min-w-0 flex-col">
                        <span className={cn('truncate text-[13px] font-semibold', STRONG)}>{i.name}</span>
                        {i.detail && <span className={cn('truncate text-[12px]', MUTED)}>{i.detail}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={cn('flex flex-col items-center gap-2', !selectable && 'sm:flex-row sm:items-start sm:gap-5')}>
            {/* A4 sheet preview, to scale: click a sticker to start there. */}
            <div
              role="radiogroup"
              aria-label="Start from sticker"
              className="relative w-[200px] shrink-0 rounded-sm border border-ui-divider bg-white shadow-sm dark:bg-primary-50"
              style={{ aspectRatio: `${LABEL_SHEET.pageWidth} / ${LABEL_SHEET.pageHeight}` }}
            >
              {Array.from({ length: LABELS_PER_SHEET }, (_, n) => {
                const row = Math.floor(n / LABEL_SHEET.cols), col = n % LABEL_SHEET.cols;
                const st = cellState(n);
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === startAt}
                    aria-label={`Start at sticker ${n + 1} (row ${row + 1}, column ${col + 1})`}
                    onClick={() => setStartAt(n)}
                    className={cn(
                      'absolute grid place-items-center rounded-[2px] border text-[9px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
                      st === 'print' && 'border-secondary-700 bg-secondary-700 text-white',
                      st === 'used' && 'border-primary-200 bg-[repeating-linear-gradient(45deg,#eef1f5,#eef1f5_3px,#dfe4ea_3px,#dfe4ea_6px)] text-primary-400',
                      st === 'free' && 'border-primary-200 bg-white text-primary-300 hover:border-secondary-700',
                    )}
                    style={{
                      left: `${((LABEL_SHEET.marginLeft + col * LABEL_SHEET.pitchX) / LABEL_SHEET.pageWidth) * 100}%`,
                      top: `${((LABEL_SHEET.marginTop + row * LABEL_SHEET.pitchY) / LABEL_SHEET.pageHeight) * 100}%`,
                      width: `${(LABEL_SHEET.labelWidth / LABEL_SHEET.pageWidth) * 100}%`,
                      height: `${(LABEL_SHEET.labelHeight / LABEL_SHEET.pageHeight) * 100}%`,
                    }}
                  >
                    {n + 1}
                  </button>
                );
              })}
            </div>
            <div className={cn('flex flex-col gap-1 text-[12px] leading-[1.45] text-ui-body', selectable ? 'text-center' : 'max-w-[300px]')}>
              <p className="m-0">Starts at sticker <b className={STRONG}>{startAt + 1}</b> of {LABELS_PER_SHEET}{startAt > 0 && (
                <> · <button type="button" className="underline" onClick={() => setStartAt(0)}>start from 1</button></>
              )}</p>
              {count > 0 && <p className="m-0">{count} label{count === 1 ? '' : 's'} · {sheets} sheet{sheets === 1 ? '' : 's'}</p>}
              {!selectable && (
                <p className={cn('m-0 mt-2', MUTED)}>
                  In the print dialog: paper A4, Margins <b>None</b>, Scale <b>100%</b> (not “Fit to page”).
                </p>
              )}
            </div>
          </div>
        </div>
        {selectable && (
          <p className={cn('m-0 mt-3 text-[12px]', MUTED)}>
            In the print dialog: paper A4, Margins <b>None</b>, Scale <b>100%</b> (not “Fit to page”).
          </p>
        )}
      </ModalContent>
    </Modal>
  );
}
