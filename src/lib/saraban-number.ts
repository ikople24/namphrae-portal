// src/lib/saraban-number.ts
// ปีงบและเลขทะเบียนของสารบรรณ — ฟังก์ชันบริสุทธิ์ทั้งหมด (สเปกข้อ 4)
// client-safe: หน้าจอใช้ fiscalYearOf/formatNo ด้วย ห้าม import อะไรฝั่งเซิร์ฟเวอร์

import type { SarabanRegister } from '@/types/saraban';

// เวลาไทยคงที่ UTC+7 ไม่มีเวลาออมแสง — บวกชั่วโมงแล้วตัดวันที่จาก ISO ได้ตรงทุกเครื่อง
// ไม่พึ่ง Intl.DateTimeFormat('en-CA') แบบ todayInBangkok(): รูปแบบของ locale เป็นข้อมูล
// CLDR ไม่ใช่สัญญา (เคยมี browser ที่คืน en-CA เป็น M/D/YYYY) ที่ปฏิทินแค่แสดงผลเพี้ยน
// แต่ที่นี่ปีงบเป็นส่วนหนึ่งของ unique key ของทะเบียนราชการ
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * วันที่ตามเวลากรุงเทพฯ ของเวลาจริงขณะหนึ่ง
 *
 * รับ Date เข้ามาแทนที่จะเรียก new Date() เอง เพราะ createDoc() ต้องได้ปีงบกับเวลาลงทะเบียน
 * จากขณะเดียวกัน — ถ้าต่างคนต่างอ่านนาฬิกา ตอนเที่ยงคืน 1 ต.ค. เวลาอาจเป็นวันใหม่แต่ปีงบ
 * ยังเป็นปีเก่า (ผลพลอยได้: เทสต์ส่งเวลาข้ามเที่ยงคืนได้ตรง ๆ)
 */
export function bangkokDateOf(at: Date): string {
  return new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

const ISO_DATE = /^(\d{4})-(\d{2})-\d{2}$/;

/**
 * ปีงบประมาณ พ.ศ. ของวันที่ 'YYYY-MM-DD' ปี ค.ศ. — ปีงบเริ่ม 1 ต.ค.
 *   '2026-09-30' → 2569 · '2026-10-01' → 2570
 *
 * ผลลัพธ์เป็นส่วนหนึ่งของ unique key ของทะเบียน จึงโยน error แทนการคืนค่าที่ดูเหมือนจริง —
 * ถ้าไม่เช็ค '' จะได้ 543 · ปี พ.ศ. ที่หลุดมา '2569-10-01' จะได้ 3113 · รูปแบบอื่นได้ NaN แล้ว
 * Mongo ออกเลขต่อใน "ปี NaN" ได้เงียบ ๆ
 *
 * ขอบปีอยู่ที่นี่ที่เดียว (สเปกข้อ 1.6) — ระเบียบงานสารบรรณ ข้อ 38.1/40.1 เขียนว่า "จนสิ้นปี
 * ปฏิทิน" ถ้าวันหนึ่งเทศบาลเปลี่ยนไปใช้ปีปฏิทิน แก้ที่นี่ แต่ **ต้องตัดสินเรื่องปีรอยต่อด้วย**:
 * เปลี่ยนกลางปีงบ เลขปีเดียวกัน (เช่น 2570) จะเป็นทั้งปีงบเก่าและปีปฏิทินใหม่ max+1 จะรันต่อ
 * จากเลขของ ต.ค.–ธ.ค. แทนที่จะเริ่ม 1 และชื่อฟิลด์ fiscalYear กับป้าย "ปีงบประมาณ" ต้องเปลี่ยนตาม
 */
export function fiscalYearOf(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(`fiscalYearOf: ต้องเป็นวันที่ 'YYYY-MM-DD' ได้ ${JSON.stringify(date)}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2100) {
    throw new Error(`fiscalYearOf: ปี ${year} ไม่ใช่ ค.ศ. — ดูเหมือนปี พ.ศ. หลุดมา`);
  }
  return (month >= 10 ? year + 1 : year) + 543;
}

/**
 * เลขถัดไปของ (ทะเบียน, ปีงบ)
 * @param maxNo เลขมากสุดที่มีอยู่ รวมแถวที่ยกเลิกแล้ว (เลขไม่ถูกใช้ซ้ำ) · null = ยังไม่มีหนังสือ
 * @param startNo เลขเริ่มต้นที่ตั้งไว้ของปีนั้น · null = ไม่ได้ตั้ง
 *
 * startNo มีผลเฉพาะตอนปีนั้นยังว่าง — พอมีหนังสือแล้วใช้ max + 1 เสมอ ข้อนี้ทำให้ setStartNo()
 * ใน saraban-store.ts ไม่ต้อง atomic เพื่อกันเลขซ้ำหรือมีรู (ส่วนที่ยังเหลือดูคอมเมนต์ที่นั่น)
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
