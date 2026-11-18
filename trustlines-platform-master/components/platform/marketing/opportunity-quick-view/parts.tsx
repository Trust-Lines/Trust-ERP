'use client';

// Presentational pieces of the opportunity / potential quick view: form card, fields, inputs,
// imported ClickUp docs and the file row bits. No data fetching here.

import { useState, useEffect } from 'react';
import { ExternalLink, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownLite } from '@/components/platform/shared/MarkdownLite';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HEADING } from '@/components/platform/shared/panelStyles';
import type { Deal, NeedNote } from './types';

export function readableOn(bg: string): string {
  if (!bg) return 'var(--fg-default)';
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
}

// Imported ClickUp Docs ("Collect Information" briefs etc.). Collapsible; the first one starts open.
export function DocumentsList({ docs }: { docs: NeedNote[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(docs.slice(0, 1).map(d => d.id)));
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '');
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {docs.map(d => {
        const isOpen = open.has(d.id);
        return (
          <div key={d.id} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
              <button
                onClick={() => toggle(d.id)} aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                <FileText size={15} style={{ color: 'var(--brand-teal-600)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.link_title || 'Document'}</span>
                <ChevronDown size={14} style={{ color: 'var(--fg-faint)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              <span style={{ fontSize: 11.5, color: 'var(--fg-faint)', whiteSpace: 'nowrap' }}>{when(d.source_created_at)}</span>
              {d.link_url && (
                <a href={d.link_url} target="_blank" rel="noopener noreferrer" title="Open in ClickUp" style={{ color: 'var(--fg-faint)', display: 'flex' }}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            {isOpen && (
              <div style={{ padding: '4px 18px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <MarkdownLite text={d.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// What a salesperson still has to get from the client / fill in on an open deal. Purely a reminder —
// nothing here blocks anything.
export function missingForDeal(opp: Deal): string[] {
  const empty = (k: string) => opp[k] == null || opp[k] === '';
  const stage = String(opp.stage);
  if (stage === 'closed_won' || stage === 'closed_lost') return [];
  const out: string[] = [];
  if (empty('primary_contact_id')) out.push('Contact');
  if (empty('estimated_value')) out.push('Deal size');
  if (empty('deadline')) out.push('Due date');
  if (['sales_accepted', 'working_on_it_trust', 'proposal', 'negotiation'].includes(stage)) {
    if (empty('deposit')) out.push('Deposit');
    if (empty('payment_raw')) out.push('Payment terms');
  }
  return out;
}

export function StillToFillIn({ missing, stage }: { missing: string[]; stage: string }) {
  if (stage === 'closed_won' || stage === 'closed_lost') return null;
  if (missing.length === 0) {
    return (
      <div style={{ marginBottom: 10, fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 10, background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
        ✓ Everything Sales needs on this deal is filled in.
      </div>
    );
  }
  return (
    // Light amber tint + amber outline (warning tokens). A solid warning fill read as brown in dark mode.
    <div role="note" className="mb-2.5 flex flex-wrap items-center gap-1.5 rounded-[10px] border border-warning-normal/40 bg-warning-normal/10 px-3 py-2 text-warning-dark dark:text-warning-normal">
      <span className="text-[12.5px] font-bold">Still to fill in:</span>
      {missing.map(m => (
        <span key={m} className="rounded-full border border-warning-normal/60 bg-warning-normal/10 px-2.5 py-px text-[12px] font-semibold">{m}</span>
      ))}
    </div>
  );
}

// Figma form card: 8px radius, 14px padding, 16px semibold title.
export function Card({ title, muted, className, children }: { title: string; muted?: boolean; className?: string; children: React.ReactNode }) {
  return (
    // 🔴 no overflow:hidden here — Sel/ContactSearchSelect open a position:absolute panel
    // that needs to escape this card's rounded corners, not get clipped by them.
    <section className={cn('flex flex-col gap-2 rounded-[8px] border border-ui-divider p-3.5', muted ? 'bg-ui-surface' : 'bg-ui-page-bg', className)}>
      <h3 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>{title}</h3>
      {children}
    </section>
  );
}

// Six-track grid: span 2 = three across, 3 = two across, 6 = full width.
export function Fields({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-6 gap-2">{children}</div>;
}

export const SPAN: Record<number, string> = { 2: 'col-span-6 sm:col-span-2', 3: 'col-span-6 sm:col-span-3', 4: 'col-span-6 sm:col-span-4', 6: 'col-span-6' };

/** `focus`: this is the field to fill in (opened from a "needs …" notification) — highlighted until it has a value. */
export function Field({ label, span = 2, focus = false, children }: { label: string; span?: 2 | 3 | 4 | 6; focus?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-focus-field={focus || undefined}
      className={cn('flex min-w-0 flex-col gap-[7px]', SPAN[span],
        focus && 'rounded-[8px] bg-[var(--status-t7-bg)] p-2 outline-2 outline-solid outline-[var(--status-t7-fg)] transition-colors')}
    >
      <span className={cn('text-[12px] font-medium leading-4', focus ? 'font-semibold text-[var(--status-t7-fg)]' : 'text-ui-body')}>
        {label}{focus && ' — fill this in'}
      </span>
      {children}
    </div>
  );
}

// Figma "Input": 42px min height, input border, 11px semibold value.
export const fieldBox: React.CSSProperties = {
  width: '100%', minHeight: 42, padding: '0 12px', border: '1px solid var(--ui-input-border)', borderRadius: 6,
  background: 'var(--ui-input-bg)', color: 'var(--qv-value)', fontSize: 11, fontWeight: 600, lineHeight: 1.5,
  letterSpacing: '-0.242px', textAlign: 'left',
};

export function ReadOnly({ children }: { children: React.ReactNode }) {
  return <div style={{ ...fieldBox, display: 'flex', alignItems: 'center', padding: '12px' }}>{children}</div>;
}

export function Inp({ value, onSave, type = 'text', ph, muted }: { value: string | number; onSave: (v: string) => void; type?: string; ph?: string; muted?: boolean }) {
  const [val, setVal] = useState(String(value ?? ''));
  useEffect(() => { setVal(String(value ?? '')); }, [value]);
  return (
    <input
      type={type} value={val} placeholder={ph ?? '—'}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== String(value ?? '')) onSave(val); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="qv-input"
      style={{ ...fieldBox, ...(muted && { background: 'var(--ui-surface)' }) }}
    />
  );
}

// Custom combobox, not a native <select> — the browser's own dropdown chrome (especially on
// Windows) looks dated next to the rest of this panel. The list is the shared Popover, so it is
// never clipped by the panel and counts as part of the quick view (focus, Escape, outside clicks).
export function Sel({ value, onChange, opts, emphasize }: { value: string; onChange: (v: string) => void; opts: [string, string][]; emphasize?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = opts.find(([v]) => v === value)?.[1] ?? opts[0]?.[1] ?? '';

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-haspopup="listbox"
        className="qv-input"
        style={{
          ...fieldBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer',
          ...(emphasize && { border: '1px solid var(--status-warning)', background: 'var(--status-warning-bg)' }),
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
        <ChevronDown size={16} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .12s' }} />
      </PopoverTrigger>

        <PopoverContent role="listbox" align="start" className="gap-0 overflow-y-auto p-1" onClick={e => e.stopPropagation()} style={{
          minWidth: 'var(--anchor-width)', width: 'max-content', maxWidth: 260, maxHeight: 260,
        }}>
          {opts.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              onClick={() => { onChange(v); setOpen(false); }}
              className={cn('block w-full rounded-[4px] border-0 px-2.5 py-2 text-left text-[13px] text-ui-body hover:bg-ui-hover-bg', v === value ? 'bg-ui-selected-bg font-semibold' : 'bg-transparent font-medium')}
            >
              {l}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FileRowShell({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-ui-divider py-5 first:pt-0 last:border-b-0 last:pb-0">{children}</div>;
}

export function FileIcon({ name }: { name: string }) {
  const Icon = /\.(xlsx?|csv|ods)$/i.test(name) ? FileSpreadsheet : FileText;
  return <Icon size={22} strokeWidth={1.5} className="shrink-0 text-ui-body" aria-hidden />;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
