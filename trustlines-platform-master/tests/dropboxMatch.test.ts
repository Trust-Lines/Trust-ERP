import { describe, expect, it } from 'vitest';
import { clientOf, folderKey, looksLikeProject, matchProject, placeOf, type MatchProject } from '@/lib/dropbox/match';

const NW = '/D-Projects/T LINES/1-Store Maker/T Lines NW Projects';
const f = (p: string) => ({ path_display: p, path_lower: p.toLowerCase(), name: p.split('/').pop()! });
const proj = (o: Partial<MatchProject>): MatchProject => ({
  id: 'x', code: null, name: null, region: 'TLINES_NW', service_line: 'store_maker', current_stage: 'finalization', dropbox_root_path: null, ...o,
});

describe('folder names', () => {
  it('recognizes project folders, not years or step folders', () => {
    for (const n of ['STNE 409 - Town', '409-Briarcliff Manor', 'PSNW480-Brookfield', 'EX-5 NACS EXHIBITION', '13P', 'P-12R', '1150-Marysville, WA']) expect(looksLikeProject(n)).toBe(true);
    for (const n of ['2026', '1-Finalization', '3-Production & Delivery', 'Clients', 'Under Working', 'T Lines NW Projects']) expect(looksLikeProject(n)).toBe(false);
  });
  it('folds region prefixes and separators', () => {
    expect(folderKey('STNW408 MARKET - x')).toBe('408 MARKET X');
    expect(folderKey('PSNW480-Brookfield')).toBe('480 BROOKFIELD');
  });
  it('reads place and client', () => {
    expect(placeOf('STNW 395 - Stuart,1120 S Division St, IA')).toEqual({ city: 'Stuart', state: 'IA' });
    expect(clientOf(`${NW}/Under Working/Clients/Brew Oil/STNW 395 - Stuart`)).toBe('Brew Oil');
    expect(clientOf(`${NW}/Under Working/Individuals/408-x`)).toBeNull();
  });
});

describe('matchProject', () => {
  const folders = [
    f(`${NW}/Under Working/Clients/BREW OIL/395 - Stuart,1120 S Division St, IA`),
    f(`${NW}/Under Working/Individiuals/408-UNITED MARKET Roodhouse 1100 S State ST IL`),
    f(`${NW}/Under Working/Individiuals/408-UNITED EXPRESS Roodhouse1100 S State ST IL`),
    f(`${NW}/Under Working/Clients/CHESTNUT/490 -121 Main Street North Southbury, CT`),
    f(`${NW}/Under Working/Individiuals/490-121 Main Street North Southbury, CT`),
  ];
  it('is sure about a clear single folder', () => {
    const r = matchProject(proj({ code: 'STNW 395', name: 'STNW 395 - Stuart,1120 S Division St, IA', dropbox_root_path: '/old/Clients/Brew Oil/STNW 395' }), folders, new Set());
    expect(r.status).toBe('sure');
    expect(r.candidates[0].path).toContain('395 - Stuart');
  });
  it('tells 408 MARKET and 408 EXPRESS apart', () => {
    expect(matchProject(proj({ code: 'STNW 408 MARKET', name: 'STNW 408 MARKET - Roodhouse, 1100 S State ST IL' }), folders, new Set()).candidates[0].path).toContain('UNITED MARKET');
    expect(matchProject(proj({ code: 'STNW 408 EXPRESS', name: 'STNW 408 EXPRESS - Roodhouse, 1100 S State ST IL' }), folders, new Set()).candidates[0].path).toContain('UNITED EXPRESS');
  });
  it('leaves two equal folders to a person', () => {
    expect(matchProject(proj({ code: 'STNW 490', name: 'STNW 490 - Southbury, CT' }), folders, new Set()).status).toBe('ambiguous');
  });
  it('reports none and linked', () => {
    expect(matchProject(proj({ code: 'STSE 500' }), folders, new Set()).status).toBe('none');
    const stored = folders[0].path_display;
    expect(matchProject(proj({ code: 'STNW 395', dropbox_root_path: stored }), folders, new Set([stored.toLowerCase()])).status).toBe('linked');
  });
});
