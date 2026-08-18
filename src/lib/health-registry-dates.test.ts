import { describe, it, expect } from 'vitest';
import { excelSerialToUTC, normalizeRegistryDate } from '@/lib/health-registry-dates';

describe('excelSerialToUTC', () => {
  it('45031 → 2023-04-15 (serial ค.ศ. ปกติ)', () => {
    expect(excelSerialToUTC(45031).toISOString()).toBe('2023-04-15T00:00:00.000Z');
  });
});

describe('normalizeRegistryDate', () => {
  it('ข้อความไทย "25 มิถุนายน 2563" → 2020-06-25', () => {
    expect(normalizeRegistryDate('25 มิถุนายน 2563', 2563)?.toISOString()).toBe('2020-06-25T00:00:00.000Z');
  });
  it('serial ค.ศ. ปกติ 45031 ในทะเบียนปี 2566 → 2023-04-15', () => {
    expect(normalizeRegistryDate(45031, 2566)?.toISOString()).toBe('2023-04-15T00:00:00.000Z');
  });
  it('serial ปี พ.ศ. พิมพ์เป็น ค.ศ. (244110) → ลบ 543 ปี เหลือ ค.ศ. 2025', () => {
    expect(normalizeRegistryDate(244110, 2568)?.getUTCFullYear()).toBe(2025);
  });
  it('serial ปี 19xx จากปี 2 หลัก (24841 ≈ 1968) → +57 ปี เป็น ค.ศ. 2025', () => {
    expect(normalizeRegistryDate(24841, 2568)?.getUTCFullYear()).toBe(2025);
  });
  it('เลขวันโดด ๆ (เซลล์ "30" → serial 30 = ปี 1900) → null', () => {
    expect(normalizeRegistryDate(30, 2563)).toBeNull();
  });
  it('ผลนอกช่วง yearBE ± 1 → null (45031=2023 แต่ทะเบียนปี 2563=2020)', () => {
    expect(normalizeRegistryDate(45031, 2563)).toBeNull();
  });
  it('ข้อความว่าง / ข้อความที่ไม่ใช่วันที่ → null', () => {
    expect(normalizeRegistryDate('', 2563)).toBeNull();
    expect(normalizeRegistryDate('บ้านสวนไม่มีเลขที่', 2563)).toBeNull();
  });
  it('29 ก.พ. พ.ศ. 2568 (244043) เลื่อน −543 ปี → ค.ศ. 2025 ไม่ใช่ leap year → ล้นเป็น 1 มี.ค. → null', () => {
    expect(normalizeRegistryDate(244043, 2568)).toBeNull();
  });
  it('ขอบเขตช่วง yearBE ± 1: BE ปีก่อนหน้า 1 ปี ผ่าน, ปีก่อนหน้า 2 ปี ไม่ผ่าน', () => {
    expect(normalizeRegistryDate('1 มกราคม 2565', 2566)?.getUTCFullYear()).toBe(2022);
    expect(normalizeRegistryDate('1 มกราคม 2564', 2566)).toBeNull();
  });
  it('excelSerialToUTC ตัดเศษเวลา (fractional serial) ทิ้ง', () => {
    expect(excelSerialToUTC(45031.75).toISOString()).toBe('2023-04-15T00:00:00.000Z');
  });
  it('serial ที่ไม่เป็นบวก (0, ลบ) → null', () => {
    expect(normalizeRegistryDate(0, 2563)).toBeNull();
    expect(normalizeRegistryDate(-5, 2563)).toBeNull();
  });
  it('slash format D/M/YYYY ปี พ.ศ. เช่น "27/06/2566" → 2023-06-27', () => {
    expect(normalizeRegistryDate('27/06/2566', 2566)?.toISOString()).toBe('2023-06-27T00:00:00.000Z');
    expect(normalizeRegistryDate('3/07/2566', 2566)?.toISOString()).toBe('2023-07-03T00:00:00.000Z');
    expect(normalizeRegistryDate('1/7/2566', 2566)?.toISOString()).toBe('2023-07-01T00:00:00.000Z');
  });
  it('slash format วันเกินจริง/ไม่มีปี → null', () => {
    expect(normalizeRegistryDate('31/02/2566', 2566)).toBeNull();
    expect(normalizeRegistryDate('5/1', 2563)).toBeNull(); // ไม่มีปี 4 หลัก
  });
  it('slash format ปี ค.ศ. ตรง ๆ "27/06/2023" ในทะเบียนปี 2566 → 2023-06-27', () => {
    expect(normalizeRegistryDate('27/06/2023', 2566)?.toISOString()).toBe('2023-06-27T00:00:00.000Z');
  });
});
