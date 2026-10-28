import { describe, expect, it } from 'vitest';
import { assetFolder, brandKitFolder, cleanColors, cleanFonts, materialFields, normalizeHex, parseTags } from '@/lib/design/libraryPaths';
import { pageAllowed } from '@/lib/permissions/catalog';

describe('design library helpers', () => {
  it('normalizes hex colours', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('0a2540')).toBe('#0A2540');
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
  });
  it('keeps only valid colours and named fonts', () => {
    expect(cleanColors([{ name: 'Primary', hex: '#0a2540' }, { hex: 'nope' }, { hex: '#fff' }])).toEqual([
      { name: 'Primary', hex: '#0A2540' }, { name: '#FFFFFF', hex: '#FFFFFF' },
    ]);
    expect(cleanColors('x')).toEqual([]);
    expect(cleanFonts('Inter, Playfair Display,, Inter')).toEqual(['Inter', 'Playfair Display']);
  });
  it('parses tags', () => {
    expect(parseTags('Millwork, counter,MILLWORK, ')).toEqual(['millwork', 'counter']);
    expect(parseTags(['A', 'b'])).toEqual(['a', 'b']);
  });
  it('builds library folders', () => {
    expect(assetFolder('cad_block')).toBe('/Design/Library/CAD Blocks');
    expect(assetFolder('weird')).toBe('/Design/Library/Other');
    expect(brandKitFolder('1234567890', 'Acme / Stores')).toBe('/Design/Brand Kits/Acme Stores - 12345678');
  });
});

describe('materialFields', () => {
  const ROOT = '/Design/Materials';
  it('requires a name and cleans the rest', () => {
    expect(materialFields({}, ROOT)).toEqual({ error: 'Name the material' });
    const r = materialFields({ name: ' Oak ', category: 'wood', price: '12.345', currency: 'eur', color_hex: '#abc', image_path: '' }, ROOT);
    expect(r).toMatchObject({ value: { name: 'Oak', category: 'wood', price: 12.35, currency: 'USD', color_hex: '#AABBCC', image_path: null } });
  });
  it('rejects bad prices and photos outside the materials folder', () => {
    expect(materialFields({ name: 'x', price: '-1' }, ROOT)).toEqual({ error: 'Price must be a positive number' });
    expect(materialFields({ name: 'x', image_path: '/Design/Other/a.jpg' }, ROOT)).toEqual({ error: 'Invalid photo' });
    expect(materialFields({ name: 'x', image_path: '/Design/Materials/../x.jpg' }, ROOT)).toEqual({ error: 'Invalid photo' });
  });
  it('PATCH only touches the fields sent', () => {
    expect(materialFields({ price: '5' }, ROOT, true)).toEqual({ value: { price: 5 } });
  });
});

describe('design library pages follow the Design workspace switch', () => {
  it('inherits page.design until set separately', () => {
    expect(pageAllowed('designer', { 'page.design': true }, 'page.design_assets')).toBe(true);
    expect(pageAllowed('designer', { 'page.design': false }, 'page.design_materials')).toBe(false);
    expect(pageAllowed('designer', { 'page.design': true, 'page.design_reviews': false }, 'page.design_reviews')).toBe(false);
  });
});
