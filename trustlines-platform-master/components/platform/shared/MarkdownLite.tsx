'use client';

import type { ReactNode } from 'react';

/**
 * Small, dependency-free Markdown view for imported documents (ClickUp Docs export as Markdown):
 * headings, paragraphs, bullet / numbered / checkbox lists (nested), quotes, rules, links, images-as-links,
 * **bold**, _italic_ and `code`. Everything is rendered as React nodes — no HTML injection — and only
 * http(s) links are made clickable.
 */

// A URL is a run of plain-or-backslash-escaped characters: ClickUp writes "…%20\(1\).jpeg" with escaped parentheses.
const INLINE_RE = /(!?\[[^\]]*\]\(https?:\/\/(?:\\.|[^)\s\\])+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|(?<![\w*])\*[^*\n]+\*(?![\w*])|(?<![\w_])_[^_\n]+_(?![\w_]))/g;
const LINK_RE = /^(!?)\[([^\]]*)\]\((https?:\/\/(?:\\.|[^)\s\\])+)\)$/;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    const link = LINK_RE.exec(tok);
    if (link) {
      const href = link[3].replace(/\\(.)/g, '$1');
      let fileName = href.split('?')[0].split('/').pop() || 'link';
      try { fileName = decodeURIComponent(fileName); } catch { /* keep raw */ }
      const label = link[2].trim() || fileName;
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-teal-600)', wordBreak: 'break-word' }}>
          {link[1] ? '🖼 ' : '📎 '}{label}
        </a>,
      );
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      out.push(<code key={key} style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em' }}>{tok.slice(1, -1)}</code>);
    } else {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_SIZE = [0, 17, 15.5, 14.5, 14, 13.5, 13];

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  const flushPara = (k: number) => {
    if (!para.length) return;
    blocks.push(<p key={`p${k}`} style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{inline(para.join(' '), `p${k}`)}</p>);
    para = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(idx); return; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara(idx);
      const level = h[1].length;
      blocks.push(<div key={`h${idx}`} style={{ fontSize: HEADING_SIZE[level], fontWeight: 800, margin: '14px 0 6px', letterSpacing: '-0.01em' }}>{inline(h[2].replace(/^_+|_+$/g, ''), `h${idx}`)}</div>);
      return;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(idx); blocks.push(<hr key={`r${idx}`} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />); return; }

    const box = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    const bullet = box ? null : /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const num = box || bullet ? null : /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (box || bullet || num) {
      flushPara(idx);
      const indent = Math.floor(((box?.[1] ?? bullet?.[1] ?? num?.[1] ?? '').replace(/\t/g, '    ').length) / 2);
      const marker = box ? (box[2] === ' ' ? '☐' : '☑') : bullet ? '•' : `${num![2]}.`;
      const body = box ? box[3] : bullet ? bullet[2] : num![3];
      const done = box && box[2] !== ' ';
      blocks.push(
        <div key={`l${idx}`} style={{ display: 'flex', gap: 8, paddingLeft: Math.min(indent, 6) * 14, margin: '2px 0', lineHeight: 1.5 }}>
          <span style={{ color: done ? 'var(--brand-teal-600)' : 'var(--fg-faint)', flexShrink: 0, minWidth: 14 }}>{marker}</span>
          <span style={{ minWidth: 0, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--fg-subtle)' : undefined }}>{inline(body, `l${idx}`)}</span>
        </div>,
      );
      return;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara(idx);
      blocks.push(<div key={`q${idx}`} style={{ borderLeft: '3px solid var(--border-default)', paddingLeft: 10, margin: '6px 0', color: 'var(--fg-subtle)', fontSize: 13, lineHeight: 1.5 }}>{inline(quote[1], `q${idx}`)}</div>);
      return;
    }
    para.push(line.trim());
  });
  flushPara(lines.length);

  return <div style={{ fontSize: 13.5, color: 'var(--fg-default)', wordBreak: 'break-word' }}>{blocks}</div>;
}
