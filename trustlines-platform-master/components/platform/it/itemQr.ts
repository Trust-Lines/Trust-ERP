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

/** Opens a small window with just the QR label and prints it. */
export function printLabel(name: string, url: string, qr: string) {
  const w = window.open('', '_blank', 'width=420,height=560');
  if (!w) {
    toast.error('Allow pop-ups for this site to print the label');
    return;
  }
  const d = w.document;
  d.title = `QR · ${name}`;
  const style = d.createElement('style');
  style.textContent = 'body{font-family:system-ui,sans-serif;text-align:center;margin:24px}h1{font-size:18px;margin:0 0 12px}img{width:260px;height:260px}p{font-size:12px;margin:12px 0 0;word-break:break-all}';
  d.head.appendChild(style);
  const h = d.createElement('h1');
  h.textContent = name;
  const img = d.createElement('img');
  img.alt = '';
  const p = d.createElement('p');
  p.textContent = url;
  d.body.append(h, img, p);
  img.onload = () => {
    w.focus();
    w.print();
  };
  img.src = qr;
}
