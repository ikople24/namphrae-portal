import { describe, it, expect } from 'vitest';
import { parseThaiDate } from '@/lib/thai-date';

describe('parseThaiDate', () => {
  it('แปลง "21 มกราคม 2564" เป็น 2021-01-21 UTC', () => {
    expect(parseThaiDate('21 มกราคม 2564')?.toISOString()).toBe('2021-01-21T00:00:00.000Z');
  });
  it('แปลงเดือนธันวาคมและปีอื่นถูกต้อง', () => {
    expect(parseThaiDate('5 ธันวาคม 2569')?.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });
  it('คืน null เมื่อรูปแบบผิด', () => {
    expect(parseThaiDate('มีนาคม 2564')).toBeNull();
    expect(parseThaiDate('32 มีนาคม 2564')).toBeNull();
    expect(parseThaiDate('1 January 2564')).toBeNull();
    expect(parseThaiDate('')).toBeNull();
  });

  // เดือนย่อ (ข้อมูลน้ำท่วม)
  it('รองรับเดือนย่อ "16 ต.ค. 2566" → 2023-10-16', () => {
    expect(parseThaiDate('16 ต.ค. 2566')?.toISOString()).toBe('2023-10-16T00:00:00.000Z');
  });
  it('รองรับเดือนย่อ "1 มี.ค. 2565" → 2022-03-01', () => {
    expect(parseThaiDate('1 มี.ค. 2565')?.toISOString()).toBe('2022-03-01T00:00:00.000Z');
  });
  // ช่วงวัน → ใช้วันแรก
  it('ช่วงวัน "3, 4 ต.ค. 2567" ใช้วันแรก → 2024-10-03', () => {
    expect(parseThaiDate('3, 4 ต.ค. 2567')?.toISOString()).toBe('2024-10-03T00:00:00.000Z');
  });
  // ที่อยู่ (คอลัมน์ date ของภัยแล้ง) ต้องคืน null → ให้ import fallback เป็นปี
  it('คืน null สำหรับที่อยู่ที่ไม่ใช่วันที่', () => {
    expect(parseThaiDate('5/1 ม.7')).toBeNull();
    expect(parseThaiDate('452 ม.7')).toBeNull();
    expect(parseThaiDate('324/1 ม.7')).toBeNull();
  });
});
