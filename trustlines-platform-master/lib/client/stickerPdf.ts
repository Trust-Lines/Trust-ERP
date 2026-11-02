// Browser-only. Builds a product's Store Maker packaging sticker (lib/stickers/storeMakerSticker)
// with the QR code of its installation-video page, from the template and fonts in /public/stickers.
import { buildStoreMakerSticker, type StickerData } from '@/lib/stickers/storeMakerSticker';

let assets: Promise<{ template: ArrayBuffer; fonts: { light: ArrayBuffer; regular: ArrayBuffer; medium: ArrayBuffer; bold: ArrayBuffer } }> | null = null;

function loadAssets() {
  const get = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url}`);
    return res.arrayBuffer();
  };
  assets ??= (async () => {
    const [template, light, regular, medium, bold] = await Promise.all([
      get('/stickers/store-maker-template.pdf'),
      ...['Light', 'Regular', 'Medium', 'Bold'].map(w => get(`/stickers/fonts/Montserrat-${w}.ttf`)),
    ]);
    return { template, fonts: { light, regular, medium, bold } };
  })().catch(e => { assets = null; throw e; });
  return assets;
}

/** The sticker as a PDF blob. `imageUrl` → the product drawing (PNG/JPG), when it has one. */
export async function stickerPdf(data: StickerData, qrUrl: string, imageUrl?: string | null): Promise<Blob> {
  const base = await loadAssets();
  let image: { bytes: ArrayBuffer; type: 'png' | 'jpg' } | null = null;
  if (imageUrl) {
    const res = await fetch(imageUrl);
    if (res.ok) image = { bytes: await res.arrayBuffer(), type: (res.headers.get('Content-Type') ?? '').includes('png') ? 'png' : 'jpg' };
  }
  const bytes = await buildStoreMakerSticker(data, qrUrl, { ...base, image });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
