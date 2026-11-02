// Browser-only. A link's QR code as a downloaded file: PNG (1024 px) or SVG (scales to any print size).
import QRCode from 'qrcode';

export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'product';

export async function downloadQr(url: string, name: string, kind: 'png' | 'svg') {
  const opts = { margin: 2, errorCorrectionLevel: 'M' as const };
  if (kind === 'svg') {
    downloadBlob(`QR-${fileSafe(name)}.svg`, new Blob([await QRCode.toString(url, { ...opts, type: 'svg' })], { type: 'image/svg+xml' }));
  } else {
    downloadBlob(`QR-${fileSafe(name)}.png`, await (await fetch(await QRCode.toDataURL(url, { ...opts, width: 1024 }))).blob());
  }
}
