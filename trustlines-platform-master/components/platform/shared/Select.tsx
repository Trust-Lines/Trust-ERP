'use client';

import {
  Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useImperativeHandle,
  useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * App-wide dropdown. Drop-in replacement for a native <select>: same props, same <option> /
 * <optgroup> children, same onChange(e) with e.target.value — so call sites only swap the tag.
 *
 * Under the hood a REAL <select> stays in the DOM (visually hidden). That keeps everything the
 * browser and libraries already do with selects working unchanged: react-hook-form's register()
 * (ref + value reads/writes), FormData / <form> submission, `required` validation, `name`.
 * What the user sees and clicks is a button + a portal-rendered panel that isn't clipped by
 * overflow:hidden tables/cards, flips upward near the bottom edge, supports the keyboard, and
 * gets a search box once the list is long.
 *
 * Not used on the public survey pages on purpose — the native picker is better on phones.
 */

type Item = { kind: 'option'; value: string; label: string; disabled: boolean }
  | { kind: 'group'; label: string };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function collect(children: ReactNode, out: Item[]) {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: unknown; disabled?: boolean; label?: string; children?: ReactNode }>;
    if (el.type === 'option') {
      const label = textOf(el.props.children);
      out.push({ kind: 'option', value: el.props.value != null ? String(el.props.value) : label, label, disabled: !!el.props.disabled });
    } else if (el.type === 'optgroup') {
      out.push({ kind: 'group', label: String(el.props.label ?? '') });
      collect(el.props.children, out);
    } else if (el.type === Fragment) {
      collect(el.props.children, out);
    }
  });
}

const SEARCH_THRESHOLD = 8;
const PANEL_MAX_H = 280;

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  const {
    children, className, style, id, disabled,
    onClick, onMouseEnter, onMouseLeave, onFocus, onBlur,
    'aria-label': ariaLabel, autoComplete: _autoComplete, ...nativeProps
  } = props;
  void _autoComplete;

  const hiddenRef = useRef<HTMLSelectElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null);
  const [cur, setCur] = useState<string>(() => String(nativeProps.value ?? nativeProps.defaultValue ?? ''));

  const items = useMemo(() => { const out: Item[] = []; collect(children, out); return out; }, [children]);
  const options = useMemo(() => items.filter((i): i is Extract<Item, { kind: 'option' }> => i.kind === 'option'), [items]);
  const searchable = options.length > SEARCH_THRESHOLD;

  // The hidden <select> is the source of truth (controlled by `value`, or driven by react-hook-form's
  // ref) — mirror whatever it currently holds so the button always shows the real selection.
  useLayoutEffect(() => {
    const v = hiddenRef.current?.value ?? '';
    if (v !== cur) setCur(v);
  });

  const setRefs = useCallback((el: HTMLSelectElement | null) => {
    hiddenRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
    if (el && !(el as unknown as { __uiSelectPatched?: boolean }).__uiSelectPatched) {
      (el as unknown as { __uiSelectPatched?: boolean }).__uiSelectPatched = true;
      const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      if (desc?.get && desc.set) {
        // react-hook-form writes `ref.value = x` directly (reset / setValue) — no event fires,
        // so intercept it to keep the button label in sync.
        Object.defineProperty(el, 'value', {
          configurable: true,
          get() { return desc.get!.call(this); },
          set(v: string) { desc.set!.call(this, v); setCur(desc.get!.call(this)); },
        });
      }
      // Focusing the (invisible) select — e.g. RHF focusing the first invalid field — should focus the button.
      el.focus = () => triggerRef.current?.focus();
    }
  }, [ref]);
  useImperativeHandle(ref, () => hiddenRef.current as HTMLSelectElement, []);

  const selected = options.find(o => o.value === cur);
  const triggerLabel = selected?.label ?? '';

  // ── placement ──
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const flip = below < 200 && above > below;
      const width = Math.max(r.width, 200);
      const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
      setPos(flip
        ? { bottom: window.innerHeight - r.top + 4, left, width, maxH: Math.min(PANEL_MAX_H, above) }
        : { top: r.bottom + 4, left, width, maxH: Math.min(PANEL_MAX_H, below) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.kind === 'option' && i.label.toLowerCase().includes(q));
  }, [items, query]);
  const shownOptions = useMemo(() => shown.filter((i): i is Extract<Item, { kind: 'option' }> => i.kind === 'option' && !i.disabled), [shown]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.filter(o => !o.disabled).findIndex(o => o.value === cur)));
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  // keep the keyboard-active row in view
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  function choose(value: string) {
    setOpen(false);
    triggerRef.current?.focus();
    const el = hiddenRef.current;
    if (!el || value === el.value) return;
    // Set via the native setter + fire a real bubbling change event: React's onChange (and RHF's
    // register().onChange) see exactly what a native <select> would have sent.
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    desc?.set?.call(el, value);
    setCur(value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onPanelKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(shownOptions.length - 1, a + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(shownOptions.length - 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); const o = shownOptions[active]; if (o) choose(o.value); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead on short lists
      const idx = shownOptions.findIndex(o => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (idx >= 0) setActive(idx);
    }
  }

  // Own chevron only when the class list doesn't already draw one (.form-select paints a
  // background chevron; tailwind call sites with `appearance-none` add a sibling icon).
  const cls = className ?? '';
  const drawChevron = !/\bform-select\b/.test(cls) && !/\bappearance-none\b/.test(cls);

  let activeSeen = -1;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={nativeProps.name}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`ui-select-trigger ${cls}`.trim()}
        style={style}
        onClick={e => { onClick?.(e as unknown as React.MouseEvent<HTMLSelectElement>); if (!e.defaultPrevented && !disabled) setOpen(o => !o); }}
        onMouseEnter={onMouseEnter as unknown as React.MouseEventHandler<HTMLButtonElement>}
        onMouseLeave={onMouseLeave as unknown as React.MouseEventHandler<HTMLButtonElement>}
        onFocus={onFocus as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onKeyDown={onTriggerKey}
      >
        <span className="ui-select-label">{triggerLabel || ' '}</span>
        {drawChevron && <ChevronDown size={12} className="ui-select-chevron" aria-hidden />}
      </button>

      {/* real select — invisible, but it's what forms / react-hook-form / required-validation talk to */}
      <select
        {...nativeProps}
        ref={setRefs}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="ui-select-native"
      >
        {children}
      </select>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          onKeyDown={onPanelKey}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, zIndex: 10060,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            maxHeight: pos.maxH,
          }}
        >
          {searchable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Search size={13} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, padding: '9px 0', color: 'var(--fg-default)' }}
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', padding: 6, display: 'grid', gap: 1 }}>
            {shownOptions.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', padding: '8px 10px' }}>No matches</div>
            )}
            {shown.map((it, i) => {
              if (it.kind === 'group') {
                return (
                  <div key={`g${i}`} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-faint)', padding: '8px 10px 3px' }}>
                    {it.label}
                  </div>
                );
              }
              const isSel = it.value === cur;
              let isActive = false;
              if (!it.disabled) { activeSeen += 1; isActive = activeSeen === active; }
              return (
                <button
                  key={`o${i}-${it.value}`}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  disabled={it.disabled}
                  data-active={isActive}
                  onClick={() => choose(it.value)}
                  onMouseEnter={() => { if (!it.disabled) setActive(shownOptions.findIndex(o => o === it)); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    border: 'none', borderRadius: 6, padding: '7px 10px', fontSize: 13, cursor: it.disabled ? 'not-allowed' : 'pointer',
                    background: isActive ? 'var(--bg-subtle)' : 'transparent',
                    color: it.disabled ? 'var(--fg-faint)' : 'var(--fg-default)',
                    fontWeight: isSel ? 600 : 400,
                    transition: 'background 80ms',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label || ' '}</span>
                  {isSel && <Check size={14} style={{ color: 'var(--brand-teal)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});
