// src/lib/saraban-number.ts
// ปีงบและเลขทะเบียนของสารบรรณ — ฟังก์ชันบริสุทธิ์ทั้งหมด (สเปกข้อ 4)
// client-safe: หน้าจอใช้ fiscalYearOf/formatNo ด้วย ห้าม import อะไรฝั่งเซิร์ฟเวอร์

import type { SarabanRegister } from '@/types/saraban';

// 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี (แนวเดียวกับ todayInBangkok ใน calendar-grid.ts)
const BANGKOK_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * วันที่ตามเวลากรุงเทพฯ ของเวลาจริงขณะหนึ่ง — รับ Date เข้ามาแทนที่จะเรียก new Date()
 * เอง เพื่อให้เทสต์ส่งเวลาข้ามเที่ยงคืนได้ (todayInBangkok() ของปฏิทินทำแบบนั้นไม่ได้)
 */
export function bangkokDateOf(at: Date): string {
  return BANGKOK_DATE.format(at);
}

/**
 * ปีงบประมาณ พ.ศ. ของวันที่ 'YYYY-MM-DD' — ปีงบเริ่ม 1 ต.ค.
 *   '2026-09-30' → 2569 · '2026-10-01' → 2570
 *
 * ขอบปีอยู่ที่นี่ที่เดียว (สเปกข้อ 1.6) — ระเบียบงานสารบรรณ ข้อ 38.1/40.1 เขียนว่า
 * "จนสิ้นปีปฏิทิน" ถ้าวันหนึ่งเทศบาลเปลี่ยนไปใช้ปีปฏิทิน แก้ฟังก์ชันนี้ฟังก์ชันเดียว
 */
export function fiscalYearOf(date: string): number {
  const [year, month] = date.split('-').map(Number);
  return (month >= 10 ? year + 1 : year) + 543;
}

/**
 * เลขถัดไปของ (ทะเบียน, ปีงบ)
 * @param maxNo เลขมากสุดที่มีอยู่ รวมแถวที่ยกเลิกแล้ว (เลขไม่ถูกใช้ซ้ำ) · null = ยังไม่มีหนังสือ
 * @param startNo เลขเริ่มต้นที่ตั้งไว้ของปีนั้น · null = ไม่ได้ตั้ง
 *
 * startNo มีผลเฉพาะตอนปีนั้นยังว่าง — พอมีหนังสือแล้วใช้ max + 1 เสมอ ข้อนี้คือเหตุผลที่
 * setStartNo() ใน saraban-store.ts ไม่ต้อง atomic
 */
export function nextNo(maxNo: number | null, startNo: number | null): number {
  if (maxNo !== null) return maxNo + 1;
  return startNo ?? 1;
}

/** เลขในทะเบียน — รับ/ส่ง '0421' · เวียน 'ว 0012' (เกิน 9999 แสดงตามจริง) */
export function formatNo(register: SarabanRegister, no: number): string {
  const padded = String(no).padStart(4, '0');
  return register === 'circular' ? `ว ${padded}` : padded;
}

/**
 * "ที่" ของหนังสือส่ง/เวียน — ไม่เติมศูนย์ ตามรูปแบบหนังสือราชการ
 *   ('ชม 55201', 'out', 388) → 'ชม 55201/388' · ('ชม 55201', 'circular', 12) → 'ชม 55201/ว 12'
 */
export function composeRef(
  refCode: string,
  register: 'out' | 'circular',
  no: number
): string {
  return register === 'circular' ? `${refCode}/ว ${no}` : `${refCode}/${no}`;
}
