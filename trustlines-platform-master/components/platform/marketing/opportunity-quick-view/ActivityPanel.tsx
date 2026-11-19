'use client';

import { Activity, Image as ImageIcon, Link2, Paperclip, SendHorizontal, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HEADING } from '@/components/platform/shared/panelStyles';
import type { NeedNote } from './types';
import type { DealComments } from './useDealComments';

function NoteCard({ n, imageLink, canEdit, onDelete, onOpenImage }: {
  n: NeedNote;
  imageLink: string | undefined;
  canEdit: boolean;
  onDelete: () => void;
  onOpenImage: (url: string) => void;
}) {
  return (
    <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg px-3 py-2.5">
      <div className="mb-1.5 flex justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-ui-surface text-[10px] font-semibold text-ui-body">
            {(n.author_name || '?').charAt(0).toUpperCase()}
          </span>
          <span className={cn('truncate text-[13px] font-semibold', HEADING)}>{n.author_name || 'Unknown'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11.5px] text-ui-text-secondary">
            {n.source_created_at ? new Date(n.source_created_at).toLocaleDateString('en-US') : ''}
          </span>
          {canEdit && (
            <button type="button" onClick={onDelete} title="Delete" aria-label="Delete comment"
              className="flex border-0 bg-transparent p-0 text-ui-text-secondary hover:text-error-normal">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {n.body && n.body !== n.link_url && <div className="whitespace-pre-wrap pl-[30px] text-[13px] leading-[1.5] text-ui-body">{n.body}</div>}
      {n.link_url && (
        <a href={n.link_url} target="_blank" rel="noopener noreferrer"
          className="mt-1.5 flex items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface px-2.5 py-2 no-underline">
          {n.link_thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.link_thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-[6px] bg-ui-page-bg text-ui-text-secondary"><Link2 size={16} /></span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-ui-body">{n.link_title || n.link_url}</span>
            <span className="block truncate text-[11.5px] text-ui-text-secondary">{n.link_url}</span>
          </span>
        </a>
      )}
      {n.image_path && (
        imageLink ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageLink}
            alt=""
            onClick={() => onOpenImage(imageLink)}
            style={{ marginTop: 6, maxWidth: 140, maxHeight: 140, borderRadius: 6, cursor: 'zoom-in', display: 'block', border: '1px solid var(--ui-divider)' }}
          />
        ) : (
          <div className="mt-1.5 grid h-[90px] w-[140px] place-items-center rounded-[6px] bg-ui-surface text-ui-text-secondary">
            <ImageIcon size={16} />
          </div>
        )
      )}
    </div>
  );
}

function Composer({ comments }: { comments: DealComments }) {
  const { draft, setDraft, draftImage, pickImage, clearImage, fileInputRef, posting, postComment } = comments;
  return (
    <div className="shrink-0 py-3 pl-4 pr-2">
      {draftImage && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-ui-body">
          <ImageIcon size={12} /> <span className="truncate">{draftImage.name}</span>
          <button type="button" aria-label="Remove image" onClick={clearImage} className="flex border-0 bg-transparent p-0 text-ui-text-secondary">
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <textarea
          aria-label="Write a comment"
          placeholder="Type here.."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void postComment(); } }}
          className="qv-input h-20 min-w-0 flex-1 resize-none rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg p-3 text-[14px] leading-[1.4] text-ui-body outline-none"
        />
        <div className="flex w-[89px] shrink-0 flex-col justify-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { void pickImage(e.target.files?.[0]); }} />
          <Button variant="outline" size="md" className="w-full px-0" onClick={() => fileInputRef.current?.click()} title="Attach image" aria-label="Attach image">
            <Paperclip className="size-4" />
          </Button>
          <Button size="md" className="w-full px-0" onClick={postComment} loading={posting} disabled={!draft.trim() && !draftImage} title="Post" aria-label="Post comment">
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Right-hand Activity column: the comment thread (imported ClickUp Docs are shown elsewhere) and the composer. */
export function ActivityPanel({ notes, loaded, canEdit, comments, onDeleteNote, onOpenImage }: {
  notes: NeedNote[];
  loaded: boolean;
  canEdit: boolean;
  comments: DealComments;
  onDeleteNote: (n: NeedNote) => void;
  onOpenImage: (url: string) => void;
}) {
  return (
    <div className="flex w-[383px] shrink-0 flex-col overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-ui-divider px-4">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" />
        <p className={cn('m-0 flex-1 text-[16px] font-semibold leading-[1.45]', HEADING)}>Activity</p>
        {notes.length > 0 && <span className="text-[12px] font-semibold text-ui-text-secondary">{notes.length}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-b border-ui-divider bg-ui-surface p-2">
        {notes.length === 0 && loaded && (
          <EmptyState size="sm" className="mt-6 justify-center" icon={<Activity />} title="No activity yet." />
        )}
        {notes.map(n => (
          <NoteCard
            key={n.id} n={n} canEdit={canEdit}
            imageLink={n.image_path ? comments.imageLinks[n.image_path] : undefined}
            onDelete={() => onDeleteNote(n)} onOpenImage={onOpenImage}
          />
        ))}
      </div>
      {canEdit && <Composer comments={comments} />}
    </div>
  );
}

/** Full-screen photo; a click anywhere outside the image closes it. */
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }} aria-label="Close image">
        <X size={26} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
    </div>
  );
}
