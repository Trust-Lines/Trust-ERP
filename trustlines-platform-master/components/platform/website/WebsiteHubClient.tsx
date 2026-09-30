'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Globe, Plus, Pencil, ExternalLink, Eye, EyeOff, AlertTriangle, Image as ImageIcon, Newspaper } from 'lucide-react';
import { BLOG_CATEGORIES, PROJECT_CATEGORIES, thumb, type ProjectsPageSettings } from '@/lib/web-cms/config';
import { PageHeaderForm } from './PageHeaderForm';

export interface WebProjectRow {
  id: string; slug: string; title: string; category: string; location: string;
  project_type: string | null; year_built: number | null; cover_image_url: string;
  is_published: boolean; sort_order: number; updated_at: string;
}
export interface WebPostRow {
  id: string; slug: string; title: string; category: string; author: string;
  cover_image_url: string; published_at: string; is_published: boolean;
}

export type HubTab = 'projects' | 'blog' | 'projects_header' | 'blog_header';

interface Props {
  projects: WebProjectRow[];
  posts: WebPostRow[];
  projectsPage: ProjectsPageSettings;
  blogPage: ProjectsPageSettings;
  canEdit: boolean;
  siteUrl: string;
  imageKitReady: boolean;
  projectsError: boolean;
  blogError: boolean;
  initialTab: HubTab;
}

const projectCat = (v: string) => PROJECT_CATEGORIES.find(c => c.value === v)?.label ?? v;
const blogCat = (v: string) => BLOG_CATEGORIES.find(c => c.value === v)?.label ?? v;
const today = () => new Date().toISOString().slice(0, 10);

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: color, color: '#fff' }}>
      {text}
    </span>
  );
}

function NotReady({ what, migration }: { what: string; migration: string }) {
  return (
    <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
      <AlertTriangle size={28} style={{ opacity: .4, marginBottom: 8 }} />
      <div>{what} isn&apos;t ready yet. {migration} needs to be applied.</div>
    </div></div>
  );
}

export function WebsiteHubClient({
  projects: initialProjects, posts: initialPosts, projectsPage, blogPage, canEdit, siteUrl, imageKitReady,
  projectsError, blogError, initialTab,
}: Props) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [projects, setProjects] = useState(initialProjects);
  const [posts, setPosts] = useState(initialPosts);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [postFilter, setPostFilter] = useState<string>('all');

  async function toggle(kind: 'projects' | 'posts', id: string, next: boolean) {
    const res = await fetch(`/api/web-cms/${kind}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_published: next }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Could not update'); return; }
    if (kind === 'projects') setProjects(prev => prev.map(x => (x.id === id ? { ...x, is_published: next } : x)));
    else setPosts(prev => prev.map(x => (x.id === id ? { ...x, is_published: next } : x)));
    toast.success(next ? 'Published on the website' : 'Hidden from the website');
  }

  const shownProjects = projects.filter(p => projectFilter === 'all' || p.category === projectFilter);
  const shownPosts = posts.filter(p => postFilter === 'all' || p.category === postFilter);
  const filterBtn = (active: boolean, text: string, onClick: () => void) => (
    <button key={text} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick}>{text}</button>
  );

  const isList = tab === 'projects' || tab === 'blog';

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
        {canEdit && isList && (
          <Link href={tab === 'projects' ? '/marketing/website/projects/new' : '/marketing/website/blog/new'} className="btn btn-primary">
            <Plus size={14} style={{ marginRight: 5 }} /> {tab === 'projects' ? 'New project' : 'New post'}
          </Link>
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
        <button className={`tab-item ${tab === 'blog' ? 'active' : ''}`} onClick={() => setTab('blog')}>Blog &amp; News ({posts.length})</button>
        <button className={`tab-item ${tab === 'projects_header' ? 'active' : ''}`} onClick={() => setTab('projects_header')}>Projects page header</button>
        <button className={`tab-item ${tab === 'blog_header' ? 'active' : ''}`} onClick={() => setTab('blog_header')}>Blog page header</button>
      </div>

      {tab === 'projects' && (projectsError ? <NotReady what="Website CMS" migration="Migrations 118 and 119 (web_projects, web_settings)" /> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {filterBtn(projectFilter === 'all', `All (${projects.length})`, () => setProjectFilter('all'))}
            {PROJECT_CATEGORIES.map(c => filterBtn(projectFilter === c.value, `${c.label} (${projects.filter(p => p.category === c.value).length})`, () => setProjectFilter(c.value)))}
          </div>
          {shownProjects.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--fg-subtle)' }}>
              <ImageIcon size={30} style={{ opacity: .4, marginBottom: 8 }} />
              <div>No projects{projectFilter !== 'all' ? ' in this category' : ' yet'}.{canEdit && ' Click "New project" to add the first one.'}</div>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {shownProjects.map(p => (
                <div key={p.id} className="card" style={{ overflow: 'hidden', opacity: p.is_published ? 1 : .8 }}>
                  <div style={{ position: 'relative', aspectRatio: '16/10', background: '#e2e8f0' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(p.cover_image_url, 640)} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <Badge text={p.is_published ? 'Published' : 'Draft'} color={p.is_published ? '#16a34a' : '#475569'} />
                  </div>
                  <div className="card-body">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 10px' }}>
                      {projectCat(p.category)} · {p.location}{p.year_built ? ` · ${p.year_built}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link href={`/marketing/website/projects/${p.id}`} className="btn btn-secondary btn-sm">
                        <Pencil size={13} style={{ marginRight: 4 }} /> {canEdit ? 'Edit' : 'View'}
                      </Link>
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" onClick={() => toggle('projects', p.id, !p.is_published)} title={p.is_published ? 'Hide from website' : 'Publish'}>
                          {p.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      {p.is_published && (
                        <a href={`${siteUrl}/projects/${p.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open on website"><ExternalLink size={13} /></a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ))}

      {tab === 'blog' && (blogError ? <NotReady what="Blog & News" migration="Migration 121 (web_posts)" /> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {filterBtn(postFilter === 'all', `All (${posts.length})`, () => setPostFilter('all'))}
            {BLOG_CATEGORIES.map(c => filterBtn(postFilter === c.value, `${c.label} (${posts.filter(p => p.category === c.value).length})`, () => setPostFilter(c.value)))}
          </div>
          {shownPosts.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--fg-subtle)' }}>
              <Newspaper size={30} style={{ opacity: .4, marginBottom: 8 }} />
              <div>No posts{postFilter !== 'all' ? ' in this category' : ' yet'}.{canEdit && ' Click "New post" to write the first one.'}</div>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {shownPosts.map(p => {
                const scheduled = p.is_published && p.published_at > today();
                return (
                  <div key={p.id} className="card" style={{ overflow: 'hidden', opacity: p.is_published ? 1 : .8 }}>
                    <div style={{ position: 'relative', aspectRatio: '16/10', background: '#e2e8f0' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(p.cover_image_url, 640)} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <Badge text={scheduled ? 'Scheduled' : p.is_published ? 'Published' : 'Draft'} color={scheduled ? '#d97706' : p.is_published ? '#16a34a' : '#475569'} />
                    </div>
                    <div className="card-body">
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: '2px 0 10px' }}>
                        {blogCat(p.category)} · {p.published_at}{p.author ? ` · ${p.author}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/marketing/website/blog/${p.id}`} className="btn btn-secondary btn-sm">
                          <Pencil size={13} style={{ marginRight: 4 }} /> {canEdit ? 'Edit' : 'View'}
                        </Link>
                        {canEdit && (
                          <button className="btn btn-ghost btn-sm" onClick={() => toggle('posts', p.id, !p.is_published)} title={p.is_published ? 'Hide from website' : 'Publish'}>
                            {p.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        {p.is_published && !scheduled && (
                          <a href={`${siteUrl}/blog/${p.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open on website"><ExternalLink size={13} /></a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ))}

      {tab === 'projects_header' && (
        <PageHeaderForm settingsKey="projects_page" initial={projectsPage} canEdit={canEdit} folder="/store-maker/pages/projects-page" />
      )}
      {tab === 'blog_header' && (blogError ? <NotReady what="Blog & News" migration="Migration 121 (web_posts)" /> : (
        <PageHeaderForm settingsKey="blog_page" initial={blogPage} canEdit={canEdit} folder="/store-maker/pages/blog-page" />
      ))}
    </>
  );
}
