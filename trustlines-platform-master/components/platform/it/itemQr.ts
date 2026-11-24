'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { labelCode, sheetSlots, LABEL_SHEET } from './labelSheet';

// An IT item's QR label: it points at the item's page (/it/items/<id>). Scanning it on a phone
// opens that page; while the item has no details yet the page opens its edit form, so a label
// printed at "Quick add" is filled in later from the phone.

export const itemUrl = (origin: string, id: string) => `${origin}/it/items/${encodeURIComponent(id)}`;

export const makeQr = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 446, errorCorrectionLevel: 'M' });

/** The label's URL and QR image (data URL) for an item, built in the browser from this origin. */
export function useItemQr(id: string | null): { url: string | null; qr: string | null } {
  const [state, setState] = useState<{ url: string | null; qr: string | null }>({ url: null, qr: null });
  useEffect(() => {
    if (!id) { setState({ url: null, qr: null }); return; }
    const url = itemUrl(window.location.origin, id);
    let alive = true;
    setState({ url, qr: null });
    makeQr(url)
      .then(qr => { if (alive) setState({ url, qr }); })
      .catch(() => { if (alive) setState({ url, qr: null }); });
    return () => { alive = false; };
  }, [id]);
  return state;
}

export interface PrintableLabel { name: string; url: string; qr: string; detail?: string | null }

/**
 * Prints labels on an A4 sticker sheet (LABEL_SHEET: 3 × 8 = 24 labels of 63.5 × 33.9 mm), from
 * cell `startAt` (0 = top-left, row by row). Every label keeps its fixed cell size and place, so a
 * single label prints exactly where that sticker is; more labels run on to further sheets.
 */
export function printLabelSheet(labels: PrintableLabel[], startAt = 0) {
  if (!labels.length) return;
  const w = window.open('', '_blank', 'width=640,height=860');
  if (!w) {
    toast.error('Allow pop-ups for this site to print the labels');
    return;
  }
  const S = LABEL_SHEET;
  const d = w.document;
  d.title = labels.length === 1 ? `Label · ${labels[0].name}` : `${labels.length} IT labels`;
  const style = d.createElement('style');
  style.textContent = [
    '@page{size:A4;margin:0}',
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    `.sheet{position:relative;width:${S.pageWidth}mm;height:${S.pageHeight}mm;overflow:hidden;break-after:page;page-break-after:always}`,
    '.sheet:last-child{break-after:auto;page-break-after:auto}',
    `.label{position:absolute;width:${S.labelWidth}mm;height:${S.labelHeight}mm;padding:2.6mm 3mm 2.6mm 2.6mm;display:flex;align-items:center;gap:2.4mm;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000}`,
    `.qr{width:${S.qrSize}mm;height:${S.qrSize}mm;flex:none;image-rendering:pixelated}`,
    `.text{flex:1;min-width:0;height:${S.qrSize}mm;display:flex;flex-direction:column;justify-content:space-between}`,
    '.name{font-size:10pt;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
    '.detail{font-size:7pt;line-height:1.2;margin-top:0.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.code{font-family:Consolas,Menlo,monospace;font-size:9.5pt;font-weight:700;letter-spacing:0.02em}',
    '.brand{font-size:5.5pt;letter-spacing:0.08em;text-transform:uppercase}',
    // On screen: the sheet with faint cell outlines, so the preview shows where each label lands.
    '@media screen{body{background:#e9edf2;padding:16px}.sheet{background:#fff;margin:0 auto 16px;box-shadow:0 1px 6px rgba(0,0,0,.2)}.cell{position:absolute;border:1px dashed #c9d1dc;border-radius:2mm}}',
    '@media print{.cell{display:none}}',
  ].join('');
  d.head.appendChild(style);

  const el = (tag: string, cls: string, text?: string) => {
    const n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const place = (n: HTMLElement, row: number, col: number) => {
    n.style.left = `${S.marginLeft + col * S.pitchX}mm`;
    n.style.top = `${S.marginTop + row * S.pitchY}mm`;
  };

  const slots = sheetSlots(labels.length, startAt);
  const sheets: HTMLElement[] = [];
  const sheet = (i: number) => {
    while (sheets.length <= i) {
      const s = el('div', 'sheet');
      for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
        const cell = el('div', 'cell');
        cell.style.width = `${S.labelWidth}mm`;
        cell.style.height = `${S.labelHeight}mm`;
        place(cell, r, c);
        s.append(cell);
      }
      sheets.push(s);
      d.body.append(s);
    }
    return sheets[i];
  };

  const images: Promise<void>[] = [];
  labels.forEach((l, i) => {
    const { page, row, col } = slots[i];
    const label = el('div', 'label');
    place(label, row, col);
    const img = d.createElement('img');
    img.className = 'qr';
    img.alt = '';
    images.push(new Promise(res => { img.onload = () => res(); img.onerror = () => res(); }));
    img.src = l.qr;
    const text = el('div', 'text');
    const top = el('div', '');
    top.append(el('div', 'name', l.name));
    if (l.detail) top.append(el('div', 'detail', l.detail));
    const bottom = el('div', '');
    bottom.append(el('div', 'code', labelCode(l.url)), el('div', 'brand', 'Trust Lines · IT'));
    text.append(top, bottom);
    label.append(img, text);
    sheet(page).append(label);
  });

  void Promise.all(images).then(() => {
    w.focus();
    w.addEventListener('afterprint', () => w.close());
    w.print();
  });
}
