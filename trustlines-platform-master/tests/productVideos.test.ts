import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { isVideoSlug, newVideoSlug, productUploadName, stickerFieldsFrom } from '@/lib/design/productVideos';
import { buildStoreMakerSticker } from '@/lib/stickers/storeMakerSticker';

describe('product video slugs', () => {
  it('are short, url-safe and accepted by the public routes', () => {
    const s = newVideoSlug();
    expect(s).toMatch(/^[a-z2-9]{10}$/);
    expect(isVideoSlug(s)).toBe(true);
    expect(isVideoSlug('../etc')).toBe(false);
  });
});

describe('stickerFieldsFrom', () => {
  it('maps only the sent fields, cleaning specs and the swatch colour', () => {
    expect(stickerFieldsFrom({ title: ' Front Shelves 48" ', specs: '- MDF Body\n\n• LED Strips\nMetal Legs\nInstallation Package\nExtra', colorHex: 'ABCDEF' }))
      .toEqual({ title: 'Front Shelves 48"', specs: ['MDF Body', 'LED Strips', 'Metal Legs', 'Installation Package'], color_hex: '#abcdef' });
    expect(stickerFieldsFrom({ colorHex: 'red', category: '' })).toEqual({ color_hex: null, category: null });
    expect(stickerFieldsFrom({})).toEqual({});
  });
});

describe('buildStoreMakerSticker', () => {
  it('builds the one-page 297 × 105 mm sticker', async () => {
    const font = (w: string) => readFileSync(`public/stickers/fonts/Montserrat-${w}.ttf`);
    const bytes = await buildStoreMakerSticker({
      productCode: 'IN-FC-48/ F12 BODY', category: 'Front Counter | Cashier Area', productName: 'Front Shelves 48"',
      specs: ['MDF Body', 'LED Strips'], collection: 'Industrial', colorName: 'Black', colorHex: '#231f20',
    }, 'https://example.com/install/abcdef2345', {
      template: readFileSync('public/stickers/store-maker-template.pdf'),
      fonts: { light: font('Light'), regular: font('Regular'), medium: font('Medium'), bold: font('Bold') },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(298);
  });
});

describe('productUploadName', () => {
  it('stamps the upload so its Dropbox path is unique and known up front', () => {
    expect(productUploadName('IN-FC-48 F12 BODY', 'Web Video (2).mp4', new Date('2026-11-02T11:17:52Z')))
      .toBe('IN-FC-48 F12 BODY - 20261102-111752 - Web Video (2).mp4');
  });
});
