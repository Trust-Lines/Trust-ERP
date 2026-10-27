import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptToken, encryptToken, tokenKeyConfigured } from '@/lib/crypto/secrets';
import { titleFromCaption, toDay } from '@/lib/social/http';
import { instagramImageUrl } from '@/lib/social/providers/meta';
import { escapeLinkedInText } from '@/lib/social/providers/linkedin';
import { providerForPlatform, providerStatuses } from '@/lib/social/providers';
import { parseSocialPost } from '@/lib/marketing/prWorkspace';

const saved = { ...process.env };
beforeEach(() => { process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
afterEach(() => { process.env = { ...saved }; });

describe('token encryption', () => {
  it('round-trips and never stores the token in clear', () => {
    const stored = encryptToken('EAAB-secret-page-token');
    expect(stored).not.toContain('secret');
    expect(decryptToken(stored)).toBe('EAAB-secret-page-token');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'));
  });

  it('rejects a tampered value and a wrong key', () => {
    const stored = encryptToken('token');
    const [v, iv, tag, ct] = stored.split(':');
    const flipped = Buffer.from(ct, 'base64'); flipped[0] ^= 1;
    expect(() => decryptToken([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptToken(stored)).toThrow();
  });

  it('is not configured without a 32-byte key', () => {
    process.env.APP_ENCRYPTION_KEY = 'short';
    expect(tokenKeyConfigured()).toBe(false);
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
  });
});

describe('provider helpers', () => {
  it('asks ImageKit for a JPEG for Instagram, keeping other transforms', () => {
    expect(instagramImageUrl('https://ik.imagekit.io/t/a.png')).toBe('https://ik.imagekit.io/t/a.png?tr=f-jpg');
    expect(instagramImageUrl('https://ik.imagekit.io/t/a.png?tr=w-800')).toBe('https://ik.imagekit.io/t/a.png?tr=w-800%2Cf-jpg');
    expect(instagramImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('escapes LinkedIn reserved characters', () => {
    expect(escapeLinkedInText('Booth #12 (Hall A) @NACS')).toBe('Booth \\#12 \\(Hall A\\) \\@NACS');
  });

  it('titles a synced post from its caption', () => {
    expect(titleFromCaption('\n  Great show!\nMore text', 'Instagram post')).toBe('Great show!');
    expect(titleFromCaption('', 'Instagram post')).toBe('Instagram post');
    expect(titleFromCaption('x'.repeat(100), 'p')).toHaveLength(78);
  });

  it('reads platform timestamps as days', () => {
    expect(toDay('2026-10-27T18:30:00+0000')).toBe('2026-10-27');
    expect(toDay(1792000000000)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toDay('nope')).toBeNull();
  });

  it('routes each platform to its provider, and only YouTube can’t publish', () => {
    expect(providerForPlatform('instagram')?.id).toBe('meta');
    expect(providerForPlatform('facebook')?.id).toBe('meta');
    expect(providerForPlatform('youtube')?.publish).toBeUndefined();
    expect(providerForPlatform('tiktok')).toBeNull();
    const input = { caption: 'Hi', media_url: null, media_type: 'text' as const };
    expect(providerForPlatform('instagram')!.publishBlocker('instagram', input)).toMatch(/image or a video/);
    expect(providerForPlatform('facebook')!.publishBlocker('facebook', input)).toBeNull();
  });

  it('lists what is missing before a provider can be offered', () => {
    delete process.env.META_APP_ID; delete process.env.META_APP_SECRET;
    const meta = providerStatuses().find(p => p.id === 'meta')!;
    expect(meta.configured).toBe(false);
    expect(meta.missing).toEqual(['META_APP_ID', 'META_APP_SECRET']);
  });
});

describe('scheduled posts', () => {
  it('stores the publish time as UTC and validates media', () => {
    const r = parseSocialPost({ title: 'x', status: 'scheduled', scheduled_at: '2026-11-02T09:30:00+03:00', media_type: 'image', media_url: 'https://ik.imagekit.io/t/a.jpg' });
    expect('value' in r && r.value.scheduled_at).toBe('2026-11-02T06:30:00.000Z');
    expect(parseSocialPost({ title: 'x', scheduled_at: 'tomorrow-ish' })).toEqual({ error: 'Publish time is not valid' });
    expect(parseSocialPost({ title: 'x', media_type: 'gif' })).toEqual({ error: 'Pick image, video or text' });
  });
});
