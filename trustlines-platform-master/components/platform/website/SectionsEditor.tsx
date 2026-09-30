'use client';

import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import { ImageField } from './ImageField';

export interface EditorSection { heading: string; body: string; image_url: string; image_alt: string }

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
  /** false = heading + text only (blog articles have no in-body photos). Default true. */
  withImages?: boolean;
}

// Ordered heading / text / optional-photo blocks. Used by both the project and blog editors.
export function SectionsEditor({ sections, onChange, folder, canEdit, withImages = true }: Props) {
  const patch = (i: number, p: Partial<EditorSection>) => onChange(sections.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const ro = !canEdit;

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
          <div style={{ display: 'grid', gridTemplateColumns: withImages && (s.image_url || canEdit) ? '1fr 220px' : '1fr', gap: 14 }}>
            <div>
              <input className="form-input" style={{ width: '100%', marginBottom: 10 }} placeholder="Heading" disabled={ro}
                value={s.heading} onChange={e => patch(i, { heading: e.target.value })} />
              <textarea className="form-input" style={{ width: '100%', minHeight: 120 }} placeholder="Text" disabled={ro}
                value={s.body} onChange={e => patch(i, { body: e.target.value })} />
            </div>
            {withImages && (s.image_url || canEdit) && (
              <div>
                <ImageField value={s.image_url} height={150} disabled={ro} folder={folder} label="Block image"
                  onChange={u => patch(i, { image_url: u })} />
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
