import { describe, expect, it } from 'vitest';
import { formatLongDate, formatShortDate, todayLocal } from './dates';

describe('dates', () => {
  it('uses local time, zero-padded', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('formats short and long', () => {
    expect(formatShortDate('2026-11-08')).toBe('Nov 8');
    expect(formatLongDate('2026-11-21')).toBe('Sat, Nov 21');
  });
});
