'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, ExternalLink, ImagePlus, Images, Loader2 } from 'lucide-react';
import { PROJECT_CATEGORIES, slugify, thumb } from '@/lib/web-cms/config';
import { ImageField } from './ImageField';
import { MediaPicker } from './MediaPicker';
import { uploadMany } from './imagekitClient';
import { WorkTypeTile } from './WorkTypeTile';
import type { WorkTypeRow } from '@/lib/web-cms/workTypes';
import { SectionsEditor, moveItem, type EditorSection } from './SectionsEditor';

export type { EditorSection };

export interface EditorProject {
  id: string | null;
  title: string; slug: string; category: string; location: string;
  project_type: string; year_built: string; cover_image_url: string; cover_image_alt: string;
  is_published: boolean; sort_order: number;
}
export interface EditorPhoto { image_url: string; alt: string }

interface Props {
  initial: { project: EditorProject; photos: EditorPhoto[]; sections: EditorSection[]; workTypes: string[] };
  canEdit: boolean;
  siteUrl: string;
  /** All types of work, or null when migration 123 is not applied yet (the picker is then hidden). */
  workTypes: WorkTypeRow[] | null;
}

const label = (t: string) => <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t}</label>;
const sectionTitle = (t: string, hint?: string) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
    {hint && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{hint}</div>}
  </div>
);

export function ProjectEditorClient({ initial, canEdit, siteUrl, workTypes }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initial.project);
  const [photos, setPhotos] = useState(initial.photos);
  const [sections, setSections] = useState(initial.sections);
  const [picked, setPicked] = useState<string[]>(initial.workTypes);
  const [slugTouched, setSlugTouched] = useState(initial.project.id !== null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isNew = project.id === null;
  const slug = project.slug || 'draft';
  const base = `/store-maker/projects/${slug}`;
  const set = <K extends keyof EditorProject>(k: K, v: EditorProject[K]) => setProject(p => ({ ...p, [k]: v }));

  function onTitle(v: string) {
    setProject(p => ({ ...p, title: v, slug: slugTouched ? p.slug : slugify(v) }));
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const { urls, errors } = await uploadMany(files, `${base}/gallery`);
    setUploading(false);
    errors.forEach(e => toast.error(e));
    if (urls.length) setPhotos(p => [...p, ...urls.map(u => ({ image_url: u, alt: '' }))]);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        project: { ...project, year_built: project.year_built === '' ? null : Number(project.year_built) },
        photos, sections,
        // Only sent when the picker is available, so saving keeps working before migration 123.
        ...(workTypes ? { workTypes: picked } : {}),
      };
      const res = await fetch(isNew ? '/api/web-cms/projects' : `/api/web-cms/projects/${project.id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      toast.success(b.refreshed ? 'Saved — website refreshed' : 'Saved — website updates within a minute');
      if (isNew) router.replace(`/marketing/website/projects/${b.project.id}`);
      else { set('slug', b.project.slug); router.refresh(); }
    } finally { setSaving(false); }
  }

  async function remove() {
    if (isNew || !confirm(`Delete "${project.title}" from the website? Its images stay in ImageKit.`)) return;
    const res = await fetch(`/api/web-cms/projects/${project.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not delete'); return; }
    toast.success('Project deleted');
    router.push('/marketing/website');
  }

  const ro = !canEdit;
  const input = (k: keyof EditorProject, placeholder?: string, type = 'text') => (
    <input
      className="form-input" style={{ width: '100%' }} type={type} disabled={ro} placeholder={placeholder}
      value={String(project[k] ?? '')} onChange={e => set(k, e.target.value as never)}
    />
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/marketing/website" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>{isNew ? 'New project' : project.title || 'Project'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isNew && project.is_published && (
            <a href={`${siteUrl}/projects/${project.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={13} style={{ marginRight: 4 }} /> View on site
            </a>
          )}
          {canEdit && !isNew && <button className="btn btn-ghost btn-sm" onClick={remove}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>}
          {canEdit && <button className="btn btn-primary" disabled={saving || uploading} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="card"><div className="card-body">
            {sectionTitle('Details', 'Shown on the gallery card and the project page header.')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>{label('Title')}{(
                <input className="form-input" style={{ width: '100%' }} disabled={ro} placeholder="Teddy, Milford"
                  value={project.title} onChange={e => onTitle(e.target.value)} />
              )}</div>
              <div>{label('Category')}
                <select className="form-select" style={{ width: '100%' }} disabled={ro} value={project.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select…</option>
                  {PROJECT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>{label('Location')}{input('location', 'Milford, CT, USA')}</div>
              <div>{label('Project type')}{input('project_type', 'C Store Remodel')}</div>
              <div>{label('Year')}{input('year_built', '2024', 'number')}</div>
            </div>
          </div></div>

          {workTypes && (
            <div className="card"><div className="card-body">
              {sectionTitle('Types of work', 'Tap the kinds of work this project covered. Visitors can filter the Projects page by them.')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}>
                {workTypes.filter(t => t.is_active || picked.includes(t.slug)).map(t => (
                  <WorkTypeTile
                    key={t.id} slug={t.slug} label={t.label} iconUrl={t.icon_url} siteUrl={siteUrl} size={112}
                    selected={picked.includes(t.slug)} dimmed={!t.is_active}
                    title={t.is_active ? undefined : 'Retired type — untick to remove it from this project'}
                    onClick={canEdit ? () => setPicked(p => (p.includes(t.slug) ? p.filter(x => x !== t.slug) : [...p, t.slug])) : undefined}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 8 }}>
                {picked.length ? `${picked.length} selected` : "None selected — this project won't match any tile filter."}
              </div>
            </div></div>
          )}

          <div className="card"><div className="card-body">
            {sectionTitle('Photo carousel', 'Top of the project page. Order matters — the first photo leads.')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {photos.map((ph, i) => (
                <div key={i + ph.image_url} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(ph.image_url, 400)} alt={ph.alt} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 6 }}>
                    <input className="form-input" style={{ width: '100%', fontSize: 11.5, padding: '4px 6px' }} placeholder="Alt text" disabled={ro}
                      value={ph.alt} onChange={e => setPhotos(a => a.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                    {canEdit && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => setPhotos(a => moveItem(a, i, -1))}><ArrowUp size={12} /></button>
                        <button className="btn btn-ghost btn-sm" disabled={i === photos.length - 1} onClick={() => setPhotos(a => moveItem(a, i, 1))}><ArrowDown size={12} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPhotos(a => a.filter((_, j) => j !== i))}><Trash2 size={12} style={{ color: '#dc2626' }} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {canEdit && (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
                  style={{ border: '2px dashed var(--border-subtle)', borderRadius: 10, minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }}
                >
                  {uploading ? <Loader2 size={20} className="animate-spin" /> : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><ImagePlus size={13} style={{ marginRight: 4 }} /> Upload</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setPicking(true)}><Images size={13} style={{ marginRight: 4 }} /> Library</button>
                      <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>or drop files</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            {picking && <MediaPicker multiple onClose={() => setPicking(false)} onPick={urls => { setPicking(false); setPhotos(p => [...p, ...urls.map(u => ({ image_url: u, alt: '' }))]); }} />}
          </div></div>

          <div className="card"><div className="card-body">
            {sectionTitle('Content blocks', 'Text under the info bar. With a photo the block is text + image (the photo side alternates automatically); without one it is full-width text.')}
            <SectionsEditor sections={sections} onChange={setSections} folder={`${base}/sections`} canEdit={canEdit} />
          </div></div>
        </div>

        <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 16 }}>
          <div className="card"><div className="card-body">
            {sectionTitle('Publishing')}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: ro ? 'default' : 'pointer' }}>
              <input type="checkbox" disabled={ro} checked={project.is_published} onChange={e => set('is_published', e.target.checked)} />
              {project.is_published ? 'Published on the website' : 'Draft — hidden from the website'}
            </label>
            {label('URL slug')}
            <input className="form-input" style={{ width: '100%' }} disabled={ro} value={project.slug}
              onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', margin: '3px 0 14px', wordBreak: 'break-all' }}>{siteUrl}/projects/{project.slug || '…'}</div>
            {label('Sort order')}
            <input className="form-input" style={{ width: '100%' }} type="number" disabled={ro} value={project.sort_order}
              onChange={e => set('sort_order', Number(e.target.value) || 0)} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 3 }}>Lower shows first; ties: newest first.</div>
          </div></div>

          <div className="card"><div className="card-body">
            {sectionTitle('Cover image', 'Card image in the gallery.')}
            <ImageField value={project.cover_image_url} onChange={u => set('cover_image_url', u)} folder={`${base}/cover`} disabled={ro} height={190} label="Cover" />
            <input className="form-input" style={{ width: '100%', marginTop: 8, fontSize: 12 }} placeholder="Alt text" disabled={ro}
              value={project.cover_image_alt} onChange={e => set('cover_image_alt', e.target.value)} />
          </div></div>
        </div>
      </div>
    </>
  );
}
