// src/lib/iso-date.test.ts
import { describe, expect, it } from 'vitest';
import { arabicDigits, toIsoDate } from '@/lib/iso-date';

describe('arabicDigits', () => {
  it('แปลงเลขไทยเป็นอารบิก ตัวอักษรอื่นไม่แตะ', () => {
    expect(arabicDigits('๑๒-มิ.ย.-๖๖')).toBe('12-มิ.ย.-66');
  });
});

describe('toIsoDate', () => {
  it('ISO ค.ศ. ผ่านตรง ๆ', () => {
    expect(toIsoDate('2025-06-18')).toBe('2025-06-18');
  });

  it('พ.ศ. สองหลัก + เดือนย่อไทย', () => {
    expect(toIsoDate('18-มิ.ย.-68')).toBe('2025-06-18');
    expect(toIsoDate('24-ส.ค.-67')).toBe('2024-08-24');
  });

  it('เลขไทย + พ.ศ. สองหลัก', () => {
    expect(toIsoDate('๑๒-มิ.ย.-๖๖')).toBe('2023-06-12');
    expect(toIsoDate('๒๐-ก.ย.-๖๔')).toBe('2021-09-20');
    expect(toIsoDate('๒๓-ก.ย.-๖๕')).toBe('2022-09-23');
  });

  it('ตัดช่องว่างหัวท้าย', () => {
    expect(toIsoDate('  18-มิ.ย.-68  ')).toBe('2025-06-18');
  });

  it('รูปแบบที่ไม่รู้จัก → โยน error ไม่คืนค่าเดิม', () => {
    expect(() => toIsoDate('18/06/2025')).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate('')).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate('18-มิถุนายน-68')).toThrow(/อ่านวันที่ไม่ออก/);
  });

  it('วันที่ที่ไม่มีอยู่จริง → โยน error ไม่เลื่อนเงียบ ๆ', () => {
    expect(() => toIsoDate('31-ก.พ.-68')).toThrow(/ไม่มีอยู่จริง/);
    expect(() => toIsoDate('2025-02-30')).toThrow(/ไม่มีอยู่จริง/);
  });
});
