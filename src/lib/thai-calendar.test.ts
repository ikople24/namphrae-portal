import { describe, it, expect } from 'vitest';
import { formatThaiDate, monthMatrix, THAI_MONTH_NAMES, THAI_WEEKDAY_HEADERS } from '@/lib/thai-calendar';
import { parseThaiDate } from '@/lib/thai-date';

describe('formatThaiDate', () => {
  it('formats day month(BE) year', () => {
    expect(formatThaiDate(2564, 0, 21)).toBe('21 มกราคม 2564');
    expect(formatThaiDate(2567, 9, 3)).toBe('3 ตุลาคม 2567');
  });
});

describe('constants', () => {
  it('has 12 months and 7 weekday headers', () => {
    expect(THAI_MONTH_NAMES).toHaveLength(12);
    expect(THAI_WEEKDAY_HEADERS).toHaveLength(7);
  });
});

describe('monthMatrix', () => {
  it('has the right day count and 7-wide rows (ก.พ. 2564 = 28 days)', () => {
    const m = monthMatrix(2564, 1);
    expect(m.every((w) => w.length === 7)).toBe(true);
    expect(m.flat().filter((d) => d !== null)).toHaveLength(28);
  });
  it('pads the lead with nulls (1 ก.พ. 2564 is a Monday → 1 leading null)', () => {
    const m = monthMatrix(2564, 1);
    expect(m[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
  });
});

describe('round-trip with parseThaiDate', () => {
  it('formatThaiDate output parses back to the same UTC date', () => {
    for (const [y, mo, d] of [[2564, 0, 21], [2567, 11, 31], [2560, 5, 15]] as const) {
      const parsed = parseThaiDate(formatThaiDate(y, mo, d));
      expect(parsed?.getTime()).toBe(Date.UTC(y - 543, mo, d));
    }
  });
});
