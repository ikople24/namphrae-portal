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

  it('วันเลขหลักเดียว — มีจริงในไฟล์ต้นทาง (๘-ส.ค.-๖๕)', () => {
    expect(toIsoDate('๘-ส.ค.-๖๕')).toBe('2022-08-08');
    expect(toIsoDate('5-ม.ค.-68')).toBe('2025-01-05');
  });

  it('เดือนหัวท้ายอาเรย์ — จุดที่ off-by-one ของ monthIndex จะโผล่', () => {
    expect(toIsoDate('1-ม.ค.-68')).toBe('2025-01-01');
    expect(toIsoDate('31-ธ.ค.-67')).toBe('2024-12-31');
  });

  it('29 ก.พ. ผ่านเฉพาะปีอธิกสุรทิน — ขอบที่เปราะที่สุดของ assertRealDate', () => {
    expect(toIsoDate('29-ก.พ.-67')).toBe('2024-02-29');
    expect(() => toIsoDate('29-ก.พ.-68')).toThrow(/ไม่มีอยู่จริง/);
  });

  it('ISO ที่เขียนด้วยเลขไทยก็อ่านได้ — ผลพลอยได้ของการแปลงเลขก่อนตรวจรูปแบบ', () => {
    expect(toIsoDate('๒๐๒๕-๐๖-๑๘')).toBe('2025-06-18');
  });

  it('ISO ที่ปีเป็น พ.ศ. → โยน error ไม่คืนปีที่คลาด 543 ปี', () => {
    expect(() => toIsoDate('2568-06-18')).toThrow(/ปีไม่สมเหตุสมผล/);
  });

  it('รับค่าที่ไม่ใช่สตริงจาก property bag ได้โดยไม่พัง', () => {
    expect(() => toIsoDate(null)).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate(undefined)).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate(20250618)).toThrow(/อ่านวันที่ไม่ออก/);
  });
});
