'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, ExternalLink } from 'lucide-react';
import { BLOG_CATEGORIES, slugify } from '@/lib/web-cms/config';
import { ImageField } from './ImageField';
import { SectionsEditor, type EditorSection } from './SectionsEditor';

export interface EditorPost {
  id: string | null;
  title: string; slug: string; excerpt: string; category: string; author: string;
  cover_image_url: string; cover_image_alt: string; published_at: string; is_published: boolean;
}

interface Props {
  initial: { post: EditorPost; sections: EditorSection[] };
  canEdit: boolean;
  siteUrl: string;
}

const label = (t: string) => <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t}</label>;
const sectionTitle = (t: string, hint?: string) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
    {hint && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{hint}</div>}
  </div>
);

const today = () => new Date().toISOString().slice(0, 10);

export function PostEditorClient({ initial, canEdit, siteUrl }: Props) {
  const router = useRouter();
  const [post, setPost] = useState(initial.post);
  const [sections, setSections] = useState(initial.sections);
  const [slugTouched, setSlugTouched] = useState(initial.post.id !== null);
  const [saving, setSaving] = useState(false);

  const isNew = post.id === null;
  const ro = !canEdit;
  const base = `/store-maker/blog/${post.slug || 'draft'}`;
  const set = <K extends keyof EditorPost>(k: K, v: EditorPost[K]) => setPost(p => ({ ...p, [k]: v }));
  const scheduled = post.is_published && post.published_at > today();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(isNew ? '/api/web-cms/posts' : `/api/web-cms/posts/${post.id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post, sections }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      toast.success(b.refreshed ? 'Saved — website refreshed' : 'Saved — website updates within a minute');
      if (isNew) router.replace(`/marketing/website/blog/${b.post.id}`);
      else { set('slug', b.post.slug); router.refresh(); }
    } finally { setSaving(false); }
  }

  async function remove() {
    if (isNew || !confirm(`Delete "${post.title}" from the website? Its images stay in ImageKit.`)) return;
    const res = await fetch(`/api/web-cms/posts/${post.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not delete'); return; }
    toast.success('Post deleted');
    router.push('/marketing/website?tab=blog');
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/marketing/website?tab=blog" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>{isNew ? 'New post' : post.title || 'Post'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isNew && post.is_published && !scheduled && (
            <a href={`${siteUrl}/blog/${post.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={13} style={{ marginRight: 4 }} /> View on site
            </a>
          )}
          {canEdit && !isNew && <button className="btn btn-ghost btn-sm" onClick={remove}><Trash2 size={13} style={{ color: '#dc2626' }} /></button>}
          {canEdit && <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="card"><div className="card-body">
            {sectionTitle('Post', 'The title and summary appear on the blog card and at the top of the article.')}
            <div style={{ marginBottom: 14 }}>{label('Title')}
              <input className="form-input" style={{ width: '100%' }} disabled={ro} value={post.title} placeholder="Five ways to plan a c-store remodel"
                onChange={e => setPost(p => ({ ...p, title: e.target.value, slug: slugTouched ? p.slug : slugify(e.target.value) }))} />
            </div>
            <div>{label('Summary')}
              <textarea className="form-input" style={{ width: '100%', minHeight: 90 }} disabled={ro} value={post.excerpt}
                placeholder="Short summary: shown on the card and as the article intro."
                onChange={e => set('excerpt', e.target.value)} />
            </div>
          </div></div>

          <div className="card"><div className="card-body">
            {sectionTitle('Article body', 'Heading + text blocks, shown in order under the title. Line breaks in the text are kept.')}
            <SectionsEditor sections={sections} onChange={setSections} folder={`${base}/sections`} canEdit={canEdit} withImages={false} />
          </div></div>
        </div>

        <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 16 }}>
          <div className="card"><div className="card-body">
            {sectionTitle('Publishing')}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, cursor: ro ? 'default' : 'pointer' }}>
              <input type="checkbox" disabled={ro} checked={post.is_published} onChange={e => set('is_published', e.target.checked)} />
              {post.is_published ? 'Published' : 'Draft — hidden from the website'}
            </label>
            {scheduled && <div style={{ fontSize: 12, color: '#d97706', marginBottom: 10 }}>Scheduled — appears on {post.published_at}.</div>}
            <div style={{ marginTop: 10 }}>{label('Date shown')}
              <input className="form-input" style={{ width: '100%' }} type="date" disabled={ro} value={post.published_at} onChange={e => set('published_at', e.target.value)} />
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 3 }}>A future date hides the post until then.</div>
            </div>
            <div style={{ marginTop: 14 }}>{label('Category')}
              <select className="form-select" style={{ width: '100%' }} disabled={ro} value={post.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select…</option>
                {BLOG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 14 }}>{label('Author')}
              <input className="form-input" style={{ width: '100%' }} disabled={ro} value={post.author} placeholder="Jane Doe" onChange={e => set('author', e.target.value)} />
            </div>
            <div style={{ marginTop: 14 }}>{label('URL slug')}
              <input className="form-input" style={{ width: '100%' }} disabled={ro} value={post.slug}
                onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 3, wordBreak: 'break-all' }}>{siteUrl}/blog/{post.slug || '…'}</div>
            </div>
          </div></div>

          <div className="card"><div className="card-body">
            {sectionTitle('Cover image', 'Blog card image and article hero.')}
            <ImageField value={post.cover_image_url} onChange={u => set('cover_image_url', u)} folder={`${base}/cover`} disabled={ro} height={190} label="Cover" />
            <input className="form-input" style={{ width: '100%', marginTop: 8, fontSize: 12 }} placeholder="Alt text" disabled={ro}
              value={post.cover_image_alt} onChange={e => set('cover_image_alt', e.target.value)} />
          </div></div>

          <div className="card"><div className="card-body">
            {sectionTitle('Blog info box', 'How the article sidebar reads on the website.')}
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, fontSize: 12.5, display: 'grid', gap: 10 }}>
              {[
                ['Author', post.author || '—'],
                ['Tag', BLOG_CATEGORIES.find(c => c.value === post.category)?.label ?? '—'],
                ['Publish Date', post.published_at || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>{k}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div></div>
        </div>
      </div>
    </>
  );
}
