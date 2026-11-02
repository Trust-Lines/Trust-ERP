// T Lines Store Maker packaging sticker (297 × 105 mm) — the "Packaging sticker Store Maker
// Template" rebuilt from a product's details, with the QR code of its installation video.
//
// The left logo band is taken from the template itself (vector, clipped to the band); the title
// banner is the template's own path; everything else is drawn here at the template's positions,
// in its CMYK colours and Montserrat weights. Runs in the browser (and in Node for tests).
import { PDFDocument, cmyk, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

export interface StickerData {
  productCode: string;          // "IN-FC-48/ F12 BODY"
  category: string | null;      // "Front Counter | Cashier Area"
  productName: string | null;   // FRONT SHELVES 48"
  specs: string[];              // MDF Body, LED Strips…
  collection: string | null;    // INDUSTRIAL
  colorName: string | null;     // BLACK
  colorHex: string | null;      // #231f20
}

export interface StickerAssets {
  template: ArrayBuffer | Uint8Array;
  fonts: { light: ArrayBuffer | Uint8Array; regular: ArrayBuffer | Uint8Array; medium: ArrayBuffer | Uint8Array; bold: ArrayBuffer | Uint8Array };
  image?: { bytes: ArrayBuffer | Uint8Array; type: 'png' | 'jpg' } | null;
}

const W = 841.89, H = 297.638;
const GREEN_OP = '0.68 0.434 0.629 0.246 k';   // the template's banner green (CMYK fill)
const CREAM = cmyk(0.039, 0.074, 0.164, 0);
const INK = cmyk(0, 0, 0, 0.7);
const BAND_RIGHT = 112;   // the logo band ends at x ≈ 108.6; the title banner starts at ≈ 136.6

// The template's title banner, verbatim (PDF user space).
const BANNER_OPS = `q 1 0 0 1 850.3938 280.3778 cm
0 0 m 0 -64.44 l -653.304 -64.44 l -680.684 -65.1 l
-683.284 -65.16 -685.734 -63.85 -687.124 -61.64 c -712.104 -22.04 l
-713.834 -19.29 -713.574 -15.74 -711.464 -13.27 c -702.334 -2.6 l
-700.924 -0.95 -698.864 0 -696.694 0 c h f Q`;

function hexColor(hex: string | null | undefined): Color | null {
  const m = String(hex ?? '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Largest size ≤ `size` at which `text` fits in `maxWidth`. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number, min = 6): number {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      // Slight overlap so print shows no hairlines between modules.
      page.drawRectangle({ x: x + c * cell, y: y + size - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: cmyk(0, 0, 0, 1) });
    }
  }
}

export async function buildStoreMakerSticker(data: StickerData, qrUrl: string, assets: StickerAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${data.productCode} — packaging sticker`);
  doc.setCreator('T Lines Store Maker');
  const page = doc.addPage([W, H]);

  // 1. Title banner (the template's path) in its own content stream, added first so the band and
  //    all the text are painted on top of it.
  page.node.addContentStream(doc.context.register(doc.context.flateStream(`${GREEN_OP}\n${BANNER_OPS}`)));

  // 2. Logo band, straight from the template.
  const template = await PDFDocument.load(assets.template);
  const band =await doc.embedPage(template.getPage(0), { left: 0, bottom: 0, right: BAND_RIGHT, top: H });
  page.drawPage(band, { x: 0, y: 0 });

  const [light, regular, medium, bold] = await Promise.all([
    doc.embedFont(assets.fonts.light, { subset: true }), doc.embedFont(assets.fonts.regular, { subset: true }),
    doc.embedFont(assets.fonts.medium, { subset: true }), doc.embedFont(assets.fonts.bold, { subset: true }),
  ]);

  const code = data.productCode.trim();
  page.drawText(code, { x: 178.1, y: 230.45, size: fit(bold, code, 51.82, 640), font: bold, color: CREAM });

  // 3. Category ("Front Counter | Cashier Area") and product name.
  const left = 183;
  if (data.category?.trim()) {
    const [a, ...rest] = data.category.split('|').map(s => s.trim()).filter(Boolean);
    let x = left;
    const size = 17;
    page.drawText(a, { x, y: 190, size, font: regular, color: INK });
    x += regular.widthOfTextAtSize(a, size);
    for (const part of rest) {
      page.drawText('|', { x: x + 5, y: 191, size: size * 0.75, font: light, color: INK });
      x += 5 + light.widthOfTextAtSize('|', size * 0.75) + 5;
      page.drawText(part, { x, y: 190, size, font: regular, color: INK });
      x += regular.widthOfTextAtSize(part, size);
    }
  }
  if (data.productName?.trim()) {
    const name = data.productName.trim().toUpperCase();
    page.drawText(name, { x: left, y: 162, size: fit(bold, name, 24.5, 420), font: bold, color: INK });
  }

  // 4. QR code + divider + specifications.
  drawQr(page, qrUrl, 179, 29.5, 73.5);
  page.drawLine({ start: { x: 280.8, y: 31 }, end: { x: 280.8, y: 101 }, thickness: 0.6, color: INK });
  page.drawText('SPECIFICATIONS', { x: 307, y: 106, size: 8.5, font: light, color: INK });
  data.specs.map(s => s.trim()).filter(Boolean).slice(0, 4).forEach((spec, i) => {
    const y = 85.6 - i * 18.8;
    page.drawText('-', { x: 305, y: y + 0.5, size: 10, font: regular, color: INK });
    page.drawText(spec, { x: 314, y, size: fit(medium, spec, 14.5, 250), font: medium, color: INK });
  });

  // 5. Product drawing, fitted into the template's picture box.
  if (assets.image) {
    const img = assets.image.type === 'png' ? await doc.embedPng(assets.image.bytes) : await doc.embedJpg(assets.image.bytes);
    const box = { x: 622, y: 64, w: 176, h: 150 };
    const s = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * s, h = img.height * s;
    page.drawImage(img, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
  }

  // 6. Collection + colour.
  if (data.collection?.trim()) {
    page.drawText('COLLECTION', { x: 577.7, y: 44, size: 8.5, font: light, color: INK });
    const v = data.collection.trim().toUpperCase();
    page.drawText(v, { x: 577.7, y: 27.5, size: fit(light, v, 16, 104), font: light, color: INK });
  }
  if (data.colorName?.trim()) {
    page.drawText('COLOR', { x: 688.8, y: 44, size: 8.5, font: light, color: INK });
    const v = data.colorName.trim().toUpperCase();
    page.drawText(v, { x: 688.8, y: 27.5, size: fit(light, v, 16, 66), font: light, color: INK });
  }
  const swatch = hexColor(data.colorHex);
  if (swatch) page.drawRectangle({ x: 759.2, y: 28.1, width: 24.2, height: 24.2, color: swatch });

  return doc.save();
}
