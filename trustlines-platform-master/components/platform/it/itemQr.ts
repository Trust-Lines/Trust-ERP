'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

// An IT item's QR label: it points at the item's page (/it/items/<id>). Scanning it on a phone
// opens that page; while the item has no details yet the page opens its edit form, so a label
// printed at "Quick add" is filled in later from the phone.

/** The label's URL and QR image (data URL) for an item, built in the browser from this origin. */
export function useItemQr(id: string | null): { url: string | null; qr: string | null } {
  const [state, setState] = useState<{ url: string | null; qr: string | null }>({ url: null, qr: null });
  useEffect(() => {
    if (!id) { setState({ url: null, qr: null }); return; }
    const url = `${window.location.origin}/it/items/${encodeURIComponent(id)}`;
    let alive = true;
    setState({ url, qr: null });
    QRCode.toDataURL(url, { margin: 1, width: 446, errorCorrectionLevel: 'M' })
      .then(qr => { if (alive) setState({ url, qr }); })
      .catch(() => { if (alive) setState({ url, qr: null }); });
    return () => { alive = false; };
  }, [id]);
  return state;
}

// DYMO LabelWriter "Durable Labels" 1933084 — 2¼" × 1¼" (57 × 32 mm), landscape. The page size
// below makes the browser print on the label with no margins; in the print dialog pick the DYMO
// printer, paper "1933084 / 2-1/4 x 1-1/4" if the driver asks, Margins None, Scale 100%.
export const LABEL_STOCK = { name: 'DYMO Durable 1933084', width: '2.25in', height: '1.25in' } as const;

/** Short code printed on the label: "IT-" + the last 6 characters of the item id. */
export function labelCode(url: string): string {
  const id = decodeURIComponent(url.split('/').filter(Boolean).pop() ?? '');
  return `IT-${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}

/**
 * Opens a window holding one DYMO 1933084 label — QR on the left; item name, an optional detail
 * line ("PC · PC 1 · Istanbul") and the short code on the right — and prints it.
 */
export function printLabel(name: string, url: string, qr: string, detail?: string | null) {
  const w = window.open('', '_blank', 'width=520,height=360');
  if (!w) {
    toast.error('Allow pop-ups for this site to print the label');
    return;
  }
  const d = w.document;
  d.title = `Label · ${name}`;
  const style = d.createElement('style');
  style.textContent = [
    `@page{size:${LABEL_STOCK.width} ${LABEL_STOCK.height};margin:0}`,
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    `.label{width:${LABEL_STOCK.width};height:${LABEL_STOCK.height};padding:0.07in 0.09in 0.07in 0.07in;display:flex;align-items:center;gap:0.08in;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000;page-break-after:avoid;break-after:avoid}`,
    '.qr{width:1.08in;height:1.08in;flex:none;image-rendering:pixelated}',
    '.text{flex:1;min-width:0;height:1.08in;display:flex;flex-direction:column;justify-content:space-between}',
    '.name{font-size:10pt;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
    '.detail{font-size:7pt;line-height:1.2;margin-top:0.03in;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.code{font-family:Consolas,Menlo,monospace;font-size:9pt;font-weight:700;letter-spacing:0.02em}',
    '.brand{font-size:5.5pt;letter-spacing:0.08em;text-transform:uppercase}',
    '@media screen{body{display:grid;place-items:center;min-height:100vh;background:#e9edf2}.label{background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.2)}}',
  ].join('');
  d.head.appendChild(style);

  const el = (tag: string, cls: string, text?: string) => {
    const n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const label = el('div', 'label');
  const img = d.createElement('img');
  img.className = 'qr';
  img.alt = '';
  const text = el('div', 'text');
  const top = el('div', '');
  top.append(el('div', 'name', name));
  if (detail) top.append(el('div', 'detail', detail));
  const bottom = el('div', '');
  bottom.append(el('div', 'code', labelCode(url)), el('div', 'brand', 'Trust Lines · IT'));
  text.append(top, bottom);
  label.append(img, text);
  d.body.append(label);

  img.onload = () => {
    w.focus();
    w.addEventListener('afterprint', () => w.close());
    w.print();
  };
  img.src = qr;
}
