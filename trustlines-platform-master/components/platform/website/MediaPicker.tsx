'use client';

import { useEffect, useState } from 'react';
import { Folder, ChevronRight, X, Loader2, Check } from 'lucide-react';
import { thumb } from '@/lib/web-cms/config';

interface Entry { type: 'file' | 'folder'; name: string; path: string; url?: string }

interface Props {
  multiple?: boolean;
  onClose: () => void;
  onPick: (urls: string[]) => void;
}

// Read-only browser over the ImageKit library. Starts at /store-maker (images uploaded from the
// ERP) and can go up to the root to reuse images from the old site — it never writes there.
export function MediaPicker({ multiple, onClose, onPick }: Props) {
  const [path, setPath] = useState('/store-maker');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let dead = false;
    setLoading(true); setError(null);
    fetch(`/api/web-cms/imagekit/browse?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
      .then(async r => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error ?? 'Could not load folder');
        if (!dead) setEntries(b.entries ?? []);
      })
      .catch(e => { if (!dead) { setEntries([]); setError(e.message); } })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [path]);

  const crumbs = path.split('/').filter(Boolean);
  const toggle = (url: string) => {
    if (!multiple) { onPick([url]); return; }
    setSelected(s => (s.includes(url) ? s.filter(x => x !== url) : [...s, url]));
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-surface, #fff)', borderRadius: 14, width: 'min(920px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Image library</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12.5, marginLeft: 12, flexWrap: 'wrap', flex: 1 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPath('/')}>All images</button>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <ChevronRight size={12} style={{ opacity: .5 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setPath('/' + crumbs.slice(0, i + 1).join('/'))}>{c}</button>
              </span>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, minHeight: 240 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg-subtle)' }}><Loader2 size={20} className="animate-spin" /></div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#dc2626', fontSize: 13 }}>{error}</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg-subtle)', fontSize: 13 }}>This folder has no images.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {entries.map(e => e.type === 'folder' ? (
                <button
                  key={e.path} onClick={() => setPath(e.path)}
                  style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, aspectRatio: '1', justifyContent: 'center' }}
                >
                  <Folder size={30} style={{ color: 'var(--brand-teal-600, #0d9488)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all', textAlign: 'center' }}>{e.name}</span>
                </button>
              ) : (
                <button
                  key={e.path} onClick={() => toggle(e.url!)} title={e.name}
                  style={{ position: 'relative', border: selected.includes(e.url!) ? '2px solid var(--brand-teal-600, #0d9488)' : '1px solid var(--border-subtle)', borderRadius: 10, padding: 0, overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', aspectRatio: '1' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(e.url!, 300)} alt={e.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {selected.includes(e.url!) && (
                    <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--brand-teal-600, #0d9488)', color: '#fff', borderRadius: 99, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} /></span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {multiple && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>{selected.length} selected</span>
            <button className="btn btn-primary" disabled={!selected.length} onClick={() => onPick(selected)}>Add selected</button>
          </div>
        )}
      </div>
    </div>
  );
}
