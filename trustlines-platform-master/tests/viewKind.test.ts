import { describe, expect, it } from 'vitest';
import { inlineMime, viewKind } from '@/lib/files/viewKind';

describe('viewKind', () => {
  it('sorts files by how the browser can show them', () => {
    expect(viewKind('JUNE26-DSNE 466-DESIGN PROPOSAL 0 3.pdf')).toBe('pdf');
    expect(viewKind('render.JPG')).toBe('image');
    expect(viewKind('walkthrough.mp4')).toBe('video');
    expect(viewKind('notes.txt')).toBe('text');
    expect(viewKind('estimate.xlsx')).toBe('office');
    expect(viewKind('plan.dwg')).toBe('none');
    expect(viewKind('scene.ls12')).toBe('none');
    expect(viewKind('noext')).toBe('none');
  });
  it('gives an inline type only to viewable files', () => {
    expect(inlineMime('a.pdf')).toBe('application/pdf');
    expect(inlineMime('a.psd')).toBeNull();
    expect(inlineMime('a.docx')).toBeNull();
  });
});
