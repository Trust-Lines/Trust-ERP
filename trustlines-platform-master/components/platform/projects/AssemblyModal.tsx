'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { toast } from 'sonner';
// Shared Base UI Select: its list stays inside the dialog's layer.
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

type ItemRef = { code: string; description: string };
interface PfEntry { pfCode: string; catGroup: string | null; items: ItemRef[] }
interface LinkRow { id: string; source_pf_code: string | null; target_pf_code: string | null; source_items: ItemRef[]; target_items: ItemRef[]; note: string | null }

export function AssemblyModal({ projectId, catGroup, currentPfCode, onClose, onSaved }: {
  projectId: string; catGroup: string; currentPfCode: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [pfs, setPfs] = useState<PfEntry[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [sourcePf, setSourcePf] = useState<string | null>(currentPfCode);
  const [targetPf, setTargetPf] = useState<string | null>(null);
  const [srcSel, setSrcSel] = useState<Set<number>>(new Set());
  const [tgtSel, setTgtSel] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/assembly`)
      .then(r => r.json()).then((j: { pfs?: PfEntry[]; links?: LinkRow[] }) => {
        setPfs(j.pfs ?? []);
        setLinks(j.links ?? []);
        if (!currentPfCode && j.pfs?.length) setSourcePf(j.pfs[0].pfCode);
      })
      .catch(() => toast.error('Failed to load PFs'))
      .finally(() => setLoading(false));
  }, [projectId, currentPfCode]);

  const sourceItems = useMemo(() => pfs.find(p => p.pfCode === sourcePf)?.items ?? [], [pfs, sourcePf]);
  const targetItems = useMemo(() => pfs.find(p => p.pfCode === targetPf)?.items ?? [], [pfs, targetPf]);
  const otherPfs = useMemo(() => pfs.filter(p => p.pfCode !== sourcePf), [pfs, sourcePf]);

  function toggle(set: Set<number>, i: number, setter: (s: Set<number>) => void) {
    const next = new Set(set); if (next.has(i)) next.delete(i); else next.add(i); setter(next);
  }

  async function save() {
    if (!srcSel.size || !tgtSel.size) { toast.error('Select at least one item on each side'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assembly`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: catGroup.charAt(0).toUpperCase() + catGroup.slice(1),
          sourcePfCode: sourcePf, sourceItems: [...srcSel].map(i => sourceItems[i]),
          targetPfCode: targetPf, targetItems: [...tgtSel].map(i => targetItems[i]),
          note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed');
      toast.success('Assembly relationship saved');
      setSrcSel(new Set()); setTgtSel(new Set()); setNote('');
      onSaved();
      const j = await (await fetch(`/api/projects/${projectId}/assembly`)).json() as { links?: LinkRow[] };
      setLinks(j.links ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const itemRow = (it: ItemRef, i: number, sel: Set<number>, setter: (s: Set<number>) => void) => (
    <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: sel.has(i) ? 'color-mix(in srgb, var(--brand-teal) 10%, var(--bg-surface))' : 'var(--bg-surface)' }}>
      <Checkbox checked={sel.has(i)} onCheckedChange={() => toggle(sel, i, setter)} style={{ marginTop: 2 }} />
      <span style={{ fontSize: 11 }}>
        {it.code && <b style={{ fontFamily: 'monospace', marginRight: 6 }}>{it.code}</b>}
        <span style={{ color: 'var(--fg-default)' }}>{it.description}</span>
      </span>
    </label>
  );

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent size="xl" title={<span className="inline-flex items-center gap-2"><Link2 size={16} aria-hidden /> Assembly — what mounts onto what</span>}>
        {loading ? (
          <div style={{ padding: 50, textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} /></div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>THIS PF (mounts)</div>
                <Select
                  aria-label="This PF" className="mb-2 w-full text-[12px]"
                  value={sourcePf ?? ''} onValueChange={v => { setSourcePf(v ?? ''); setSrcSel(new Set()); }}
                  options={pfs.map(p => ({ value: p.pfCode, label: p.pfCode }))}
                />
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {sourceItems.length ? sourceItems.map((it, i) => itemRow(it, i, srcSel, setSrcSel)) : <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-faint)' }}>No items.</div>}
                </div>
              </div>

              <div style={{ alignSelf: 'center', fontSize: 22, color: 'var(--brand-teal)', fontWeight: 800 }}>→</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>ONTO THIS PF</div>
                <Select
                  aria-label="Onto this PF" className="mb-2 w-full text-[12px]"
                  value={targetPf ?? ''} onValueChange={v => { setTargetPf(v || null); setTgtSel(new Set()); }}
                  options={[{ value: '', label: 'Select a PF…' }, ...otherPfs.map(p => ({ value: p.pfCode, label: p.pfCode }))]}
                />
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {targetPf ? (targetItems.length ? targetItems.map((it, i) => itemRow(it, i, tgtSel, setTgtSel)) : <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-faint)' }}>No items.</div>) : <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-faint)' }}>Pick a PF to list its items.</div>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)' }}>How it mounts (note)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Shelf set IN-FA-40 mounts onto the back panel of IN/BC-48…" style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 6, marginTop: 4, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Close</ModalClose>
              <Button onClick={save} loading={saving} disabled={!srcSel.size || !tgtSel.size}>
                <Link2 size={13} aria-hidden /> Save relationship
              </Button>
            </div>

            {links.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>SAVED RELATIONSHIPS</div>
                {links.map(l => (
                  <div key={l.id} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-subtle)', marginBottom: 5 }}>
                    <b style={{ fontFamily: 'monospace' }}>{l.source_pf_code}</b> ({(l.source_items ?? []).map(i => i.code || i.description).join(', ')})
                    {' → '}
                    <b style={{ fontFamily: 'monospace' }}>{l.target_pf_code}</b> ({(l.target_items ?? []).map(i => i.code || i.description).join(', ')})
                    {l.note && <div style={{ color: 'var(--fg-subtle)', marginTop: 2 }}>{l.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
