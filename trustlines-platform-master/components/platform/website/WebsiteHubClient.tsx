'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Globe, Plus, Pencil, ExternalLink, Eye, EyeOff, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { PROJECT_CATEGORIES, PROJECTS_PAGE_DEFAULTS, thumb, type ProjectsPageSettings } from '@/lib/web-cms/config';
import { ImageField } from './ImageField';

export interface WebProjectRow {
  id: string; slug: string; title: string; category: string; location: string;
  project_type: string | null; year_built: number | null; cover_image_url: string;
  is_published: boolean; sort_order: number; updated_at: string;
}

interface Props {
  projects: WebProjectRow[];
  settings: ProjectsPageSettings;
  canEdit: boolean;
  siteUrl: string;
  imageKitReady: boolean;
  loadError: boolean;
}

const catLabel = (v: string) => PROJECT_CATEGORIES.find(c => c.value === v)?.label ?? v;

export function WebsiteHubClient({ projects: initial, settings: initialSettings, canEdit, siteUrl, imageKitReady, loadError }: Props) {
  const [tab, setTab] = useState<'projects' | 'header'>('projects');
  const [projects, setProjects] = useState(initial);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [settings, setSettings] = useState(initialSettings);
  const [savingHeader, setSavingHeader] = useState(false);

  async function togglePublish(p: WebProjectRow) {
    const next = !p.is_published;
    const res = await fetch(`/api/web-cms/projects/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_published: next }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Could not update'); return; }
    setProjects(prev => prev.map(x => (x.id === p.id ? { ...x, is_published: next } : x)));
    toast.success(next ? 'Published on the website' : 'Hidden from the website');
  }

  async function saveHeader() {
    setSavingHeader(true);
    try {
      const res = await fetch('/api/web-cms/settings/projects_page', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not save'); return; }
      setSettings(b.value);
      toast.success(b.refreshed ? 'Saved — website refreshed' : 'Saved — website updates within a minute');
    } finally { setSavingHeader(false); }
  }

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: .4, marginBottom: 8 }} />
        <div>Website CMS isn&apos;t ready yet. Migrations 118 and 119 (web_projects, web_settings) need to be applied.</div>
      </div></div>
    );
  }

  const shown = projects.filter(p => filter === 'all' || p.category === filter);
  const count = (c: string) => projects.filter(p => p.category === c).length;
  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {node}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 3 }}>{hint}</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={22} /> Website
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            Content for <a href={siteUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{siteUrl.replace(/^https?:\/\//, '')}</a>. Changes go live within a minute.
          </p>
        </div>
        {canEdit && tab === 'projects' && (
          <Link href="/marketing/website/projects/new" className="btn btn-primary"><Plus size={14} style={{ marginRight: 5 }} /> New project</Link>
        )}
      </div>

      {!imageKitReady && canEdit && (
        <div className="card" style={{ marginBottom: 16 }}><div className="card-body" style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
          <span>Image upload is off: set <code>IMAGEKIT_PUBLIC_KEY</code> and <code>IMAGEKIT_PRIVATE_KEY</code> on the server.</span>
        </div></div>
      )}

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-item ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>Projects ({projects.length})</button>
        <button className={`tab-item ${tab === 'header' ? 'active' : ''}`} onClick={() => setTab('header')}>Projects page header</button>
      </div>

      {tab === 'projects' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>All ({projects.length})</button>
            {PROJECT_CATEGORIES.map(c => (
              <button key={c.value} className={`btn btn-sm ${filter === c.value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(c.value)}>
                {c.label} ({count(c.value)})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--fg-subtle)' }}>
              <ImageIcon size={30} style={{ opacity: .4, marginBottom: 8 }} />
              <div>No projects{filter !== 'all' ? ' in this category' : ' yet'}.{canEdit && ' Click "New project" to add the first one.'}</div>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {shown.map(p => (
                <div key={p.id} className="card" style={{ overflow: 'hidden', opacity: p.is_published ? 1 : .8 }}>
                  <div style={{ position: 'relative', aspectRatio: '16/10', background: '#e2e8f0' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(p.cover_image_url, 640)} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{
                      position: 'absolute', top: 10, left: 10, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                      background: p.is_published ? '#16a34a' : '#475569', color: '#fff',
                    }}>{p.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                  <div className="card-body">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 10px' }}>
                      {catLabel(p.category)} · {p.location}{p.year_built ? ` · ${p.year_built}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link href={`/marketing/website/projects/${p.id}`} className="btn btn-secondary btn-sm">
                        <Pencil size={13} style={{ marginRight: 4 }} /> {canEdit ? 'Edit' : 'View'}
                      </Link>
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" onClick={() => togglePublish(p)} title={p.is_published ? 'Hide from website' : 'Publish'}>
                          {p.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      {p.is_published && (
                        <a href={`${siteUrl}/projects/${p.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open on website">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card"><div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28 }}>
          <div>
            {field('Small label above the title', (
              <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.eyebrow}
                onChange={e => setSettings(s => ({ ...s, eyebrow: e.target.value }))} placeholder={PROJECTS_PAGE_DEFAULTS.eyebrow} />
            ))}
            {field('Heading', (
              <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.heading}
                onChange={e => setSettings(s => ({ ...s, heading: e.target.value }))} placeholder="Projects" />
            ))}
            {field('Description', (
              <textarea className="form-input" style={{ width: '100%', minHeight: 110 }} disabled={!canEdit} value={settings.description}
                onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} />
            ), 'Leave empty to hide the paragraph.')}
            {field('Image description (alt text)', (
              <input className="form-input" style={{ width: '100%' }} disabled={!canEdit} value={settings.hero_image_alt}
                onChange={e => setSettings(s => ({ ...s, hero_image_alt: e.target.value }))} />
            ))}
            {canEdit && (
              <button className="btn btn-primary" disabled={savingHeader} onClick={saveHeader}>{savingHeader ? 'Saving…' : 'Save header'}</button>
            )}
          </div>
          <div>
            {field('Background image', (
              <ImageField
                value={settings.hero_image_url} height={260} disabled={!canEdit} label="Hero image"
                folder="/store-maker/pages/projects-page"
                onChange={url => setSettings(s => ({ ...s, hero_image_url: url }))}
              />
            ), 'If empty, the website keeps showing its built-in photo.')}
          </div>
        </div></div>
      )}
    </>
  );
}
