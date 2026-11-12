import { describe, expect, it } from 'vitest';
import { isDue, isValidTime, localParts } from './schedule';

describe('påmindelsestidspunkt', () => {
  const tz = 'Europe/Copenhagen';
  // 12. nov 2026 kl. 19:02 dansk tid (UTC+1)
  const now = new Date('2026-11-12T18:02:00Z');

  it('regner lokal tid ud fra tidszonen', () => {
    expect(localParts(now, tz)).toEqual({ date: '2026-11-12', minutes: 19 * 60 + 2 });
  });

  it('sender lige efter det valgte tidspunkt', () => {
    expect(isDue(now, tz, '19:00', null)).toBe(true);
  });

  it('sender ikke før tid, og ikke to gange samme dag', () => {
    expect(isDue(now, tz, '19:05', null)).toBe(false);
    expect(isDue(now, tz, '19:00', '2026-11-12')).toBe(false);
    expect(isDue(now, tz, '19:00', '2026-11-11')).toBe(true);
  });

  it('springer over, hvis det er mere end en time for sent', () => {
    expect(isDue(now, tz, '17:30', null)).toBe(false);
  });

  it('validerer tidspunkter', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:30')).toBe(false);
  });
});
