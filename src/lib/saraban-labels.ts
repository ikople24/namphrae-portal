// src/lib/saraban-labels.ts
// ป้ายภาษาไทยของคีย์ในโดเมนสารบรรณ — client-safe ใช้ทั้งหน้าจอและข้อความใน event

import type {
  DisplayStatus,
  SarabanLevel,
  SarabanRegister,
  SendMethod,
} from '@/types/saraban';

export const REGISTER_LABELS: Record<SarabanRegister, string> = {
  in: 'ทะเบียนหนังสือรับ',
  out: 'ทะเบียนหนังสือส่ง',
  circular: 'ทะเบียนหนังสือเวียน',
};

export const LEVEL_LABELS: Record<SarabanLevel, string> = {
  normal: 'ปกติ',
  urgent: 'ด่วน',
  'very-urgent': 'ด่วนมาก',
  'most-urgent': 'ด่วนที่สุด',
};

// ข้อความเต็มประโยค เพราะใช้เป็น note ของ event "ส่งแล้ว" ตรง ๆ และตรงกับคอลัมน์
// "การปฏิบัติ" ของรายงานทะเบียนส่งในต้นแบบ
export const SEND_METHOD_LABELS: Record<SendMethod, string> = {
  system: 'ส่งทางระบบสารบรรณอิเล็กทรอนิกส์',
  post: 'ส่งทางไปรษณีย์',
  hand: 'นำส่งเอง',
};

const IN_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอเกษียน',
  'in-progress': 'ดำเนินการ',
  done: 'เสร็จสิ้น',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

// ส่ง/เวียนเริ่มที่ in-progress เสมอ ('pending' ไม่เกิดจริง ใส่ไว้ให้ Record ครบ)
// จงใจเบี่ยงจากต้นแบบ — วงจรของหนังสือส่งคือ "ออกเลข → ส่ง" ป้ายควรบอกตรง ๆ (สเปกข้อ 3)
const OUTGOING_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอส่ง',
  'in-progress': 'รอส่ง',
  done: 'ส่งแล้ว',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

export function statusLabel(register: SarabanRegister, status: DisplayStatus): string {
  return (register === 'in' ? IN_STATUS_LABELS : OUTGOING_STATUS_LABELS)[status];
}

/**
 * ชื่อช่องที่แสดงในประวัติการแก้ไข — `field` มาจาก event ที่เก็บไว้ จึงเป็น string อิสระ
 * ใช้ Object.hasOwn ไม่ใช่ `labels[field] ?? field` เพราะ 'constructor' จะได้ฟังก์ชันของ
 * Object.prototype กลับมาแทน
 */
export function fieldLabel(register: SarabanRegister, field: string): string {
  const labels: Record<string, string> = {
    ref: 'ที่หนังสือ',
    docDate: 'ลงวันที่',
    party: register === 'in' ? 'จาก' : 'ถึง',
    subject: 'เรื่อง',
    level: 'ชั้นความเร็ว',
    dueDate: 'กำหนดแล้วเสร็จ',
    holderUnitId: register === 'in' ? 'เสนอถึง' : 'ส่วนราชการเจ้าของเรื่อง',
  };
  return Object.hasOwn(labels, field) ? labels[field] : field;
}
