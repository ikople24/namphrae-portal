// tests/urlState.test.ts
import { describe, it, expect } from 'vitest';
import { pickOne, readYear } from '@/lib/url-state';

const ALLOWED = ['markers', 'cluster', 'heat'] as const;

describe('pickOne', () => {
  it('คืนค่าเมื่ออยู่ใน allowed', () => {
    expect(pickOne('heat', ALLOWED, 'markers')).toBe('heat');
  });
  it('คืน fallback เมื่อค่าไม่อยู่ใน allowed', () => {
    expect(pickOne('nope', ALLOWED, 'markers')).toBe('markers');
  });
  it('รองรับ undefined และ array (เอาตัวแรก)', () => {
    expect(pickOne(undefined, ALLOWED, 'markers')).toBe('markers');
    expect(pickOne(['cluster'], ALLOWED, 'markers')).toBe('cluster');
  });
});

describe('readYear', () => {
  it('parse ปีในช่วงได้', () => {
    expect(readYear('2565')).toBe(2565);
    expect(readYear(['2566'])).toBe(2566);
  });
  it('คืน null เมื่อไม่ใช่ปีที่ถูกต้อง', () => {
    expect(readYear('abc')).toBeNull();
    expect(readYear(undefined)).toBeNull();
    expect(readYear('9999')).toBeNull();
    expect(readYear('12.5')).toBeNull();
  });
});
