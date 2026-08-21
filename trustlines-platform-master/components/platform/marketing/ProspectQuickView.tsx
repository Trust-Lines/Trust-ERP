'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Paperclip, Send, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProspectDetailClient } from './ProspectDetailClient';

interface ContactNote {
  id: string; prospect_contact_id: string; author_name: string | null; author_id?: string | null;
  body: string; image_path?: string | null; source_created_at: string | null; created_at: string;
}
interface ContactLite { id: string; name: string; is_primary: boolean; }

export function ProspectQuickView({ prospectId, onClose, canEdit }: {
  prospectId: string;
  onClose: () => void;
  canEdit?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [imageLinks, setImageLinks] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/prospects/${prospectId}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const body = await res.json();
      setData(body);
      setNotes(body.contactNotes ?? []);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const missing = notes.filter(n => n.image_path && !imageLinks[n.image_path]);
    if (!missing.length) return;
    (async () => {
      const entries = await Promise.all(missing.map(async n => {
        const res = await fetch(`/api/marketing/prospects/${prospectId}/dropbox-link?path=${encodeURIComponent(n.image_path!)}`);
        const body = await res.json().catch(() => ({}));
        return res.ok && body.link ? [n.image_path as string, body.link as string] as const : null;
      }));
      const found = Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
      if (Object.keys(found).length) setImageLinks(prev => ({ ...prev, ...found }));
    })();
  }, [notes, prospectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightbox) { setLightbox(null); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, lightbox]);

  const contacts: ContactLite[] = data?.contacts ?? [];
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0] ?? null;
  const contactNameById = Object.fromEntries(contacts.map(c => [c.id, c.name]));
  const showContactLabel = contacts.length > 1;

  async function postComment() {
    if (!primaryContact) { toast.error('Add a contact first'); return; }
    if (!draft.trim() && !draftImage) return;
    setPosting(true);
    try {
      let res: Response;
      if (draftImage) {
        const form = new FormData();
        form.set('body', draft.trim());
        form.set('image', draftImage);
        res = await fetch(`/api/marketing/prospects/${prospectId}/contacts/${primaryContact.id}/notes`, { method: 'POST', body: form });
      } else {
        res = await fetch(`/api/marketing/prospects/${prospectId}/contacts/${primaryContact.id}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft.trim() }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not post'); return; }
      setNotes(prev => [body.note, ...prev]);
      setDraft('');
      setDraftImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally { setPosting(false); }
  }

  async function deleteNote(n: ContactNote) {
    if (!window.confirm('Permanently delete this comment? This cannot be undone.')) return;
    const res = await fetch(`/api/marketing/prospects/${prospectId}/contacts/${n.prospect_contact_id}/notes/${n.id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error ?? 'Could not delete'); return; }
    setNotes(prev => prev.filter(x => x.id !== n.id));
  }

  const mouseDownOnBackdrop = useRef(false);

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '96vw', maxWidth: 1680, height: '92vh',
          boxShadow: '0 12px 48px rgba(0,0,0,.3)', display: 'flex', overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-subtle)' }}>Loading…</div>}
          {!loading && notFound && <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-subtle)' }}>Could not load this lead.</div>}
          {!loading && data && (
            <ProspectDetailClient
              initialProspect={data.prospect}
              initialContacts={data.contacts}
              initialLocations={data.locations}
              initialNeeds={data.needs}
              initialPotentials={data.potentials}
              initialOpportunities={data.opportunities}
              initialContactNotes={data.contactNotes}
              initialFiles={data.files}
              showsAttended={data.showsAttended}
              assignees={data.people}
              canEdit={canEdit}
              onClose={onClose}
            />
          )}
        </div>

        <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Activity</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 4 }} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
            {notes.length === 0 && !loading && (
              <div style={{ fontSize: 12.5, color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 24 }}>No activity yet.</div>
            )}
            {notes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{n.author_name || 'Unknown'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>
                      {n.source_created_at ? new Date(n.source_created_at).toLocaleDateString('en-US') : ''}
                    </span>
                    {canEdit && (
                      <button onClick={() => deleteNote(n)} title="Delete (temporary, dev-only)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {showContactLabel && (
                  <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', marginBottom: 4 }}>
                    re: {contactNameById[n.prospect_contact_id] ?? 'Contact'}
                  </div>
                )}
                {n.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--fg-default)' }}>{n.body}</div>}
                {n.image_path && (
                  imageLinks[n.image_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageLinks[n.image_path]}
                      alt=""
                      onClick={() => setLightbox(imageLinks[n.image_path!])}
                      style={{ marginTop: 6, maxWidth: 140, maxHeight: 140, borderRadius: 6, cursor: 'zoom-in', display: 'block', border: '1px solid var(--border-subtle)' }}
                    />
                  ) : (
                    <div style={{ marginTop: 6, width: 140, height: 90, borderRadius: 6, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-faint)' }}>
                      <ImageIcon size={16} />
                    </div>
                  )
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12, background: 'var(--bg-surface)' }}>
              {draftImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--fg-subtle)', marginBottom: 6 }}>
                  <ImageIcon size={12} /> {draftImage.name}
                  <button onClick={() => { setDraftImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <textarea
                  className="form-input"
                  placeholder="Write a comment…"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={2}
                  style={{ flex: 1, resize: 'none', fontSize: 12.5 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => setDraftImage(e.target.files?.[0] ?? null)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} title="Attach image">
                    <Paperclip size={14} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || (!draft.trim() && !draftImage)} title="Post">
                    {posting ? <Loader2 size={14} className="qv-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }} aria-label="Close image">
            <X size={26} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
      <style>{`.qv-spin{animation:qv-spin 1s linear infinite}@keyframes qv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
