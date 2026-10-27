import { describe, it, expect } from 'vitest';
import {
  addOpenPixel, clickSignature, escapeHtml, htmlToText, isEmail, renderHtml, textToHtml, trackLinks, withSignature, wrapCampaign,
} from '@/lib/email/compose';
import { friendlySmtpError, isTemporarySmtpError, parseMailSettings } from '@/lib/email/mailSettings';
import { parseAudience, parseCampaignPatch, pct } from '@/lib/email/campaigns';
import { audienceParams } from '@/lib/email/sender';
import { hasAnyCriterion } from '@/lib/marketing/prospectQuery';

const T = { baseUrl: 'https://erp.example.com', token: 'tok_ABCDEFGHIJKLMNOP', secret: 's3cret' };

describe('merge fields in HTML', () => {
  it('escapes contact data so it cannot break the markup', () => {
    expect(renderHtml('<p>Hi {{first_name}} at {{company}}</p>', { display_name: 'A&B <Retail>', person_name: 'Jo "J" Smith' }))
      .toBe('<p>Hi Jo at A&amp;B &lt;Retail&gt;</p>');
    expect(escapeHtml(`<script>"x"</script>`)).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });

  it('leaves an unknown token visible', () => {
    expect(renderHtml('{{nope}}', { display_name: 'x' })).toBe('{{nope}}');
  });

  it('turns typed text into paragraphs but keeps real HTML', () => {
    expect(textToHtml('Hi <you>\n\nLine1\nLine2')).toBe('<p style="margin:0 0 12px">Hi &lt;you&gt;</p><p style="margin:0 0 12px">Line1<br>Line2</p>');
    expect(textToHtml('<p>Already HTML</p>')).toBe('<p>Already HTML</p>');
  });
});

describe('tracking', () => {
  it('routes http links through the signed click tracker, but not the unsubscribe link', () => {
    const html = '<a href="https://tlines.us/stores?a=1&amp;b=2">Stores</a> <a href="mailto:x@y.z">Mail</a> <a href="https://erp.example.com/unsubscribe/tok">Unsubscribe</a>';
    const out = trackLinks(html, T);
    const sig = clickSignature(T.token, 'https://tlines.us/stores?a=1&b=2', T.secret);
    expect(out).toContain(`/api/public/email/click/${T.token}?u=${encodeURIComponent('https://tlines.us/stores?a=1&b=2')}&amp;s=${sig}`);
    expect(out).toContain('href="mailto:x@y.z"');
    expect(out).toContain('href="https://erp.example.com/unsubscribe/tok"');
  });

  it('signs token + URL together, so a link can’t be pointed elsewhere', () => {
    expect(clickSignature('t', 'https://a.com', 'k')).not.toBe(clickSignature('t', 'https://evil.com', 'k'));
    expect(clickSignature('t', 'https://a.com', 'k')).not.toBe(clickSignature('t2', 'https://a.com', 'k'));
  });

  it('adds the open pixel before </body>', () => {
    expect(addOpenPixel('<html><body>x</body></html>', 'https://p/1')).toMatch(/x<img src="https:\/\/p\/1"[^>]*><\/body>/);
  });
});

describe('campaign email', () => {
  it('always carries the unsubscribe link, the address and the preheader', () => {
    const html = wrapCampaign('<p>Hello</p>', { preheader: 'See you <soon>', footerAddress: 'Trust-Lines, 1 Main St, Dallas TX', unsubscribeHref: 'https://e/unsubscribe/t', fromName: 'Jo' });
    expect(html).toContain('href="https://e/unsubscribe/t"');
    expect(html).toContain('Trust-Lines, 1 Main St, Dallas TX');
    expect(html).toContain('See you &lt;soon&gt;');
    expect(html).toContain('<p>Hello</p>');
  });

  it('keeps only the body of a full HTML document', () => {
    const html = wrapCampaign('<html><head><title>x</title></head><body><p>In</p></body></html>', { footerAddress: 'a', unsubscribeHref: 'u', fromName: 'f' });
    expect(html).toContain('<p>In</p>');
    expect(html).not.toContain('<title>x</title>');
  });

  it('builds a readable text part', () => {
    expect(htmlToText('<p>Hi&nbsp;Jo</p><p><a href="https://a.com">Our stores</a></p><ul><li>One</li></ul>')).toBe('Hi Jo\nOur stores (https://a.com)\n• One');
  });

  it('appends a signature', () => {
    expect(withSignature('<p>Body</p>', 'Jo\nT-Lines')).toBe('<p>Body</p><div style="margin-top:16px"><p style="margin:0 0 12px">Jo<br>T-Lines</p></div>');
    expect(withSignature('<p>Body</p>', '  ')).toBe('<p>Body</p>');
  });
});

describe('mail settings', () => {
  const base = { from_name: 'Jo', from_email: 'jo@trust-lines.com', smtp_host: 'smtp.gmail.com', smtp_port: 465, smtp_secure: true, smtp_user: 'jo@trust-lines.com', smtp_pass: 'app-pass', daily_limit: 400 };

  it('accepts a complete login and keeps the stored password when none is sent', () => {
    expect('value' in parseMailSettings(base, false)).toBe(true);
    const r = parseMailSettings({ ...base, smtp_pass: '' }, true);
    expect('value' in r && !('smtp_pass' in r.value)).toBe(true);
  });

  it('needs a password the first time and valid addresses', () => {
    expect(parseMailSettings({ ...base, smtp_pass: '' }, false)).toEqual({ error: 'The password (or app password) is required' });
    expect(parseMailSettings({ ...base, from_email: 'nope' }, false)).toEqual({ error: 'Enter a valid “from” email address' });
    expect(parseMailSettings({ ...base, smtp_host: 'not a host' }, false)).toEqual({ error: 'Enter the SMTP server, e.g. smtp.gmail.com' });
  });

  it('explains SMTP failures in words people can act on', () => {
    expect(friendlySmtpError({ code: 'EAUTH', responseCode: 535 })).toMatch(/App Password/);
    expect(friendlySmtpError({ code: 'ETIMEDOUT' })).toMatch(/reach the mail server/);
    expect(isTemporarySmtpError({ responseCode: 421 })).toBe(true);
    expect(isTemporarySmtpError({ responseCode: 550 })).toBe(false);
  });

  it('validates addresses', () => {
    expect(isEmail('a.b+c@trust-lines.com')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('Jo <jo@x.com>')).toBe(false);
  });
});

describe('campaign audience', () => {
  it('keeps only known filters and refuses an empty audience', () => {
    const a = parseAudience({ region: 'TLINES_NE', evil: 'x', surveyOnly: 'yes', followUpOverdue: true, sources: ['HRA 2026', 3] });
    expect(a).toEqual({ region: 'TLINES_NE', followUpOverdue: true, sources: ['HRA 2026'] });
    expect(hasAnyCriterion(audienceParams(a))).toBe(true);
    expect(hasAnyCriterion(audienceParams(parseAudience({ includePeople: true })))).toBe(false);
  });

  it('validates campaign edits', () => {
    expect(parseCampaignPatch({ name: ' ' })).toEqual({ error: 'Give the campaign a name' });
    expect(parseCampaignPatch({ template_id: 'x' })).toEqual({ error: 'Invalid reference' });
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(1, 0)).toBeNull();
  });
});
