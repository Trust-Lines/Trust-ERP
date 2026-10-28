import { describe, it, expect } from 'vitest';
import { mapEvent } from '@/lib/google/calendar';
import { externalAttendees } from '@/lib/google/sync';
import { MeetingError, parseMeetingInput } from '@/lib/google/meetings';

describe('Google Calendar events', () => {
  it('maps a Meet meeting with its link, code and attendees', () => {
    const row = mapEvent({
      id: 'ev1', status: 'confirmed', summary: ' Layout review ', htmlLink: 'https://calendar.google.com/x',
      start: { dateTime: '2026-11-02T10:00:00+03:00' }, end: { dateTime: '2026-11-02T10:30:00+03:00' },
      organizer: { email: 'Hamzag@Trust-Lines.com' },
      attendees: [{ email: 'Buyer@Acme.com', displayName: 'Jordan', responseStatus: 'accepted' }, { email: 'room@resource.calendar.google.com', resource: true }],
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      conferenceData: { conferenceId: 'abc-defg-hij', conferenceSolution: { key: { type: 'hangoutsMeet' } } },
    })!;
    expect(row.title).toBe('Layout review');
    expect(row.starts_at).toBe('2026-11-02T07:00:00.000Z');
    expect(row.meet_url).toBe('https://meet.google.com/abc-defg-hij');
    expect(row.meet_code).toBe('abc-defg-hij');
    expect(row.organizer_email).toBe('hamzag@trust-lines.com');
    expect(row.attendees).toEqual([{ email: 'buyer@acme.com', name: 'Jordan', response: 'accepted' }]);
  });

  it('keeps all-day and cancelled events, and drops broken ones', () => {
    const allDay = mapEvent({ id: 'ev2', status: 'cancelled', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } })!;
    expect(allDay.all_day).toBe(true);
    expect(allDay.starts_at).toBe('2026-11-05T00:00:00.000Z');
    expect(allDay.status).toBe('cancelled');
    expect(allDay.title).toBe('(no title)');
    expect(mapEvent({ id: 'ev3' })).toBeNull();
  });

  it('a Zoom link is not mistaken for a Meet code', () => {
    const row = mapEvent({ id: 'z', start: { dateTime: '2026-11-02T10:00:00Z' }, conferenceData: { conferenceId: '123', conferenceSolution: { key: { type: 'addOn' } }, entryPoints: [{ entryPointType: 'video', uri: 'https://zoom.us/j/1' }] } })!;
    expect(row.meet_url).toBe('https://zoom.us/j/1');
    expect(row.meet_code).toBeNull();
  });
});

describe('who a meeting was with', () => {
  const row = {
    organizer_email: 'hamzag@trust-lines.com',
    attendees: [
      { email: 'hamzag@trust-lines.com', name: null, response: null },
      { email: 'salsabil@trust-lines.com', name: null, response: null },
      { email: 'buyer@acme.com', name: null, response: null },
      { email: 'owner@gmail.com', name: null, response: null },
    ],
  };

  it('ignores the person and colleagues on the company domain', () => {
    expect(externalAttendees(row, 'hamzag@trust-lines.com')).toEqual(['buyer@acme.com', 'owner@gmail.com']);
  });

  it('does not treat a free-mail domain as “the company”', () => {
    expect(externalAttendees({ organizer_email: null, attendees: [{ email: 'friend@gmail.com', name: null, response: null }] }, 'me@gmail.com'))
      .toEqual(['friend@gmail.com']);
  });
});

describe('scheduling input', () => {
  const soon = new Date(Date.now() + 86_400_000).toISOString();

  it('normalises attendees and defaults to a Meet link', () => {
    const m = parseMeetingInput({ title: 'Intro', startsAt: soon, durationMin: 45, attendees: [' Buyer@Acme.com ', 'buyer@acme.com'] });
    expect(m.attendees).toEqual(['buyer@acme.com']);
    expect(m.withMeet).toBe(true);
    expect(m.durationMin).toBe(45);
  });

  it('rejects a past time, a bad address and a missing title', () => {
    expect(() => parseMeetingInput({ title: 'x', startsAt: '2020-01-01T10:00:00Z' })).toThrow(MeetingError);
    expect(() => parseMeetingInput({ title: 'x', startsAt: soon, attendees: ['not-an-email'] })).toThrow(/valid email/);
    expect(() => parseMeetingInput({ startsAt: soon })).toThrow(/title/);
  });
});
