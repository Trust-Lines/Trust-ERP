'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Pencil, SquareArrowOutUpRight, Eye, EyeOff, AlertTriangle, Image as ImageIcon, Newspaper } from 'lucide-react';
import { BLOG_CATEGORIES, PROJECT_CATEGORIES, thumb, type ProjectsPageSettings } from '@/lib/web-cms/config';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { PageHeaderForm } from './PageHeaderForm';
import { WebLeadsClient, type WebLeadRow } from './WebLeadsClient';
import { WorkTypesClient } from './WorkTypesClient';
import type { WorkTypeRow } from '@/lib/web-cms/workTypes';

export interface WebProjectRow {
  id: string; slug: string; title: string; category: string; location: string;
  project_type: string | null; year_built: number | null; cover_image_url: string;
  is_published: boolean; sort_order: number; updated_at: string;
}
export interface WebPostRow {
  id: string; slug: string; title: string; category: string; author: string;
  cover_image_url: string; published_at: string; is_published: boolean;
}

export type HubTab = 'projects' | 'blog' | 'leads' | 'work_types' | 'projects_header' | 'blog_header';

interface Props {
  projects: WebProjectRow[];
  posts: WebPostRow[];
  leads: WebLeadRow[];
  projectsPage: ProjectsPageSettings;
  blogPage: ProjectsPageSettings;
  canEdit: boolean;
  siteUrl: string;
  imageKitReady: boolean;
  projectsError: boolean;
  blogError: boolean;
  leadsError: boolean;
  workTypes: WorkTypeRow[];
  workTypesError: boolean;
  initialTab: HubTab;
}

const projectCat = (v: string) => PROJECT_CATEGORIES.find(c => c.value === v)?.label ?? v;
const blogCat = (v: string) => BLOG_CATEGORIES.find(c => c.value === v)?.label ?? v;
const today = () => new Date().toISOString().slice(0, 10);

// Figma "Website (Store Maker) hub" (node 316:16157).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const BTN_PRIMARY = 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950';
const BTN_OUTLINE = 'inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-3.5 text-[var(--color-secondary-700)] no-underline transition-colors hover:bg-ui-hover-bg dark:border-ui-heading dark:text-ui-heading';
// Status chip tones: Published = t9, Scheduled = t7 (amber), Draft = t0. Design uses the
// tone's foreground as the fill and its background as the label.
const STATUS_TONE = { published: 't9', scheduled: 't7', draft: 't0' } as const;

function StatusChip({ status }: { status: keyof typeof STATUS_TONE }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex h-7 shrink-0 items-center rounded-[6px] px-6 text-[13px] font-semibold capitalize"
      style={{ background: `var(--status-${tone}-fg)`, color: `var(--status-${tone}-bg)` }}
    >
      {status}
    </span>
  );
}

interface ContentCardProps {
  title: string; meta: string; coverUrl: string; status: keyof typeof STATUS_TONE;
  editHref: string; canEdit: boolean; isPublished: boolean; liveUrl: string | null;
  onToggle: () => void;
}

function ContentCard({ title, meta, coverUrl, status, editHref, canEdit, isPublished, liveUrl, onToggle }: ContentCardProps) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg', !isPublished && 'opacity-80')}>
      <Link href={editHref} aria-label={`Open ${title}`} className="relative block h-[278px] border-b border-ui-divider bg-ui-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl && <img src={thumb(coverUrl, 800)} alt={title} loading="lazy" className="absolute inset-0 size-full object-cover" />}
      </Link>
      <div className="flex flex-1 flex-col gap-4 bg-ui-surface p-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
            <p className={cn('m-0 truncate text-[16px] font-semibold', HEADING)}>{title}</p>
            <p className="m-0 truncate text-[13px] tracking-[0.39px] text-ui-text-secondary">{meta}</p>
          </div>
          <StatusChip status={status} />
        </div>
        <div className="flex items-start justify-between">
          <Link href={editHref} className={cn('inline-flex h-10 items-center gap-3 rounded-[6px] pl-3.5 pr-[21px] text-[13px] font-semibold no-underline transition-opacity hover:opacity-90', BTN_PRIMARY)}>
            <Pencil size={16} aria-hidden /> {canEdit ? 'Edit' : 'View'}
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button type="button" className={BTN_OUTLINE} onClick={onToggle} title={isPublished ? 'Hide from website' : 'Publish'} aria-label={isPublished ? 'Hide from website' : 'Publish'}>
                {isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noreferrer" className={BTN_OUTLINE} title="Open on website" aria-label="Open on website">
                <SquareArrowOutUpRight size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryViews({ options, value, onChange }: { options: { value: string; label: string; count: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" aria-label="Category" className="flex flex-wrap gap-2 border-b border-ui-divider pb-3">
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-[38px] items-center gap-2 rounded-[6px] border-0 px-4 text-[13px] transition-colors',
              active ? 'bg-ui-selected-bg font-semibold' : 'bg-ui-page-bg font-medium hover:bg-ui-hover-bg',
              HEADING,
            )}
          >
            {o.label}
            <span className="text-[12px] font-normal leading-[1.4] text-ui-text-secondary">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function NotReady({ what, migration }: { what: string; migration: string }) {
  return (
    <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
      <EmptyState icon={<AlertTriangle />} title={`${what} isn't ready yet`} description={`${migration} needs to be applied.`} />
    </div>
  );
}

export function WebsiteHubClient({
  projects: initialProjects, posts: initialPosts, leads, workTypes, projectsPage, blogPage, canEdit, siteUrl, imageKitReady,
  projectsError, blogError, leadsError, workTypesError, initialTab,
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
  const projectViews = [
    { value: 'all', label: 'All', count: projects.length },
    ...PROJECT_CATEGORIES.map(c => ({ value: c.value as string, label: c.label as string, count: projects.filter(p => p.category === c.value).length })),
  ];
  const postViews = [
    { value: 'all', label: 'All', count: posts.length },
    ...BLOG_CATEGORIES.map(c => ({ value: c.value as string, label: c.label as string, count: posts.filter(p => p.category === c.value).length })),
  ];
  const newLeads = leads.filter(l => l.status === 'new').length;

  const tabs: { key: HubTab; label: string }[] = [
    { key: 'projects', label: `Projects (${projects.length})` },
    { key: 'blog', label: `Blog & News (${posts.length})` },
    { key: 'leads', label: `Website Leads${newLeads > 0 ? ` (${newLeads} new)` : ''}` },
    { key: 'work_types', label: 'Work types' },
    { key: 'projects_header', label: 'Projects page header' },
    { key: 'blog_header', label: 'Blog page header' },
  ];

  const isList = tab === 'projects' || tab === 'blog';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[18px]">
        {/* ── Page heading ── */}
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <PageCrumbs items={[{ label: 'Marketing', href: '/marketing' }, { label: 'Website', href: '/marketing/website' }]} />
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Website (Store Maker)</h1>
          <p className="m-0 text-[13px] text-ui-body">
            Content for <a href={siteUrl} target="_blank" rel="noreferrer" className="text-inherit no-underline hover:underline">{siteUrl.replace(/^https?:\/\//, '')}</a>. Changes go live within a minute.
          </p>
        </div>

        {/* ── Saved views (underline tabs, 48px, 3px active border) ── */}
        <div role="tablist" aria-label="Website sections" className="flex h-12 items-stretch gap-8 overflow-x-auto border-b border-ui-divider">
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                className={cn(
                  'flex shrink-0 items-center whitespace-nowrap border-0 border-b-[3px] border-solid bg-transparent px-0 text-[13px] leading-[1.4]',
                  active
                    ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                    : 'border-transparent text-ui-text-secondary hover:text-ui-body',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {!imageKitReady && canEdit && (
          <div className="flex items-center gap-2.5 rounded-[8px] border border-ui-divider bg-ui-surface px-4 py-3 text-[13px] text-ui-body">
            <AlertTriangle size={18} className="shrink-0 text-warning-normal" aria-hidden />
            <span>Image upload is off: set <code>IMAGEKIT_PUBLIC_KEY</code> and <code>IMAGEKIT_PRIVATE_KEY</code> on the server.</span>
          </div>
        )}

        {isList && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>{tab === 'projects' ? 'Projects' : 'Blog & News'}</h2>
            {canEdit && (
              <Link
                href={tab === 'projects' ? '/marketing/website/projects/new' : '/marketing/website/blog/new'}
                className="inline-flex h-10 items-center gap-3 rounded-[6px] bg-ui-btn-accent pl-[34px] pr-[41px] text-[13px] font-semibold text-ui-btn-accent-fg no-underline transition-opacity hover:opacity-90"
              >
                <Plus size={16} aria-hidden /> {tab === 'projects' ? 'New Project' : 'New Post'}
              </Link>
            )}
          </div>
        )}

        {tab === 'projects' && !projectsError && <CategoryViews options={projectViews} value={projectFilter} onChange={setProjectFilter} />}
        {tab === 'blog' && !blogError && <CategoryViews options={postViews} value={postFilter} onChange={setPostFilter} />}
      </div>

      {tab === 'projects' && (projectsError ? <NotReady what="Website CMS" migration="Migrations 118 and 119 (web_projects, web_settings)" /> : (
        shownProjects.length === 0 ? (
          <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
            <EmptyState
              icon={<ImageIcon />}
              title={`No projects${projectFilter !== 'all' ? ' in this category' : ' yet'}`}
              description={canEdit ? 'Click "New Project" to add the first one.' : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
            {shownProjects.map(p => (
              <ContentCard
                key={p.id}
                title={p.title}
                meta={`${projectCat(p.category)} · ${p.location}${p.year_built ? ` · ${p.year_built}` : ''}`}
                coverUrl={p.cover_image_url}
                status={p.is_published ? 'published' : 'draft'}
                editHref={`/marketing/website/projects/${p.id}`}
                canEdit={canEdit}
                isPublished={p.is_published}
                liveUrl={p.is_published ? `${siteUrl}/projects/${p.slug}` : null}
                onToggle={() => toggle('projects', p.id, !p.is_published)}
              />
            ))}
          </div>
        )
      ))}

      {tab === 'blog' && (blogError ? <NotReady what="Blog & News" migration="Migration 121 (web_posts)" /> : (
        shownPosts.length === 0 ? (
          <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
            <EmptyState
              icon={<Newspaper />}
              title={`No posts${postFilter !== 'all' ? ' in this category' : ' yet'}`}
              description={canEdit ? 'Click "New Post" to write the first one.' : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
            {shownPosts.map(p => {
              const scheduled = p.is_published && p.published_at > today();
              return (
                <ContentCard
                  key={p.id}
                  title={p.title}
                  meta={`${blogCat(p.category)} · ${p.published_at}${p.author ? ` · ${p.author}` : ''}`}
                  coverUrl={p.cover_image_url}
                  status={scheduled ? 'scheduled' : p.is_published ? 'published' : 'draft'}
                  editHref={`/marketing/website/blog/${p.id}`}
                  canEdit={canEdit}
                  isPublished={p.is_published}
                  liveUrl={p.is_published && !scheduled ? `${siteUrl}/blog/${p.slug}` : null}
                  onToggle={() => toggle('posts', p.id, !p.is_published)}
                />
              );
            })}
          </div>
        )
      ))}

      {tab === 'work_types' && <WorkTypesClient initial={workTypes} canEdit={canEdit} siteUrl={siteUrl} loadError={workTypesError} />}

      {tab === 'leads' && <WebLeadsClient initial={leads} canEdit={canEdit} loadError={leadsError} />}

      {tab === 'projects_header' && (
        <PageHeaderForm settingsKey="projects_page" initial={projectsPage} canEdit={canEdit} folder="/store-maker/pages/projects-page" />
      )}
      {tab === 'blog_header' && (blogError ? <NotReady what="Blog & News" migration="Migration 121 (web_posts)" /> : (
        <PageHeaderForm settingsKey="blog_page" initial={blogPage} canEdit={canEdit} folder="/store-maker/pages/blog-page" />
      ))}
    </div>
  );
}
