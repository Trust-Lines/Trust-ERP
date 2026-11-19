'use client';

import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Lead } from '../types';

interface MenuState { x: number; y: number; lead: Lead }

/** Right-click menu state; closes on outside click, scroll or Escape. Marketing-origin rows get no menu. */
export function useLeadContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  function openMenu(e: MouseEvent, lead: Lead) {
    e.preventDefault();
    if (lead.origin === 'opportunity' || lead.origin === 'potential') return;
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 210), y: e.clientY, lead });
  }

  return { menu, openMenu, closeMenu: () => setMenu(null) };
}

const ctxItem: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
  color: 'var(--fg-default)', textAlign: 'left', borderRadius: 6,
};

export function LeadContextMenu({ menu, onArchive, onTrash }: {
  menu: MenuState;
  onArchive: (lead: Lead, archived: boolean) => void;
  onTrash: (lead: Lead) => void;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: menu.y, left: menu.x, zIndex: 10001, minWidth: 200, padding: 4,
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)', boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
      }}
    >
      <div style={{ padding: '6px 10px 4px', fontSize: 11, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.lead.name}</div>
      <button onClick={() => onArchive(menu.lead, !menu.lead.archived)} style={ctxItem}>
        {menu.lead.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {menu.lead.archived ? 'Unarchive' : 'Archive'}
      </button>
      <button onClick={() => onTrash(menu.lead)} style={{ ...ctxItem, color: 'var(--status-danger)' }}>
        <Trash2 size={14} /> Move to trash
      </button>
    </div>
  );
}
