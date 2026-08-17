import { describe, it, expect } from 'vitest';
import { METHOD_OPTIONS, AREA_TYPE_OPTIONS, isCustomValue } from '@/lib/disaster-options';
import { DISASTER_TYPES } from '@/lib/disaster-types';

describe('option maps', () => {
  it('cover all disaster types', () => {
    for (const t of DISASTER_TYPES) {
      expect(Array.isArray(METHOD_OPTIONS[t])).toBe(true);
      expect(Array.isArray(AREA_TYPE_OPTIONS[t])).toBe(true);
    }
  });
  it('method has at least one option per type', () => {
    for (const t of DISASTER_TYPES) expect(METHOD_OPTIONS[t].length).toBeGreaterThan(0);
  });
  it('flood/drought areaType are free-text (empty options)', () => {
    expect(AREA_TYPE_OPTIONS.FLOOD).toEqual([]);
    expect(AREA_TYPE_OPTIONS.DROUGHT).toEqual([]);
  });
});

describe('isCustomValue', () => {
  it('false for a value in options', () => expect(isCustomValue('ดับด้วยคน', ['ดับด้วยคน'])).toBe(false));
  it('true for a value not in options', () => expect(isCustomValue('อื่น', ['ดับด้วยคน'])).toBe(true));
  it('false for empty string', () => expect(isCustomValue('', ['ดับด้วยคน'])).toBe(false));
});
