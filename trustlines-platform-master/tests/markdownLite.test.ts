import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownLite } from '@/components/platform/shared/MarkdownLite';

const html = (text: string) => renderToStaticMarkup(h(MarkdownLite, { text }));
const hrefs = (markup: string) => [...markup.matchAll(/<a [^>]*href="([^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&'));

describe('MarkdownLite', () => {
  it('renders headings, checkboxes, nested lists and quotes', () => {
    const out = html('> a note\n\n# Scope of work\n- [ ] Shelving\n- [x] Millwork\n*   **Client request**\n\n    *   Island size 15’X5’\n');
    expect(out).toContain('Scope of work');
    expect(out).toContain('☐');
    expect(out).toContain('☑');
    expect(out).toContain('Island size 15’X5’');
    expect(out.match(/<strong>/g)).toHaveLength(1);
  });

  it('links to http(s) files, including ClickUp\'s escaped-parenthesis names', () => {
    const out = html('[Plan.pdf](https://t1.p.clickup-attachments.com/t1/a/Plan.pdf)\n\n![](https://t1.p.clickup-attachments.com/t1/b/WhatsApp%20Image%20\\(1\\).jpeg)');
    expect(hrefs(out)).toEqual([
      'https://t1.p.clickup-attachments.com/t1/a/Plan.pdf',
      // the full name survives, parentheses and all — it used to be cut at the first ")"
      'https://t1.p.clickup-attachments.com/t1/b/WhatsApp%20Image%20(1).jpeg',
    ]);
    expect(out).toContain('Plan.pdf');
    expect(out).toContain('WhatsApp Image (1).jpeg');
    expect(out.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  it('never injects HTML and never makes a javascript: link', () => {
    const out = html('<script>alert(1)</script> and [bad](javascript:alert(1))');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); // shown as plain text
    expect(hrefs(out)).toEqual([]);
    expect(out).toContain('[bad](javascript:alert(1))');
  });
});
