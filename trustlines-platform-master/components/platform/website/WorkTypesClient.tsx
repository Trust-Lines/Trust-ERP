'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, GripVertical, ArrowUp, ArrowDown, ImagePlus, X, Loader2, AlertTriangle } from 'lucide-react';
import type { WorkTypeRow } from '@/lib/web-cms/workTypes';
import { WorkTypeTile } from './WorkTypeTile';
import { uploadToImageKit } from './imagekitClient';
import { MediaPicker } from './MediaPicker';

interface Props {
  initial: WorkTypeRow[];
  canEdit: boolean;
  siteUrl: string;
  loadError: boolean;
}

const FOLDER = '/store-maker/work-types';

export function WorkTypesClient({ initial, canEdit, siteUrl, loadError }: Props) {
  const [types, setTypes] = useState(initial);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<string | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  if (loadError) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
        <AlertTriangle size={28} style={{ opacity: .4, marginBottom: 8 }} />
        <div>Types of work isn&apos;t ready yet. Migration 123 (web_work_types) needs to be applied.</div>
      </div></div>
    );
  }

  const ro = !canEdit;
  const replace = (row: WorkTypeRow) => setTypes(prev => prev.map(x => (x.id === row.id ? row : x)));

  async function patch(t: WorkTypeRow, body: Record<string, unknown>) {
    const res = await fetch(`/api/web-cms/work-types/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(b.error ?? 'Could not save'); return false; }
    replace(b.workType);
    return true;
  }

  async function uploadIcon(t: WorkTypeRow | null, file: File | undefined) {
    if (!file) return;
    const key = t?.id ?? 'new';
    setUploadingId(key);
    try {
      // Icons are SVG (uploaded untouched) or small PNG (the photo optimizer leaves those alone).
      const url = await uploadToImageKit(file, FOLDER);
      if (t) await patch(t, { icon_url: url }); else setNewIcon(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally { setUploadingId(null); }
  }

  async function add() {
    const label = newLabel.trim();
    if (!label) { toast.error('Give the type a name'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/web-cms/work-types', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, icon_url: newIcon }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not add'); return; }
      setTypes(prev => [...prev, b.workType]);
      setNewLabel(''); setNewIcon('');
      toast.success(b.refreshed ? 'Added — website refreshed' : 'Added — website updates within a minute');
    } finally { setAdding(false); }
  }

  async function saveOrder(next: WorkTypeRow[]) {
    const prev = types;
    setTypes(next);
    const res = await fetch('/api/web-cms/work-types/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map(t => t.id) }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Could not reorder'); setTypes(prev); }
  }

  const moveBy = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= types.length) return;
    const next = types.slice();
    [next[i], next[j]] = [next[j], next[i]];
    saveOrder(next);
  };

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = types.findIndex(t => t.id === dragId);
    const to = types.findIndex(t => t.id === targetId);
    if (from < 0 || to < 0) return;
    const next = types.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    saveOrder(next);
  }

  const active = types.filter(t => t.is_active);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
        <div className="card"><div className="card-body">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Types of work</div>
          <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 14 }}>
            Shown as filter tiles on the website&apos;s Projects page. Drag to reorder. To remove a type, switch it off — projects keep it.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {types.map((t, i) => (
              <div
                key={t.id}
                draggable={canEdit}
                onDragStart={() => setDragId(t.id)}
                onDragOver={e => { if (dragId) e.preventDefault(); }}
                onDrop={() => dropOn(t.id)}
                onDragEnd={() => setDragId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 12,
                  border: '1px solid var(--border-subtle)', background: dragId === t.id ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
                  opacity: t.is_active ? 1 : 0.65,
                }}
              >
                {canEdit && <GripVertical size={16} style={{ color: 'var(--fg-subtle)', cursor: 'grab', flexShrink: 0 }} />}
                <WorkTypeTile slug={t.slug} label={t.label} iconUrl={t.icon_url} siteUrl={siteUrl} size={72} dimmed={!t.is_active} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    className="form-input" style={{ width: '100%' }} disabled={ro} defaultValue={t.label}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.label) patch(t, { label: v }); else e.target.value = t.label; }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3 }}>link name: {t.slug}</div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      {uploadingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} style={{ marginRight: 4 }} />}
                      {uploadingId === t.id ? '' : 'Icon'}
                      <input type="file" accept="image/svg+xml,image/png" hidden onChange={e => { uploadIcon(t, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPickingFor(t.id)} title="Pick from library">Library</button>
                    {t.icon_url && (
                      <button className="btn btn-ghost btn-sm" onClick={() => patch(t, { icon_url: '' })} title="Back to built-in icon"><X size={13} /></button>
                    )}
                    <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveBy(i, -1)}><ArrowUp size={13} /></button>
                    <button className="btn btn-ghost btn-sm" disabled={i === types.length - 1} onClick={() => moveBy(i, 1)}><ArrowDown size={13} /></button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, marginLeft: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={t.is_active} onChange={e => patch(t, { is_active: e.target.checked })} /> Active
                    </label>
                  </div>
                )}
              </div>
            ))}
            {types.length === 0 && <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: 12 }}>No types yet.</div>}
          </div>
        </div></div>

        <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 16 }}>
          {canEdit && (
            <div className="card"><div className="card-body">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add a type</div>
              <input className="form-input" style={{ width: '100%', marginBottom: 10 }} placeholder="e.g. Lighting" value={newLabel}
                onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  {uploadingId === 'new' ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} style={{ marginRight: 4 }} />}
                  {uploadingId === 'new' ? '' : newIcon ? 'Change icon' : 'Upload icon'}
                  <input type="file" accept="image/svg+xml,image/png" hidden onChange={e => { uploadIcon(null, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <button className="btn btn-ghost btn-sm" onClick={() => setPickingFor('new')}>Library</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginBottom: 12 }}>
                Icon: cream (#FFF4E0) on a transparent background, 77 × 77 px or larger, SVG preferred. Without one the tile shows a placeholder.
              </div>
              {newLabel.trim() && (
                <div style={{ marginBottom: 12 }}>
                  <WorkTypeTile slug="new" label={newLabel.trim()} iconUrl={newIcon || null} siteUrl={siteUrl} size={110} />
                </div>
              )}
              <button className="btn btn-primary" disabled={adding} onClick={add}>
                <Plus size={14} style={{ marginRight: 5 }} /> {adding ? 'Adding…' : 'Add type'}
              </button>
            </div></div>
          )}

          <div className="card"><div className="card-body">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>As visitors see it</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {active.map(t => <WorkTypeTile key={t.id} slug={t.slug} label={t.label} iconUrl={t.icon_url} siteUrl={siteUrl} size={92} />)}
            </div>
          </div></div>
        </div>
      </div>

      {pickingFor && (
        <MediaPicker
          onClose={() => setPickingFor(null)}
          onPick={urls => {
            const target = pickingFor; setPickingFor(null);
            if (!urls[0]) return;
            if (target === 'new') setNewIcon(urls[0]);
            else { const t = types.find(x => x.id === target); if (t) patch(t, { icon_url: urls[0] }); }
          }}
        />
      )}
    </>
  );
}
