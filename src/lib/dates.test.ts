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

import { addDays, weekStart } from './dates';

describe('weeks (Monday to Sunday)', () => {
  it('Saturday and Sunday are in the same week', () => {
    expect(weekStart('2026-11-21')).toBe('2026-11-16'); // Saturday
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // next Monday starts a new week
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
