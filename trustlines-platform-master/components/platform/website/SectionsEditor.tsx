'use client';

import { ArrowUp, ArrowDown, Trash2, Plus, ImagePlus, X } from 'lucide-react';
import { ImageField } from './ImageField';

// showImage is editor-only state ("Add image" clicked); the API ignores it.
export interface EditorSection { heading: string; body: string; image_url: string; image_alt: string; showImage?: boolean }

export function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const c = arr.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

interface Props {
  sections: EditorSection[];
  onChange: (next: EditorSection[]) => void;
  /** ImageKit folder for block images. */
  folder: string;
  canEdit: boolean;
  /** 'always' = photo slot on every block (projects); 'optional' = text only until "Add image" is clicked (blog). */
  images?: 'always' | 'optional';
}

// Ordered heading / text / optional-photo blocks. Used by both the project and blog editors.
export function SectionsEditor({ sections, onChange, folder, canEdit, images = 'always' }: Props) {
  const patch = (i: number, p: Partial<EditorSection>) => onChange(sections.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const ro = !canEdit;
  // Whether this block currently shows a photo slot.
  const hasSlot = (s: EditorSection) => images === 'always' ? (!!s.image_url || canEdit) : (!!s.image_url || !!s.showImage);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {sections.map((s, i) => (
        <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--fg-subtle)' }}>Block {i + 1}</span>
            {canEdit && (
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => onChange(moveItem(sections, i, -1))}><ArrowUp size={13} /></button>
                <button className="btn btn-ghost btn-sm" disabled={i === sections.length - 1} onClick={() => onChange(moveItem(sections, i, 1))}><ArrowDown size={13} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => onChange(sections.filter((_, j) => j !== i))}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: hasSlot(s) ? '1fr 220px' : '1fr', gap: 14 }}>
            <div>
              <input className="form-input" style={{ width: '100%', marginBottom: 10 }} placeholder="Heading" disabled={ro}
                value={s.heading} onChange={e => patch(i, { heading: e.target.value })} />
              <textarea className="form-input" style={{ width: '100%', minHeight: 120 }} placeholder="Text" disabled={ro}
                value={s.body} onChange={e => patch(i, { body: e.target.value })} />
              {images === 'optional' && canEdit && !hasSlot(s) && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => patch(i, { showImage: true })}>
                  <ImagePlus size={13} style={{ marginRight: 4 }} /> Add image
                </button>
              )}
            </div>
            {hasSlot(s) && (
              <div>
                <ImageField value={s.image_url} height={150} disabled={ro} folder={folder} label="Block image"
                  onChange={u => patch(i, { image_url: u })} />
                {images === 'optional' && canEdit && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => patch(i, { image_url: '', image_alt: '', showImage: false })}>
                    <X size={12} style={{ marginRight: 4 }} /> Remove image
                  </button>
                )}
                {s.image_url && (
                  <input className="form-input" style={{ width: '100%', marginTop: 8, fontSize: 12 }} placeholder="Alt text" disabled={ro}
                    value={s.image_alt} onChange={e => patch(i, { image_alt: e.target.value })} />
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {canEdit && (
        <button className="btn btn-secondary" style={{ justifySelf: 'start' }}
          onClick={() => onChange([...sections, { heading: '', body: '', image_url: '', image_alt: '' }])}>
          <Plus size={14} style={{ marginRight: 5 }} /> Add block
        </button>
      )}
    </div>
  );
}
