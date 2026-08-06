import { describe, expect, it } from 'vitest';
import { adminCalendarKey } from '@/lib/admin-api';

// admin-api.ts ที่เหลือเป็น wrapper บาง ๆ ของ fetch (เทสต์ตรง ๆ ไม่ได้โดยไม่
// mock ทั้ง network) — ที่นี่จึงครอบเฉพาะ adminCalendarKey ซึ่งเป็นฟังก์ชัน
// บริสุทธิ์ และเป็นทั้ง URL ของคำขอและ cache key ของ SWR ในตัวเดียวกัน คีย์
// เพี้ยนเมื่อไรไม่ได้แปลว่าโหลดผิดอย่างเดียว แต่แปลว่าสอง component แชร์แคช
// กันผิดตัวด้วย
describe('adminCalendarKey', () => {
  it('ไม่ใส่อะไรเลย — ไม่มี query string ห้อยท้าย', () => {
    expect(adminCalendarKey({})).toBe('/api/admin/calendar');
  });

  it('เดือน/สถานะ ใส่เท่าที่มีค่า', () => {
    expect(adminCalendarKey({ month: '2026-08' })).toBe(
      '/api/admin/calendar?month=2026-08'
    );
    expect(adminCalendarKey({ status: 'pending' })).toBe(
      '/api/admin/calendar?status=pending'
    );
  });

  // badge บน sidebar อยู่ทุกหน้าหลังบ้านและ refresh ทุกนาที — ต้องขอมาแค่ตัวเลข
  // ไม่ใช่รายการงานเต็ม (ชื่อผู้ป่วย/เบอร์โทรเป็น PII ที่ไม่ควรถูกส่งไปนั่งอยู่
  // ในเบราว์เซอร์ของทุกหน้าที่ไม่ได้ใช้)
  it('countOnly — ขอเฉพาะตัวเลข ใช้ร่วมกับ status ได้', () => {
    expect(adminCalendarKey({ status: 'pending', countOnly: true })).toBe(
      '/api/admin/calendar?status=pending&countOnly=1'
    );
  });

  // false ต้องไม่ใส่คีย์ ไม่ใช่ใส่ countOnly=0 — ฝั่ง API เช็คแค่ว่ามีคีย์นี้ไหม
  // (req.query.countOnly เป็น truthy ทันทีที่มีคีย์ แม้ค่าจะเป็น '0')
  it('countOnly: false — ไม่ขึ้นคีย์ในคิวรี ได้คีย์เดียวกับตอนไม่ใส่', () => {
    expect(adminCalendarKey({ status: 'pending', countOnly: false })).toBe(
      adminCalendarKey({ status: 'pending' })
    );
  });
});
