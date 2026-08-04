import { describe, expect, it } from 'vitest';
import { allowAdminWithoutRegistry } from '@/lib/admin-registry-gate';

// กฎนี้ตัวเดียวคั่นระหว่าง "ลืมตั้ง MONGODB_URI" กับ "หลังบ้านเปิดรับทุกคนที่
// ล็อกอิน Clerk ได้" — และตอนนั้นเว็บจะยังเสิร์ฟ seed ต่อไปเหมือนไม่มีอะไรผิด
// จึงไม่มีสัญญาณอะไรเตือนเลย เทสต์ชุดนี้มีไว้ไม่ให้ใครพลิกกลับโดยไม่ตั้งใจ
describe('allowAdminWithoutRegistry', () => {
  it('production: ปฏิเสธ — ไม่มีทะเบียนก็ตัดสินไม่ได้ว่าใครเป็นเจ้าหน้าที่', () => {
    expect(allowAdminWithoutRegistry('production')).toBe(false);
  });

  it('dev / test: ปล่อยผ่าน เพื่อให้รันได้โดยไม่ต้องตั้งค่าอะไร', () => {
    expect(allowAdminWithoutRegistry('development')).toBe(true);
    expect(allowAdminWithoutRegistry('test')).toBe(true);
  });

  it('ไม่ได้ตั้ง NODE_ENV: ปล่อยผ่าน (ไม่ใช่ production)', () => {
    expect(allowAdminWithoutRegistry(undefined)).toBe(true);
    expect(allowAdminWithoutRegistry('')).toBe(true);
  });

  it('ค่าที่ไม่รู้จักถือว่าไม่ใช่ production', () => {
    expect(allowAdminWithoutRegistry('staging')).toBe(true);
    expect(allowAdminWithoutRegistry('PRODUCTION')).toBe(true); // case-sensitive ตาม Node
  });
});
